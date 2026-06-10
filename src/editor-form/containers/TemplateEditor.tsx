import { useCallback, useMemo } from "react";
import { useMachine } from "@xstate/react";
import { fromCallback, fromPromise } from "xstate";
import { toast } from "react-hot-toast";
import { Editor } from "../../Editor";
import { PreviewMessage } from "../../components/PreviewMessage";
import { SidebarSkeleton } from "../../components/SidebarSkeleton";
import BuilderToolbar from "../components/ui/BuilderToolbar";
import EditorHeader from "../components/ui/EditorHeader";
import { SettingsSidebar } from "../components/ui/SettingsSidebar";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { useTemplateStore } from "../../stores/templateStore";
import { useEditorUiStore } from "../../stores/editorUiStore";
import { PROTOCOL_VERSION } from "@shopkit/editor-bridge";
import {
  commitServer,
  registerPreviewBridge,
  unregisterPreviewBridge,
} from "../preview-bridge";
import { EditorAPI } from "../services/api";
import { templateSessionMachine } from "../../machines/templateSession";
import type { ThemeStructureTemplate } from "../services/api";
import { RESPONSIVE_FRAME_STYLE } from "../utils/preview-frame-style";
import { buildPreviewUrl } from "../utils/preview-route";

interface TemplateEditorProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

