import {
  createChannel,
  type AvailableSectionRegistry,
  type Channel,
  type DataSourceOption,
  type DataSourceOptionSource,
  type ProtocolMap,
  type ProtocolVersion,
  type SelectionTarget,
  type WidgetRegistry,
} from "@shopkit/editor-bridge";
import type { TranslationService } from "@shopkit/i18n";
import { resolveSectionSettings } from "./utils/translation-utils";

/**
 * Editor-side of the dynamic-lane bridge. Pure transport over
 * @shopkit/editor-bridge's typed channel — knows the message shapes
 * and translation resolution. Knows nothing about React, stores, or
 * the state machine; callers inject dependencies via the args passed
 * to registerPreviewBridge.
 *
 * One channel at a time. registerPreviewBridge closes any previous
 * channel before opening the new one — a fresh iframe / template
 * switch gets a clean transport.
 *
 * Wire model:
 *   - Fast lane (per-keystroke patches): channel.send("patchWidget" /
 *     "patchSection") fires synchronously. Per-keystroke postMessage
 *     traffic between same-origin windows is essentially free, and the
 *     iframe-side renders are isolated to the patched widget by the
 *     override store's per-key Zustand selector. Live preview while
 *     dragging sliders / typing matters more than the debounce would
 *     have saved.
 *   - Commit lane (structural change): channel.send("applyConfig",
 *     { pageConfig }) — debounced because every fire triggers a
 *     same-origin cache POST + RSC payload fetch + React reconciliation
 *     + soft-nav. The iframe owns the cache POST + soft-nav from there
 *     — this side never touches /api/editor-preview/cache.
 *   - Failure visibility: iframe-side cache POST failure rides
 *     channel.on("commitFailed") rather than being inferred from a
 *     local fetch throw — there's no fetch on this side.
 *   - Assets + ready: published by the iframe on bridge mount and
 *     surfaced through the args.onAssets / args.onReady callbacks. The
 *     channel is created via an iframe ref callback (see TemplateEditor)
 *     so the parent's message listener is attached BEFORE the iframe's
 *     React effect fires its first send — no missed-assets race.
 */

interface BridgeArgs {
  /** The iframe's WindowProxy. Reachable synchronously from a ref
   *  callback the moment the iframe element mounts, before its `load`
   *  event fires. */
  iframeWindow: Window;
  /** Origin the iframe serves from — used both for inbound origin
   *  filtering and as the pinned outbound targetOrigin. */
  previewOrigin: string;
  /** Resolves t:-refs in widget / section settings before they go over
   *  the wire. Function (not a captured ref) so the channel always sees
   *  the latest TranslationService instance after language switches. */
  getTs: () => TranslationService | null;
  /** Iframe's currently-selected section/widget. null when cleared. */
  onSelect: (target: SelectionTarget | null) => void;
  /** A commitServer call has started — used to flip the editor's
   *  state machine to `committing`. */
  onCommitFired: () => void;
  /** Iframe finished the soft-nav (rendering.pending → false). */
  onCommitSettled: () => void;
  /** Iframe-side cache POST failed; explicit signal so the editor
   *  doesn't fall back to the 8s timeout in the state machine. */
  onCommitFailed: () => void;
  /** Iframe published its widgetSchemas + section library on mount. */
  onAssets: (payload: {
    widgetSchemas: WidgetRegistry;
    availableSections: AvailableSectionRegistry;
  }) => void;
  /** Iframe-side bridge is mounted and listening — safe to send. The
   *  bridge's protocol version is forwarded so the consumer can compare
   *  it against the editor's expected version and refuse to proceed on
   *  mismatch (see TemplateEditor's onReady). */
  onReady: (payload: { version: ProtocolVersion }) => void;
}

const COMMIT_DEBOUNCE_MS = 150;
const OPTIONS_REQUEST_TIMEOUT_MS = 10_000;

let channel: Channel<ProtocolMap> | null = null;
let args: BridgeArgs | null = null;
let serverTimer: number | null = null;

// In-flight data-source option requests, keyed by requestId. The bridge is
// fire-and-forget, so request/reply is correlated here: requestDataSourceOptions
// stores a resolver, the inbound `dataSourceOptions` handler resolves it.
interface PendingOptionRequest {
  resolve: (items: DataSourceOption[]) => void;
  timer: number;
}
const pendingOptionRequests = new Map<string, PendingOptionRequest>();

function settleOptionRequest(requestId: string, items: DataSourceOption[]): void {
  const pending = pendingOptionRequests.get(requestId);
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pendingOptionRequests.delete(requestId);
  pending.resolve(items);
}

