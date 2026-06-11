/**
 * EditorAPI — direct HTTP to visual-editor-be (the editor backend) and
 * to the storefront (which still hosts the in-app editor's legacy proxy
 * routes — `/editor/api/*` — for auth / data-source / AI).
 *
 * Read endpoints (visual-editor-be):
 *   GET  /api/v1/themes/{themeId}                              — theme structure
 *   GET  /api/v1/themes/{themeId}/templates/{templateId}        — pageConfig
 *   GET  /api/v1/themes/{themeId}/translations/{templateId}/{language}
 *
 * Write endpoints (visual-editor-be) — wired now, called when
 * write-back lands:
 *   PUT  /api/v1/themes/{themeId}/templates/{templateId}
 *   PUT  /api/v1/themes/{themeId}/translations/{templateId}/{language}
 *
 * Storefront-hosted endpoints — auth/data-source proxies inherited from
 * the in-app editor. Widget schemas + section library moved off HTTP and
 * onto a postMessage handshake (EditorAssetPublisher → TemplateEditor).
 *   POST /editor/api/merchant-validation               — auth check
 *   POST /editor/api/data-source-options               — dropdown options
 *
 * Direct browser calls (key in VITE_ env, exposed in bundle) — temporary
 * until visual-editor-be has its own proxy:
 *   POST https://api.openai.com/v1/audio/transcriptions  — voice transcription
 *   POST https://api.anthropic.com/v1/messages           — AI generation
 *
 * HTTP via ky:
 *   - Throws on non-2xx (HTTPError) — no manual `!response.ok` plumbing.
 *   - `retry: 0` because the editor's failure mode is an explicit error
 *     screen at boot / surfaced to the user; no silent retries.
 *   - Two instances because Spike 2 + the legacy proxy routes live on
 *     the storefront origin while the BE endpoint surface is unbuilt.
 */

import ky, { HTTPError } from "ky";
import { useAuthStore } from "../../stores/authStore";

/** Standard `{ data: T }` envelope returned by visual-editor-be. */
interface ApiEnvelope<T> {
  data?: T;
  message?: string;
}

// ---- Code editor (`/source/*`) contract types — plan §9 -----------------

export type FileNode = {
  path: string;
  name: string;
  type: "file" | "dir";
  children?: FileNode[];
  isOverridden?: boolean;
};

export type BuildStatus =
  | { kind: "queued" }
  | { kind: "building"; startedAt: number }
  | { kind: "ready"; previewUrl: string; finishedAt: number }
  | { kind: "published"; prodUrl: string; finishedAt: number }
  | { kind: "failed"; error: string; finishedAt: number };

export type SourceValidationIssue = {
  line?: number;
  column?: number;
  message: string;
};

export type SourceErrorCode =
  | "forbidden" // 403 — path allowlist violation
  | "stale" // 409 { error: "stale" } — optimistic-lock conflict
  | "preview_required" // 409 { error: "preview_required" } — publish gate
  | "too_large" // 413
  | "validation" // 422 — body has errors: [{ line?, column?, message }]
  | "unknown";

/**
 * Typed error for `/source/*` failures so the codeEditorSession machine
 * can branch on `code` instead of sniffing HTTP statuses.
 */
export class SourceApiError extends Error {
  code: SourceErrorCode;
  status: number;
  currentVersion?: string;
  issues?: SourceValidationIssue[];

  constructor(args: {
    code: SourceErrorCode;
    status: number;
    message: string;
    currentVersion?: string;
    issues?: SourceValidationIssue[];
  }) {
    super(args.message);
    this.name = "SourceApiError";
    this.code = args.code;
    this.status = args.status;
    this.currentVersion = args.currentVersion;
    this.issues = args.issues;
  }
}

/**
 * Map an HTTPError from a `/source/*` call onto SourceApiError per the
 * locked contract. Non-HTTP errors (network, abort) pass through.
 */
