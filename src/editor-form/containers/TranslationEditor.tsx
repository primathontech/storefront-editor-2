import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import { fromCallback, fromPromise } from "xstate";
import { Editor } from "../../Editor";
import { PreviewMessage } from "../../components/PreviewMessage";
import { SidebarSkeleton } from "../../components/SidebarSkeleton";
import EditorHeader from "../components/ui/EditorHeader";
import type { ThemeStructureTemplate } from "../services/api";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { useEditorUiStore } from "../../stores/editorUiStore";
import { useTranslationStore } from "../../stores/translationStore";
import { RESPONSIVE_FRAME_STYLE } from "../utils/preview-frame-style";
import { PROTOCOL_VERSION } from "@shopkit/editor-bridge";
import {
  commitTranslationPatch,
  flushTranslationPatch,
  focusTranslationKey,
  registerTranslationBridge,
  unregisterTranslationBridge,
} from "../translation-preview-bridge";
import { translationSessionMachine } from "../../machines/translationSession";
import { EditorAPI } from "../services/api";
import { buildStaticPreviewUrl } from "../utils/preview-route";
import { ArrayInput } from "../components/ui/ArrayInput";
import { Input as DesignInput } from "../components/ui/design-system";
import { ObjectArrayInput } from "../components/ui/ObjectArrayInput";
import { RichTextInput } from "../components/ui/RichTextInput";

/**
 * Render surface for translation-only static templates (the 5 policy
 * pages). Sidebar flattens the merged translations JSON into editable
 * inputs; preview iframe loads the storefront's registry-driven
 * `/editor-preview/static` route, where EditorTranslationBridge +
 * TranslationProvider receive live patches via postMessage.
 *
 * Two distinct transitions, matching the dynamic-lane precedent:
 *
 *   - Within the same template (translation edits) → postMessage to the
 *     iframe's override store. No URL change. The iframe document stays
 *     alive; React re-runs t()/tEditable on the new translations object.
 *
 *   - Different template (or language switch) → iframe.src change →
 *     full document reload. Wipes any residue from the prior template
 *     (override store, React tree, in-flight state). A loading overlay
 *     sits on top of the iframe area from the moment src changes until
 *     two events have both arrived: (a) editor:ready from the new
 *     bridge mount, and (b) flushTranslationPatch has been posted with
 *     the new template's translations.
 *
 * Bidirectional click-to-select:
 *   - Sidebar input focus → focusTranslationKey(sectionKey) → iframe
 *     TranslationProvider draws the ring on the matching tEditable text.
 *   - Iframe tEditable onClick → editor:select-translation-key { key }
 *     → scroll the matching input into view + apply focused style.
 */
type FlatEntry = {
  path: string[];
  value: unknown;
  key: string;
  type?: "array" | "objectArray";
  fields?: string[];
};

function flattenTranslations(
  obj: unknown,
  path: string[] = [],
): FlatEntry[] {
  if (!obj || typeof obj !== "object") {
    return [];
  }
  const result: FlatEntry[] = [];
  Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
    const currentPath = [...path, key];
    if (Array.isArray(value)) {
      if (
        value.length > 0 &&
        typeof value[0] === "object" &&
        !Array.isArray(value[0])
      ) {
        result.push({
          path: currentPath,
          value,
          key,
          type: "objectArray",
          fields: Object.keys(value[0] as Record<string, unknown>),
        });
      } else {
        result.push({ path: currentPath, value, key, type: "array" });
      }
    } else if (typeof value === "object" && value !== null) {
      result.push(...flattenTranslations(value, currentPath));
    } else {
      result.push({ path: currentPath, value, key });
    }
  });
  return result;
}

interface TranslationEditorProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