export default function TemplateEditor({
  onSwitchTemplate,
}: TemplateEditorProps) {
  const previewOrigin = useAuthStore((s) => s.merchant?.previewOrigin);
  const currentTemplate = useThemeStore((s) => s.currentTemplate);
  const device = useEditorUiStore((s) => s.device);
  const mode = useEditorUiStore((s) => s.mode);
  const setDevice = useEditorUiStore((s) => s.setDevice);
  const setMode = useEditorUiStore((s) => s.setMode);
  const translationService = useTemplateStore((s) => s.translationService);
  const showSettingsDrawer = useTemplateStore((s) => s.showSettingsDrawer);

  const providedMachine = useMemo(
    () =>
      templateSessionMachine.provide({
        actors: {
          fetchTemplateData: fromPromise(async () => {
            const themeId = useAuthStore.getState().merchant?.themeId;
            const tmpl = useThemeStore.getState().currentTemplate;
            if (!themeId || !tmpl?.id) {
              throw new Error("Missing themeId or currentTemplate.id");
            }
            useTemplateStore.getState().reset();
            const lang = useThemeStore.getState().language;
            const [common, template, pageConfig] = await Promise.all([
              EditorAPI.getTranslation(themeId, "common", lang),
              EditorAPI.getTranslation(themeId, tmpl.id, lang),
              EditorAPI.getTemplate(themeId, tmpl.id),
            ]);
            const store = useTemplateStore.getState();
            store.setTranslationData({ common, template });
            store.setPageConfig(pageConfig);
            const sectionIds: string[] =
              (pageConfig as { sections?: { id: string }[] } | null)
                ?.sections?.map((s) => s.id) ?? [];
            store.setExpandedSections(new Set(sectionIds));
          }),

          validateHtml: fromPromise(async () => {
            await useTemplateStore.getState().validateAllHtml();
          }),

          saveTemplate: fromPromise(async () => {
            const themeId = useAuthStore.getState().merchant?.themeId;
            const tmpl = useThemeStore.getState().currentTemplate;
            const pc = useTemplateStore.getState().pageConfig;
            if (!themeId || !tmpl?.id) {
              throw new Error("Missing themeId or currentTemplate.id");
            }
            if (!pc) throw new Error("No pageConfig to save");
            const res = await EditorAPI.saveTemplate(themeId, tmpl.id, {
              metadata: {
                id: tmpl.id,
                name: tmpl.name || pc.metadata?.name || "Template",
                brand: themeId,
                type: pc.metadata?.type || "page",
                version: pc.metadata?.version || "1.0.0",
                routeContext: tmpl.routeContext,
              },
              layout: pc.layout,
              sections: pc.sections,
              dataSources: pc.dataSources,
            });
            toast.success(res.message || "Template updated successfully");
          }),

          saveTranslations: fromPromise(async () => {
            const themeId = useAuthStore.getState().merchant?.themeId;
            const tmpl = useThemeStore.getState().currentTemplate;
            const s = useTemplateStore.getState();
            const lang = useThemeStore.getState().language;
            if (!themeId || !tmpl?.id) {
              throw new Error("Missing themeId or currentTemplate.id");
            }
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
            useTemplateStore.setState({ hasUnsavedTranslations: false });
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
        actions: {
          // Fired on entry to `committingInitial`. Pushes the current
          // pageConfig through the same commit path a user edit would,
          // so the iframe lands on ?previewKey=… before the overlay
          // lifts. No visible state-change here — the machine's
          // COMMIT_SETTLED transition drives the overlay drop.
          requestInitialCommit: () => {
            const pc = useTemplateStore.getState().pageConfig;
            if (pc) commitServer(pc);
          },
        },
        guards: {
          hasValidationErrors: () => {
            const errs = useTemplateStore.getState().htmlValidationErrors;
            return Object.values(errs).some((e) => e.length > 0);
          },
        },
      }),
    [],
  );

  const [state, send] = useMachine(providedMachine);

  // Register the bridge at iframe-element creation time (not on the
  // `load` event) so the parent's channel listener is attached BEFORE
  // the iframe's React mount effect fires `assets` + `ready`. Using
  // `load` here would race and silently miss the first assets payload.
  const handleIframeRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      if (!el) {
        unregisterPreviewBridge();
        return;
      }
      const win = el.contentWindow;
      if (!win || !previewOrigin) return;
      registerPreviewBridge({
        iframeWindow: win,
        previewOrigin,
        getTs: () => useTemplateStore.getState().translationService,
        onSelect: (target) => {
          const store = useTemplateStore.getState();
          if (!target) {
            store.setSelectedSection(null);
            return;
          }
          store.setSelectedSection(target.sectionId);
          if (target.widgetId) store.setSelectedWidget(target.widgetId);
        },
        onCommitFired: () => send({ type: "COMMIT_FIRED" }),
        onCommitSettled: () => send({ type: "COMMIT_SETTLED" }),
        onCommitFailed: () => send({ type: "COMMIT_FAILED" }),
        onAssets: ({ widgetSchemas, availableSections }) => {
          useThemeStore.getState().setAssets(widgetSchemas, availableSections);
        },
        onReady: ({ version }) => {
          if (version !== PROTOCOL_VERSION) {
            // Iframe ships an incompatible @shopkit/editor-bridge. Stall
            // the boot machine (don't fire IFRAME_LOADED) so the overlay
            // stays up and the user can't drive an editor session against
            // a wire we can't talk to. Bumping the storefront's package
            // dependency is the fix.
            console.warn(
              `[editor-bridge] protocol mismatch — iframe sent version ${version}, editor expects ${PROTOCOL_VERSION}. ` +
                `Bump @shopkit/editor-bridge in this merchant's storefront.`,
            );
            return;
          }
          send({ type: "IFRAME_LOADED" });
        },
      });
    },
    [previewOrigin, send],
  );

  if (!previewOrigin || !currentTemplate) return null;

  // Save sub-state grouping declared in the machine via state tags.
  const saveStatus = state.hasTag("saveValidating")
    ? "validating"
    : state.hasTag("saveSaving")
      ? "saving"
      : state.hasTag("saveSaved")
        ? "saved"
        : state.hasTag("saveFailed")
          ? "failed"
          : "idle";

  // Disabled only while a save is in flight. Failed states accept
  // SAVE_REQUESTED (restarts the flow) so the button must stay clickable.
  const saveDisabled =
    saveStatus === "validating" || saveStatus === "saving";

  const isCommitting = state.matches({ editing: { preview: "committing" } });
  const previewLoading = state.hasTag("previewLoading");
  const previewUrl = buildPreviewUrl(
    previewOrigin,
    currentTemplate.routeContext?.path,
  );

  const isBooting = state.matches("bootingTemplate");
  const isLoadError = state.matches("loadError");

  return (
    <Editor
      header={
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
      }
      leftSidebar={
        isBooting || isLoadError ? (
          <SidebarSkeleton />
        ) : (
          <BuilderToolbar key={currentTemplate.id} />
        )
      }
      preview={
        isBooting ? (
          <PreviewMessage label="Loading page…" />
        ) : isLoadError ? (
          <PreviewMessage
            label="Failed to load page."
            onRetry={() => send({ type: "RETRY" })}
          />
        ) : (
          <>
            <div className="bg-editor-canvas h-full flex justify-center">
              <div
                className="absolute top-0 left-0 right-0 h-0.75 overflow-hidden pointer-events-none z-10"
                aria-hidden
              >
                <div
                  className="h-full w-1/3 bg-linear-to-r from-blue-500 via-sky-400 to-blue-600 transition-opacity duration-150"
                  style={{
                    opacity: isCommitting ? 1 : 0,
                    animation: isCommitting
                      ? "editorPreviewProgress 1.2s ease-in-out infinite"
                      : "none",
                  }}
                />
              </div>
              <iframe
                ref={handleIframeRef}
                src={previewUrl}
                style={RESPONSIVE_FRAME_STYLE[device]}
                title="preview"
                // dev/QA only (VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE): when the
                // editor previews an http://localhost store, the HTTPS→http
                // downgrade strips the referrer under the default policy, so the
                // iframe-side bridge gate (resolveEditorOrigin) can't identify
                // the editor. `origin` survives the downgrade and sends only the
                // origin (no token leak). Prod keeps the secure default.
                referrerPolicy={
                  import.meta.env.VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE === "true"
                    ? "origin"
                    : undefined
                }
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
              />
            </div>
            {previewLoading && <PreviewMessage label="Loading preview…" />}
          </>
        )
      }
      rightSidebar={
        showSettingsDrawer ? (
          <SettingsSidebar translationService={translationService} />
        ) : undefined
      }
    />
  );
}