async function rethrowSourceError(err: unknown): Promise<never> {
  if (!(err instanceof HTTPError)) throw err;
  const status = err.response.status;
  let body: {
    error?: string;
    currentVersion?: string;
    errors?: SourceValidationIssue[];
  } = {};
  try {
    body = await err.response.clone().json();
  } catch {
    // Non-JSON error body — fall through with empty shape.
  }
  switch (status) {
    case 403:
      throw new SourceApiError({
        code: "forbidden",
        status,
        message: "This file isn't editable.",
      });
    case 409:
      if (body.error === "preview_required") {
        throw new SourceApiError({
          code: "preview_required",
          status,
          message: "Run Build Preview first.",
        });
      }
      throw new SourceApiError({
        code: "stale",
        status,
        currentVersion: body.currentVersion,
        message: "File changed elsewhere — reload file.",
      });
    case 413:
      throw new SourceApiError({
        code: "too_large",
        status,
        message: "File is too large to save.",
      });
    case 422:
      throw new SourceApiError({
        code: "validation",
        status,
        issues: body.errors ?? [],
        message: "Validation failed.",
      });
    default:
      throw new SourceApiError({
        code: "unknown",
        status,
        message: `Request failed (${status}).`,
      });
  }
}

/**
 * Shape of `GET /api/v1/themes/{themeId}`. The BE wraps the theme inside
 * `data.theme` (not just `data`), so the typed envelope captures that
 * directly — callers get a `ThemeStructure` and never see the wrapper.
 */
export interface ThemeStructureTemplate {
  id: string;
  name?: string;
  variant?: string;
  isDynamic?: boolean;
  supportedLanguages?: string[];
  routeContext?: {
    templateName?: string;
    type?: string;
    path?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    [key: string]: unknown;
  };
}
export interface ThemeStructureGroup {
  name: string;
  templates?: ThemeStructureTemplate[];
}
export interface ThemeStructure {
  id: string;
  name: string;
  templateCount?: number;
  templateStructure: ThemeStructureGroup[];
}

const editorBe = ky.create({
  prefix: "https://visual-editor-be-v2.primathontech.co.in",
  cache: "no-store",
  retry: 0,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        // Boot call sets Authorization explicitly; hook is a no-op there
        // and fills the header for every post-boot call from authStore.
        if (request.headers.has("Authorization")) return;
        const token = useAuthStore.getState().token;
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
    afterResponse: [
      ({ response }) => {
        // TODO: mid-session 401 → emit TOKEN_EXPIRED to appBootMachine.
        // Deferred until backend session/refresh shape lands (Lakshya §3).
        // Boot-time 401 is already handled inside the authenticate actor.
        if (response.status === 401) {
          // intentionally no-op for now
        }
      },
    ],
  },
});

// Storefront-hosted legacy proxy routes (currently just
// /editor/api/data-source-options). Built per-call so the prefix follows
// the boot-machine's resolved merchant.previewOrigin. Collapses into
// editorBe.get() the day these endpoints migrate to visual-editor-be.
const storefrontKy = () => {
  const previewOrigin = useAuthStore.getState().merchant?.previewOrigin;
  if (!previewOrigin) {
    throw new Error("previewOrigin not set; merchant not authenticated");
  }
  return ky.create({
    prefix: previewOrigin,
    cache: "no-store",
    retry: 0,
  });
};

/**
 * Resolve the preview origin the editor iframes + postMessages against.
 *
 * Base is the merchant's deployed storefront URL (`merchant.url` from the
 * mapping). A dev-only override lets a developer point the cloud editor at
 * their local store while iterating on JSX:
 *
 *   https://editor-dev…/?mid=…&previewOrigin=http://localhost:3000
 *
 * Two gates keep this from being an open postMessage redirect — `previewOrigin`
 * is both the outbound `targetOrigin` and the inbound `allowedOrigins`:
 *   - VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE — set only on dev/QA editor builds,
 *     absent in prod, so a prod editor ignores the param entirely.
 *   - localhost / 127.0.0.1 only — even on dev/QA the override can't be pointed
 *     at an attacker origin.
 *
 * Always normalized to a bare origin (no trailing slash) so it exact-matches
 * `event.origin` in the postMessage gate.
 */