export default function TranslationEditor({
  onSwitchTemplate,
}: TranslationEditorProps) {
  const previewOrigin = useAuthStore((s) => s.merchant?.previewOrigin);
  const themeId = useAuthStore((s) => s.merchant?.themeId);
  const currentTemplate = useThemeStore((s) => s.currentTemplate);
  const device = useEditorUiStore((s) => s.device);
  const setDevice = useEditorUiStore((s) => s.setDevice);
  const mode = useEditorUiStore((s) => s.mode);
  const setMode = useEditorUiStore((s) => s.setMode);

  const translations = useTranslationStore((s) => s.translations);
  const language = useThemeStore((s) => s.language);
  const updateTranslation = useTranslationStore((s) => s.updateTranslation);
  const hasUnsavedChanges = useTranslationStore((s) => s.hasUnsavedChanges);

  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Recomputes when currentTemplate.id or language changes → iframe.src
  // changes → full document reload (residue wipe). Matches dynamic-lane.
  const previewUrl =
    currentTemplate?.id && previewOrigin
      ? buildStaticPreviewUrl(previewOrigin, currentTemplate.id, language)
      : null;

  const providedMachine = useMemo(
    () =>
      translationSessionMachine.provide({
        actors: {
          fetchTranslations: fromPromise(async () => {
            const themeId = useAuthStore.getState().merchant?.themeId;
            const tmpl = useThemeStore.getState().currentTemplate;
            const lang = useThemeStore.getState().language;
            if (!themeId || !tmpl?.id) {
              throw new Error("Missing themeId or currentTemplate.id");
            }
            const [common, template] = await Promise.all([
              EditorAPI.getTranslation(themeId, "common", lang),
              EditorAPI.getTranslation(themeId, tmpl.id, lang),
            ]);
            useTranslationStore.getState().setTranslationData({
              common: common ?? {},
              template: template ?? {},
            });
          }),

          saveTranslations: fromPromise(async () => {
            const themeId = useAuthStore.getState().merchant?.themeId;
            const tmpl = useThemeStore.getState().currentTemplate;
            const s = useTranslationStore.getState();
            const lang = useThemeStore.getState().language;
            if (!themeId || !tmpl?.id) {
              throw new Error("Missing themeId or currentTemplate.id");
            }
            if (!s.hasUnsavedChanges) return;
            await Promise.all([
              EditorAPI.saveTranslation(
                themeId,
                "common",
                lang,
                s.commonTranslations,
              ),
              EditorAPI.saveTranslation(
                themeId,
                tmpl.id,
                lang,
                s.templateTranslations,
              ),
            ]);
            useTranslationStore.getState().markSaved();
          }),

          currentTemplateWatcher: fromCallback(({ sendBack }) => {
            let prevId = useThemeStore.getState().currentTemplate?.id;
            let prevLang = useThemeStore.getState().language;
            return useThemeStore.subscribe((s) => {
              const id = s.currentTemplate?.id;
              if ((id && id !== prevId) || s.language !== prevLang) {
                prevId = id;
                prevLang = s.language;
                sendBack({ type: "TEMPLATE_CHANGED" });
              }
            });
          }),
        },
      }),
    [],
  );

  const [state, send] = useMachine(providedMachine);

  const previewLoading = state.hasTag("previewLoading");

  // Scroll the focused input into view when iframe-click drives focus.
  useEffect(() => {
    if (!focusedPath || !sidebarRef.current) {
      return;
    }
    const matches = sidebarRef.current.querySelectorAll<HTMLElement>(
      "[data-section-key]",
    );
    for (const el of matches) {
      const key = el.getAttribute("data-section-key");
      if (key === focusedPath || key?.endsWith(`.${focusedPath}`)) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        break;
      }
    }
  }, [focusedPath]);

  // Register the bridge at iframe-element creation time (not on the
  // `load` event) so the parent's channel listener is attached BEFORE
  // the iframe's React mount effect fires its first `ready`. Otherwise
  // the very first ready event is dropped on the floor and the loading
  // overlay only lifts via the 5s safety timer.
  const handleIframeRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      if (!el) {
        unregisterTranslationBridge();
        return;
      }
      const win = el.contentWindow;
      if (!win || !previewOrigin) return;
      registerTranslationBridge({
        iframeWindow: win,
        previewOrigin,
        onReady: ({ version }) => {
          if (version !== PROTOCOL_VERSION) {
            // Iframe ships an incompatible @shopkit/editor-bridge. Don't
            // dispatch IFRAME_LOADED — machine stays in waitingForIframe
            // so the overlay stays up and the user can't drive an editor
            // session against a wire we can't talk to. The 5s safety net
            // eventually lifts it. Bumping the storefront's dep is the fix.
            console.warn(
              `[editor-bridge] protocol mismatch — iframe sent version ${version}, editor expects ${PROTOCOL_VERSION}. ` +
                `Bump @shopkit/editor-bridge in this merchant's storefront.`,
            );
            return;
          }
          // Flush BEFORE dispatching IFRAME_LOADED so by the time the
          // machine leaves waitingForIframe, the iframe's override store
          // is populated with resolved text instead of raw t:-keys.
          const current = useTranslationStore.getState().translations;
          const currentLang = useThemeStore.getState().language;
          if (current && Object.keys(current).length > 0) {
            flushTranslationPatch(currentLang, current);
          }
          send({ type: "IFRAME_LOADED" });
        },
        onSelectTranslationKey: (key) => setFocusedPath(key),
      });
    },
    [previewOrigin, send],
  );

  const handleChange = (path: string[], value: unknown) => {
    updateTranslation(path, value);
    // Live updates within the same template. Goes through the debounced
    // commit path → in-iframe override store. NO URL change. Gated on
    // the machine state so we don't fire while the bridge is still
    // mounting (the onReady flush covers that case).
    if (previewLoading) return;
    const t = useTranslationStore.getState().translations;
    const lang = useThemeStore.getState().language;
    commitTranslationPatch(lang, t);
  };

  const handleInputFocus = (sectionKey: string) => {
    setFocusedPath(sectionKey);
    focusTranslationKey(sectionKey);
  };

  const handleInputBlur = () => {
    setFocusedPath(null);
    focusTranslationKey(null);
  };

  const isCanvasOnlyLayout = device === "fullscreen";

  // Sidebar shows only the current template's namespace (matches old
  // submodule). common.* lives in the merged dict for iframe lookups but
  // isn't editable from the static lane.
  const templateId = currentTemplate?.id;
  const flat: FlatEntry[] = useMemo(() => {
    if (!templateId) return [];
    const templateData = translations[templateId];
    return templateData
      ? flattenTranslations({ [templateId]: templateData })
      : [];
  }, [translations, templateId]);

  // Save sub-state grouping declared in the machine via state tags.
  const saveStatus = state.hasTag("saveSaving")
    ? "saving"
    : state.hasTag("saveSaved")
      ? "saved"
      : state.hasTag("saveFailed")
        ? "failed"
        : "idle";

  // Disabled while a save is in flight OR when there's nothing to save —
  // matches the old submodule's behavior (EditorHeader2's saveDisabled
  // = isSaving || !hasUnsavedChanges). Failed states accept SAVE_REQUESTED
  // (restarts the flow) so the button stays clickable on failure as long
  // as there are still unsaved changes.
  const saveDisabled = saveStatus === "saving" || !hasUnsavedChanges;

  const header = (
    <EditorHeader
      onSwitchTemplate={onSwitchTemplate}
      device={device}
      setDevice={setDevice}
      mode={mode}
      setMode={setMode}
      saveStatus={saveStatus}
      saveDisabled={saveDisabled}
      onSave={() => send({ type: "SAVE_REQUESTED" })}
    />
  );

  const translationList = (
    <div ref={sidebarRef} className="flex-1 min-h-0 overflow-y-auto">
      {flat.length === 0 && (
        <div className="p-4 text-sm text-editor-text-muted">
          No translations for this template.
        </div>
      )}
      <div>
        {flat.map(({ path, value, key, type, fields }) => {
              const sectionKey = path.join(".");
              const isFocused =
                focusedPath === sectionKey ||
                sectionKey.endsWith(`.${focusedPath}`);
              const label = path.slice(-1)[0] || key;
              const isImageUrl = key.endsWith("__image");
              const isRichText = key.endsWith("__rich");

              const rowBase =
                "px-3 py-2 border-b border-slate-100 transition-colors";
              const focusedRing = isFocused ? "bg-blue-50" : "";

              if (type === "array") {
                return (
                  <div
                    key={sectionKey}
                    data-section-key={sectionKey}
                    className={`${rowBase} ${focusedRing}`}
                    tabIndex={0}
                    onFocus={() => handleInputFocus(sectionKey)}
                    onBlur={handleInputBlur}
                  >
                    <ArrayInput
                      value={Array.isArray(value) ? (value as unknown[]) : []}
                      onChange={(newValue) => handleChange(path, newValue)}
                      showControls
                    />
                  </div>
                );
              }

              if (type === "objectArray") {
                const arrayValue = Array.isArray(value)
                  ? (value as Array<Record<string, unknown>>)
                  : [];
                const inferredFields =
                  fields ||
                  (arrayValue.length > 0 ? Object.keys(arrayValue[0]) : []);
                return (
                  <div
                    key={sectionKey}
                    data-section-key={sectionKey}
                    className={`${rowBase} ${focusedRing}`}
                    tabIndex={0}
                    onFocus={() => handleInputFocus(sectionKey)}
                    onBlur={handleInputBlur}
                  >
                    <ObjectArrayInput
                      value={arrayValue}
                      onChange={(newValue) => handleChange(path, newValue)}
                      fields={inferredFields}
                      showControls
                    />
                  </div>
                );
              }

              return (
                <div
                  key={sectionKey}
                  data-section-key={sectionKey}
                  className={`${rowBase} ${focusedRing}`}
                >
                  {isRichText ? (
                    <RichTextInput
                      value={String(value ?? "")}
                      onChange={(newValue) => handleChange(path, newValue)}
                      label={label}
                      placeholder={`Enter content for ${label}`}
                    />
                  ) : (
                    <DesignInput
                      type="text"
                      size="md"
                      value={String(value ?? "")}
                      onChange={(e) =>
                        handleChange(path, (e.target as HTMLInputElement).value)
                      }
                      onFocus={() => handleInputFocus(sectionKey)}
                      onBlur={handleInputBlur}
                      placeholder={`Enter value for ${label}`}
                      fullWidth
                      aria-label={`Value for ${label}`}
                    />
                  )}

                  {isImageUrl && Boolean(value) && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-500 mb-1">
                        Image preview
                      </div>
                      <img
                        src={String(value)}
                        alt={`Preview of ${label}`}
                        className="max-w-full h-24 object-contain border border-slate-200 rounded"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );

  const noTemplate = !currentTemplate?.id || !themeId;
  const isBooting = state.matches("bootingTemplate");
  const isLoadError = state.matches("loadError");

  const leftSidebar = isCanvasOnlyLayout
    ? null
    : noTemplate || isBooting || isLoadError
      ? <SidebarSkeleton />
      : translationList;

  return (
    <Editor
      header={header}
      leftSidebar={leftSidebar}
      preview={
        noTemplate ? (
          <PreviewMessage label="No template selected." />
        ) : isBooting ? (
          <PreviewMessage label="Loading page…" />
        ) : isLoadError ? (
          <PreviewMessage
            label="Failed to load page."
            onRetry={() => send({ type: "RETRY" })}
          />
        ) : (
          <>
            <div className="bg-editor-canvas h-full flex justify-center">
              {previewUrl && (
                <iframe
                  ref={handleIframeRef}
                  src={previewUrl}
                  style={RESPONSIVE_FRAME_STYLE[device]}
                  title="translation preview"
                  // See TemplateEditor: `origin` keeps the editor origin reaching
                  // an http://localhost store from an HTTPS editor (the default
                  // policy strips the referrer on downgrade, breaking the bridge).
                  referrerPolicy="origin"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                />
              )}
            </div>
            {previewLoading && <PreviewMessage label="Loading preview…" />}
          </>
        )
      }
    />
  );
}
