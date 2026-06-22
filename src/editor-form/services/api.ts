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
 * AI proxies (visual-editor-be — provider keys injected server-side, OFCE-48):
 *   POST /api/v1/ai/generate     — Anthropic Messages (forwards requestBody)
 *   POST /api/v1/ai/transcribe   — OpenAI Whisper (multipart audio)
 *
 * HTTP via ky:
 *   - Throws on non-2xx (HTTPError) — no manual `!response.ok` plumbing.
 *   - `retry: 0` because the editor's failure mode is an explicit error
 *     screen at boot / surfaced to the user; no silent retries.
 *   - Two instances because Spike 2 + the legacy proxy routes live on
 *     the storefront origin while the BE endpoint surface is unbuilt.
 */

import ky from "ky";
import { useAuthStore } from "../../stores/authStore";

/** Standard `{ data: T }` envelope returned by visual-editor-be. */
interface ApiEnvelope<T> {
  data?: T;
  message?: string;
}

/** Latest preview session for a template, as returned to the editor on load. */
export interface LatestPreview {
  previewId: string;
  version: number;
  pageConfig: unknown;
  /** Editor-only side-channel persisted on the preview row:
   *  - rawPageConfig: the unresolved (t:-ref) config used to resume editing
   *    without baking literals into the template.
   *  - translations: the draft common/template translations at save time, so
   *    reload restores t:-backed edits (logo, nav text, …) instead of live. */
  metadata?: {
    rawPageConfig?: unknown;
    translations?: {
      common?: Record<string, unknown>;
      template?: Record<string, unknown>;
    };
  } | null;
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
  prefix: import.meta.env.VITE_EDITOR_API_URL || "http://localhost:3000",
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

  // -- Preview (shareable preview links) ----------------------------------

  /**
   * Create a shareable preview snapshot of the merchant's in-progress
   * (unsaved) template state. `POST /api/v1/getPreviewLink` with the full
   * payload the preview doc §4.1 calls out — `themeId` rides in the body (the
   * doc's REST path carried it; this endpoint flattens it).
   *
   * The backend saves the snapshot versioned (new previewId → v1; passing an
   * existing `previewId` adds the next version) and returns the shareable URL
   * (merchant origin + `?editorPreview=true&previewId=…&version=…`).
   */
  static async getPreviewLink(body: {
    themeId: string;
    templateId: string;
    routeContext?: unknown;
    /** Locale the snapshot was authored in. Optional — the backend stores it
     *  but doesn't resolve by it; sent so it's recorded when available. */
    language?: string;
    pageConfig: unknown;
    previewId?: string;
    /** Editor-only side-channel persisted on the preview row (e.g.
     *  { rawPageConfig } — the unresolved config for resume). */
    metadata?: unknown;
  }): Promise<{
    previewId: string;
    version: number;
    url: string;
    expiresAt: string | null;
  }> {
    const json = await editorBe
      .post("api/v1/getPreviewLink", { json: body })
      .json<
        ApiEnvelope<{
          previewId: string;
          version: number;
          url: string;
          expiresAt: string | null;
        }>
      >();
    if (!json?.data?.previewId || !json?.data?.url) {
      throw new Error("Preview response missing data.previewId/url");
    }
    return json.data;
  }

  /**
   * Latest preview session for a template (id + version + pageConfig), or null
   * if none exists. Used at boot to resume the last "Save and Preview" draft
   * instead of the published/live template — and to re-bind its previewId so
   * further saves add versions to the same session. Tolerant: any failure →
   * null (caller falls back to the live template).
   */
  static async getLatestPreview(
    themeId: string,
    templateId: string
  ): Promise<LatestPreview | null> {
    try {
      const json = await editorBe
        .get("api/v1/getPreviewLink", { searchParams: { themeId, templateId } })
        .json<ApiEnvelope<LatestPreview>>();
      const d = json?.data;
      if (!d?.previewId || !d?.pageConfig) return null;
      return {
        previewId: d.previewId,
        version: d.version,
        pageConfig: d.pageConfig,
        metadata: d.metadata ?? null,
      };
    } catch {
      // 404 (no draft yet) or any error — fall back to the live template.
      return null;
    }
  }

  /** Purge a preview session by id (all templates + versions under it). */
  static async deletePreview(previewId: string): Promise<void> {
    await editorBe.delete(
      `api/v1/getPreviewLink/${encodeURIComponent(previewId)}`
    );
  }

  /**
   * Purge ALL preview data for a merchant (its single preview session across
   * every template). Called on publish — the merchant's whole preview is
   * cleared and the next edit mints a fresh previewId.
   */
  static async deleteMerchantPreviews(themeId: string): Promise<void> {
    await editorBe.delete("api/v1/getPreviewLink", {
      searchParams: { themeId },
    });
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

  /**
   * Menu picker options — the merchant's published nav menus as
   * `{ value: handle, label: title }` for the Header/Footer `menuHandle`
   * dropdown. Goes through visual-editor-be (`POST /api/v1/merchants/nav-menus`),
   * which calls the gokwik list endpoint server-side — so no CORS / no
   * `gk-merchant-id` header from the browser. Best-effort: returns `[]` on
   * failure so the field falls back to the saved handle.
   */
  static async getNavMenuOptions(): Promise<
    Array<{ value: string; label: string }>
  > {
    const merchantId = useAuthStore.getState().merchant?.id;
    if (!merchantId) return [];
    try {
      const json = await editorBe
        .post("api/v1/merchants/nav-menus", { json: { merchantId } })
        .json<ApiEnvelope<{ items?: Array<{ handle: string; title?: string }> }>>();
      return (json?.data?.items ?? []).map((m) => ({
        value: m.handle,
        label: m.title?.trim() || m.handle,
      }));
    } catch (err) {
      console.error("Error fetching nav-menu options:", err);
      return [];
    }
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
   * Voice → text via the editor backend's Whisper proxy
   * (`POST /api/v1/ai/transcribe`, OFCE-48). The OpenAI key is injected
   * server-side; the existing bearer flow on `editorBe` covers auth. BE adds
   * model + language — we send only the audio file. `timeout: false` because
   * transcription can outrun ky's 10s default.
   */
  static async transcribeAudio(audioBlob: Blob): Promise<string> {
    const form = new FormData();
    form.append("file", audioBlob, "voice.webm");
    const data = await editorBe
      .post("api/v1/ai/transcribe", { body: form, timeout: false })
      .json<{ text?: string }>();
    return data?.text ?? "";
  }

  /**
   * AI generation via the editor backend's Anthropic proxy
   * (`POST /api/v1/ai/generate`, OFCE-48). The Anthropic key + version/beta
   * headers are injected server-side; BE forwards `requestBody` verbatim and
   * relays the response unchanged, so callers still read `content[0].text`.
   * `timeout: false` because generation can outrun ky's 10s default.
   */
  static async anthropicMessages(requestBody: unknown): Promise<unknown> {
    return await editorBe
      .post("api/v1/ai/generate", { json: { requestBody }, timeout: false })
      .json();
  }
}

export const api = {
  editor: EditorAPI,
};