function pickPreviewOrigin(deployedUrl: string): string {
  const strip = (s: string) => s.replace(/\/+$/, "");
  const raw =
    typeof location !== "undefined"
      ? new URLSearchParams(location.search).get("previewOrigin")
      : null;
  // Normalize before gating so a trailing slash doesn't silently fail the
  // match and fall back to the deployed URL.
  const override = raw ? strip(raw) : null;
  const allowed =
    import.meta.env.VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE === "true" &&
    !!override &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override);
  return allowed ? override! : strip(deployedUrl);
}

export class EditorAPI {
  // -- Reads --------------------------------------------------------------

  static async getThemeStructure(themeId: string): Promise<ThemeStructure> {
    const json = await editorBe
      .get(`api/v1/themes/${themeId}`)
      .json<ApiEnvelope<{ theme: ThemeStructure }>>();
    const theme = json?.data?.theme;
    if (!theme) {
      throw new Error(
        `Theme "${themeId}" response missing data.theme`,
      );
    }
    return theme;
  }

  static async getTemplate(
    themeId: string,
    templateId: string,
  ): Promise<unknown> {
    const json = await editorBe
      .get(`api/v1/themes/${themeId}/templates/${templateId}`)
      .json<ApiEnvelope<{ template?: { pageConfig?: unknown } }>>();
    const pageConfig = json?.data?.template?.pageConfig;
    if (!pageConfig) {
      throw new Error("Template response missing data.template.pageConfig");
    }
    return pageConfig;
  }

  static async getTranslation(
    themeId: string,
    templateId: string,
    language: string,
  ): Promise<Record<string, unknown>> {
    try {
      const json = await editorBe
        .get(`api/v1/themes/${themeId}/translations/${templateId}/${language}`)
        .json<ApiEnvelope<{ translations?: Record<string, unknown> }>>();
      return json?.data?.translations ?? {};
    } catch (err) {
      // Translations are best-effort — some templates have no entries.
      console.warn(
        `Translation fetch ${templateId}/${language} failed; treating as empty.`,
        err,
      );
      return {};
    }
  }

  // Widget schemas + section library used to live here (GETs against the
  // storefront's /api/editor/widget-schemas + /available-sections proxy
  // routes). They now arrive over postMessage from the preview iframe —
  // see EditorAssetPublisher on the storefront side, receiver in
  // TemplateEditor. The corresponding stores are passive sinks.

  // -- Writes (wired; not called until write-back lands) ------------------
  //
  // TODO(OFCE-48 concurrency): both saveTemplate and saveTranslation are
  // last-write-wins today. If two editors are open on the same template,
  // the second save silently clobbers the first. Standard fix is etag /
  // If-Match: backend returns a `version` (or ETag) with each GET, client
  // sends `If-Match: <version>` on PUT, backend rejects with 412 if
  // stale → editor shows "someone else saved, reload." Needs the version
  // to thread through `getTemplate` → `useEditorState` → here. Deferred
  // until multi-editor scenarios are a real concern.

  static async saveTemplate(
    themeId: string,
    templateId: string,
    templateData: {
      metadata: {
        id: string;
        name: string;
        brand: string;
        type: string;
        version: string;
        routeContext?: unknown;
      };
      layout?: unknown;
      sections: unknown[];
      dataSources: Record<string, unknown>;
    },
  ): Promise<{
    templateId: string;
    version: string;
    savedAt: string;
    message?: string;
  }> {
    const json = await editorBe
      .put(`api/v1/themes/${themeId}/templates/${templateId}`, {
        json: templateData,
      })
      .json<
        ApiEnvelope<{ templateId: string; version: string; savedAt: string }>
      >();
    const result = json?.data;
    if (!result) {
      throw new Error("Save template response missing data");
    }
    return { ...result, message: json?.message };
  }

