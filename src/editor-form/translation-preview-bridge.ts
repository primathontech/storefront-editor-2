import {
  createChannel,
  type Channel,
  type ProtocolMap,
  type ProtocolVersion,
} from "@shopkit/editor-bridge";

/**
 * Editor-side of the translation (static-template) lane bridge. Twin
 * of preview-bridge.ts but for the deprecated static-template lane —
 * patches the iframe's TranslationProvider via the override store
 * exposed by @shopkit/editor-bridge.
 *
 * Wire:
 *   editor -> iframe : patchTranslations { language, translations }
 *                       focusTranslationKey { key }
 *   iframe -> editor : ready (mount signal — TranslationEditor uses it
 *                              to lift its loading overlay and flush
 *                              the latest translations across)
 *                       selectTranslationKey { key } (tEditable click)
 *
 * Template switching: handled at the consumer (TranslationEditor) via
 * iframe.src recomputation — full document reload wipes residue. This
 * module unregisters the previous channel + cancels pending debounced
 * commits on every register.
 *
 * @deprecated Lives only to serve the static-template lane while it
 * exists. When static templates retire, delete this file alongside
 * the @shopkit/editor-bridge `/static` subpath.
 */

interface TranslationBridgeArgs {
  iframeWindow: Window;
  previewOrigin: string;
  /** Iframe-side bridge mounted and listening — caller uses this to
   *  flush the current translations across and lift its loading overlay.
   *  The bridge's protocol version is forwarded so the consumer can
   *  compare it against the editor's expected version and refuse to
   *  proceed on mismatch. */
  onReady: (payload: { version: ProtocolVersion }) => void;
  /** Iframe tEditable click → key, or null on blur. Caller uses this to
   *  scroll the matching sidebar input into view. */
  onSelectTranslationKey: (key: string | null) => void;
}

const COMMIT_DEBOUNCE_MS = 150;

let channel: Channel<ProtocolMap> | null = null;
let patchTimer: number | null = null;

export function registerTranslationBridge(args: TranslationBridgeArgs): void {
  unregisterTranslationBridge();

  channel = createChannel<ProtocolMap>({
    source: args.iframeWindow,
    allowedOrigins: [args.previewOrigin],
    targetOrigin: args.previewOrigin,
  });

  channel.on("ready", (payload) => args.onReady(payload));
  channel.on("selectTranslationKey", (payload) =>
    args.onSelectTranslationKey(payload.key),
  );
}

export function unregisterTranslationBridge(): void {
  channel?.close();
  channel = null;
  if (patchTimer !== null) {
    window.clearTimeout(patchTimer);
    patchTimer = null;
  }
}

export function commitTranslationPatch(
  language: string,
  translations: Record<string, unknown>,
): void {
  if (patchTimer !== null) {
    window.clearTimeout(patchTimer);
  }
  patchTimer = window.setTimeout(() => {
    patchTimer = null;
    if (!channel) return;
    channel.send("patchTranslations", { language, translations });
  }, COMMIT_DEBOUNCE_MS);
}

/**
 * Skip-debounce variant. Used at iframe-load time so the override store
 * is populated before TranslationEditor lifts its loading overlay —
 * the editor's overlay sits on top until this flush has been posted
 * AND the bridge's ready event has been received.
 */
export function flushTranslationPatch(
  language: string,
  translations: Record<string, unknown>,
): void {
  if (patchTimer !== null) {
    window.clearTimeout(patchTimer);
    patchTimer = null;
  }
  if (!channel) return;
  channel.send("patchTranslations", { language, translations });
}

// Fire-and-forget — sidebar focus is user-initiated, low frequency.
export function focusTranslationKey(key: string | null): void {
  if (!channel) return;
  channel.send("focusTranslationKey", { key });
}