export function registerPreviewBridge(next: BridgeArgs): void {
  // Fresh iframe incoming — close any previous channel and cancel any
  // pending commit-lane timer so an old applyConfig doesn't postMessage
  // stale state into the new iframe.
  unregisterPreviewBridge();

  channel = createChannel<ProtocolMap>({
    source: next.iframeWindow,
    allowedOrigins: [next.previewOrigin],
    targetOrigin: next.previewOrigin,
  });
  args = next;

  channel.on("select", (payload) => args?.onSelect(payload.target));
  channel.on("rendering", (payload) => {
    if (!payload.pending) args?.onCommitSettled();
  });
  channel.on("commitFailed", () => args?.onCommitFailed());
  channel.on("assets", (payload) => args?.onAssets(payload));
  channel.on("ready", (payload) => args?.onReady(payload));
  channel.on("dataSourceOptions", (payload) =>
    settleOptionRequest(payload.requestId, payload.items ?? []),
  );
}

export function unregisterPreviewBridge(): void {
  if (serverTimer !== null) {
    window.clearTimeout(serverTimer);
    serverTimer = null;
  }
  // Resolve any in-flight option requests empty so callers don't hang across
  // an iframe/template swap; the next session re-requests as needed.
  for (const [requestId] of pendingOptionRequests) {
    settleOptionRequest(requestId, []);
  }
  channel?.close();
  channel = null;
  args = null;
}

/**
 * Ask the iframe (merchant app) for a data-source dropdown list. Resolves with
 * the merchant's collections/products as `{value,label}[]`. Best-effort: an
 * empty list on timeout, missing channel, or no merchant callback wired — the
 * picker then falls back to the saved handle.
 */
export function requestDataSourceOptions(
  source: DataSourceOptionSource,
): Promise<DataSourceOption[]> {
  if (!channel) return Promise.resolve([]);
  const requestId = crypto.randomUUID();
  return new Promise<DataSourceOption[]>((resolve) => {
    const timer = window.setTimeout(
      () => settleOptionRequest(requestId, []),
      OPTIONS_REQUEST_TIMEOUT_MS,
    );
    pendingOptionRequests.set(requestId, { resolve, timer });
    channel!.send("requestDataSourceOptions", { requestId, source });
  });
}

export function commitClientWidget(
  sectionId: string,
  widgetId: string,
  settings: Record<string, unknown>,
): void {
  if (!channel || !args) return;
  const ts = args.getTs();
  if (!ts) return;
  const resolved = ts.translateObject(settings) as Record<string, unknown>;
  channel.send("patchWidget", { sectionId, widgetId, settings: resolved });
}

export function commitClientSection(
  sectionId: string,
  settings: Record<string, unknown>,
): void {
  if (!channel || !args) return;
  const ts = args.getTs();
  if (!ts) return;
  const resolved = ts.translateObject(settings) as Record<string, unknown>;
  channel.send("patchSection", { sectionId, settings: resolved });
}

// Tell the iframe to show its selection overlay on a given section
// (optionally narrowed to a widget) and scroll it into view. Fire-and-
// forget — user-initiated selection is low frequency, no debounce.
// echo:false on the iframe side; selection state is canonical here.
// Pass `null` to clear the iframe's selection (keeps it in sync when the
// editor closes the settings drawer).
export function focusSection(
  sectionId: string | null,
  widgetId?: string,
): void {
  if (!channel) return;
  channel.send("focusSection", {
    sectionId,
    ...(widgetId ? { widgetId } : {}),
  });
}

export function commitServer(pageConfig: unknown): void {
  if (serverTimer !== null) {
    window.clearTimeout(serverTimer);
  }
  serverTimer = window.setTimeout(() => {
    serverTimer = null;
    if (!channel || !args) return;
    const ts = args.getTs();
    if (!ts) return;
    const pc = pageConfig as {
      sections: {
        _chromeTemplateId?: string;
        widgets: { settings?: Record<string, unknown> }[];
      }[];
    };
    // Chrome (header/footer) sections live in pageConfig for editing but are
    // rendered by the layout, not the page body — drop them so the preview
    // doesn't double-render them. No-op on pages without chrome.
    const bodySections = pc.sections.filter((s) => !s._chromeTemplateId);
    // Pre-resolve t:-refs in every widget's settings (shared with the saved
    // preview's handlePreview) so the iframe-side render needs no translations
    // fetch — see momsco's readEditorPreviewState consumer which skips
    // translations when previewPageConfig is non-null.
    const resolved = {
      ...pc,
      sections: resolveSectionSettings(bodySections, ts),
    };
    args.onCommitFired();
    channel.send("applyConfig", { pageConfig: resolved });
  }, COMMIT_DEBOUNCE_MS);
}