  static async saveTranslation(
    themeId: string,
    templateId: string,
    language: string,
    translations: Record<string, unknown>,
  ): Promise<{ language: string; templateId: string; savedAt: string }> {
    const json = await editorBe
      .put(
        `api/v1/themes/${themeId}/translations/${templateId}/${language}`,
        { json: { translations } },
      )
      .json<
        ApiEnvelope<{ language: string; templateId: string; savedAt: string }>
      >();
    return (
      json?.data ?? {
        language,
        templateId,
        savedAt: new Date().toISOString(),
      }
    );
  }

  // -- Code editor source endpoints (`/source/*`) -------------------------
  //
  // Locked contract (code_editor_plan.md §7.1 / §9). All enveloped as
  // `{ data: ... }`; failures rethrown as SourceApiError so the
  // codeEditorSession machine branches on `code`, not HTTP status.

  static async getSourceTree(themeId: string): Promise<{ tree: FileNode[] }> {
    try {
      const json = await editorBe
        .get(`api/v1/themes/${themeId}/source/tree`)
        .json<ApiEnvelope<{ tree: FileNode[] }>>();
      return { tree: json?.data?.tree ?? [] };
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  static async getSourceFile(
    themeId: string,
    path: string,
  ): Promise<{ content: string; version: string; isOverride: boolean }> {
    try {
      const json = await editorBe
        .get(`api/v1/themes/${themeId}/source/file`, {
          searchParams: { path },
        })
        .json<
          ApiEnvelope<{ content: string; version: string; isOverride: boolean }>
        >();
      const data = json?.data;
      if (!data) throw new Error("Source file response missing data");
      return data;
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  static async saveSourceFile(
    themeId: string,
    path: string,
    content: string,
    version: string,
  ): Promise<{ version: string }> {
    try {
      const json = await editorBe
        .put(`api/v1/themes/${themeId}/source/file`, {
          json: { path, content, version },
        })
        .json<ApiEnvelope<{ version: string }>>();
      const data = json?.data;
      if (!data?.version) throw new Error("Save response missing data.version");
      return data;
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  static async revertSourceFile(
    themeId: string,
    path: string,
  ): Promise<{ reverted: boolean }> {
    try {
      const json = await editorBe
        .delete(`api/v1/themes/${themeId}/source/file`, {
          searchParams: { path },
        })
        .json<ApiEnvelope<{ reverted: boolean }>>();
      return { reverted: json?.data?.reverted ?? false };
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  static async buildSourcePreview(
    themeId: string,
  ): Promise<{ buildId: string; commitSha: string }> {
    try {
      const json = await editorBe
        .post(`api/v1/themes/${themeId}/source/build-preview`)
        .json<ApiEnvelope<{ buildId: string; commitSha: string }>>();
      const data = json?.data;
      if (!data?.buildId) {
        throw new Error("Build-preview response missing data.buildId");
      }
      return data;
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  static async publishSource(themeId: string): Promise<{ buildId: string }> {
    try {
      const json = await editorBe
        .post(`api/v1/themes/${themeId}/source/publish`)
        .json<ApiEnvelope<{ buildId: string }>>();
      const data = json?.data;
      if (!data?.buildId) {
        throw new Error("Publish response missing data.buildId");
      }
      return data;
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  static async getSourceBuildStatus(
    themeId: string,
    buildId: string,
  ): Promise<BuildStatus> {
    try {
      const json = await editorBe
        .get(`api/v1/themes/${themeId}/source/builds/${buildId}`)
        .json<ApiEnvelope<BuildStatus>>();
      const data = json?.data;
      if (!data?.kind) throw new Error("Build status response missing data");
      return data;
    } catch (err) {
      return rethrowSourceError(err);
    }
  }

  // -- Auth / data-source / AI proxies (storefront-hosted today) ----------

  /**
   * Session loader — `GET /api/v1/merchants/{mid}` with bearer token.
   * The merchant→VE mapping endpoint shipped (Lakshya §3 auth + §1
   * `merchant.url` as preview origin), so this is the live fetch.
   */
  // GET /api/v1/merchants/{mid} with bearer token — returns the merchant→VE
  // mapping. We map `merchantName → themeId` and `url → previewOrigin` and
  // drop the rest (`visualEditorId`, timestamps, the row's own id).
  //
  // Future: response will also carry `user` (identity) and editor prefs
  // (editorLanguage, editorTheme — distinct from the storefront's content
  // language and visual theme). Add them here at the boundary when needed.
  static async authenticate(input: {
    mid: string | null;
    token: string | null;
  }): Promise<{
    token: string;
    merchant: { id: string; themeId: string; previewOrigin: string };
  }> {
    // Missing-credential case is gated by the machine's `hasCredentials`
    // guard before we ever reach here. The non-null assertions reflect that
    // contract; bypassing the machine and calling this directly with nulls
    // would intentionally throw at the runtime header set.
    const json = await editorBe
      .get(`api/v1/merchants/${input.mid!}`, {
        headers: { Authorization: `Bearer ${input.token!}` },
      })
      .json<
        ApiEnvelope<{
          merchantId: string;
          merchantName: string;
          url: string;
        }>
      >();
    const d = json?.data;
    if (!d?.merchantId || !d?.merchantName || !d?.url) {
      throw new Error("Merchant response missing required fields");
    }
    return {
      token: input.token!,
      merchant: {
        id: d.merchantId,
        themeId: d.merchantName,
        // Deployed storefront URL by default; dev-only `?previewOrigin=`
        // override redirects the preview at a local store. Normalized to a
        // bare origin so it exact-matches event.origin in the postMessage gate.
        previewOrigin: pickPreviewOrigin(d.url),
      },
    };
  }

  static async getDataSourceOptions(
    type: "collections" | "products",
  ): Promise<Array<{ value: string; label: string }>> {
    try {
      const json = await storefrontKy()
        .post("editor/api/data-source-options", { json: { type } })
        .json<ApiEnvelope<Array<{ value: string; label: string }>>>();
      return json?.data ?? [];
    } catch (err) {
      console.error("Error fetching data source options:", err);
      return [];
    }
  }

  /**
   * OpenAI Whisper transcription — direct browser call.
   *
   * TODO(OFCE-48 security): VITE_OPENAI_API_KEY is bundled into the
   * editor JS and visible to anyone who opens DevTools. Move behind a
   * visual-editor-be proxy — `POST /api/v1/ai/transcribe` injects the
   * key server-side and forwards the multipart body. Frontend swaps the
   * `api.openai.com` URL for `editorBe.post('api/v1/ai/transcribe', ...)`
   * and drops the Authorization header (existing bearer flow covers it).
   */
  static async transcribeAudio(audioBlob: Blob): Promise<string> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_OPENAI_API_KEY is not configured");
    }
    const form = new FormData();
    form.append("file", audioBlob, "voice.webm");
    form.append("model", "whisper-1");
    // Force transcription language to English to keep behavior predictable
    form.append("language", "en");
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `OpenAI Whisper error ${response.status}: ${errorText}`,
      );
    }
    const data = (await response.json()) as { text?: string };
    return data?.text ?? "";
  }

  /**
   * Anthropic Messages API — direct browser call.
   *
   * TODO(OFCE-48 security): VITE_ANTHROPIC_API_KEY is bundled into the
   * editor JS and visible to anyone who opens DevTools — and the
   * `anthropic-dangerous-direct-browser-access` opt-in advertises that
   * we know it. Move behind a visual-editor-be proxy —
   * `POST /api/v1/ai/generate` injects the key server-side, forwards the
   * JSON body, drops the dangerous-direct-browser header.
   */
  static async anthropicMessages(requestBody: unknown): Promise<unknown> {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_ANTHROPIC_API_KEY is not configured");
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "structured-outputs-2025-11-13",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Anthropic API error ${response.status}: ${errorText}`,
      );
    }
    return response.json();
  }
}

export const api = {
  editor: EditorAPI,
};
