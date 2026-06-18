import { useCallback, useMemo, useState } from "react";
import { useMachine } from "@xstate/react";
import { fromCallback, fromPromise } from "xstate";
import { toast } from "react-hot-toast";
import { Editor } from "../../Editor";
import { PreviewMessage } from "../../components/PreviewMessage";
import { SidebarSkeleton } from "../../components/SidebarSkeleton";
import BuilderToolbar from "../components/ui/BuilderToolbar";
import EditorHeader from "../components/ui/EditorHeader";
import { PreviewLinkModal } from "../components/ui/PreviewLinkModal";
import { SettingsSidebar } from "../components/ui/SettingsSidebar";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { useTemplateStore } from "../../stores/templateStore";
import { useEditorUiStore } from "../../stores/editorUiStore";
import { PROTOCOL_VERSION } from "@shopkit/editor-bridge";
import {
  commitClientSection,
  commitClientWidget,
  commitServer,
  registerPreviewBridge,
  unregisterPreviewBridge,
} from "../preview-bridge";
import { EditorAPI } from "../services/api";
import { templateSessionMachine } from "../../machines/templateSession";
import type { PreviewEnv,ThemeStructure, ThemeStructureTemplate } from "../services/api";
import { RESPONSIVE_FRAME_STYLE } from "../utils/preview-frame-style";
import { buildPreviewUrl } from "../utils/preview-route";

// Find the header/footer template IDs from the theme structure. Chrome
// templates are tagged by routeContext.type ("header"/"footer").
function findChromeTemplateIds(theme: ThemeStructure | null): {
  header?: string;
  footer?: string;
} {
  const ids: { header?: string; footer?: string } = {};
  for (const group of theme?.templateStructure ?? []) {
    for (const t of group.templates ?? []) {
      const tag = t.routeContext?.type ?? t.routeContext?.templateName;
      if (tag === "header" && t.id) ids.header = t.id;
      else if (tag === "footer" && t.id) ids.footer = t.id;
    }
  }
  return ids;
}

// Chrome (header/footer) sections are spliced into pageConfig.sections so the
// existing sidebar / settings / edit machinery handles them with no special-
// casing. Each carries `_chromeTemplateId` (which template it round-trips to,
// so commitServer drops it from the page-body preview and saveTemplate routes
// it back) and `_chromeRole` (header vs footer — the sidebar groups on this
// instead of guessing from the template-id string, which themes may name
// arbitrarily). Both tags are stripped before saving.
function tagChromeSections(
  config: any,
  templateId: string | undefined,
  role: "header" | "footer",
): any[] {
  if (!config?.sections || !templateId) return [];
  return config.sections.map((s: any) => ({
    ...s,
    _chromeTemplateId: templateId,
    _chromeRole: role,
  }));
}

// header on top, page body in the middle, footer at the bottom — matching how
// they render on the storefront.
function mergeChromeIntoPage(
  pageConfig: any,
  header: { config: any; id?: string },
  footer: { config: any; id?: string },
): any {
  if (!pageConfig) return pageConfig;
  return {
    ...pageConfig,
    sections: [
      ...tagChromeSections(header.config, header.id, "header"),
      ...(pageConfig.sections ?? []),
      ...tagChromeSections(footer.config, footer.id, "footer"),
    ],
  };
}

interface TemplateEditorProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

// Environment tier the preview snapshot renders against (preview doc §1:
// local | sandbox | production). There's no env selector yet (doc §5.2 is a
// later pass), so default to production and drop to local only on the dev/QA
// editor build — the same gate the preview-origin override uses.
const PREVIEW_ENV: PreviewEnv =
  import.meta.env.VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE === "true"
    ? "local"
    : "production";

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
  const hasUnsavedChanges = useTemplateStore((s) => s.hasUnsavedChanges);
  const hasUnsavedTranslations = useTemplateStore(
    (s) => s.hasUnsavedTranslations,
  );
  const activePreviewId = useTemplateStore((s) => s.activePreviewId);
  const [creatingPreview, setCreatingPreview] = useState(false);
  const [previewLink, setPreviewLink] = useState<{
    url: string;
    version: number | null;
  } | null>(null);

  // "Save and Preview": save the current (unsaved) pageConfig as the template's
  // working DRAFT and open the shareable link. The first save mints an opaque
  // previewId (the session); subsequent saves reuse it (new version each time).
  // The editor resumes this draft on reload — it is NOT yet published to the
  // live/production template (that's the Publish button). Reads from store
  // getState() so the payload is the freshest edit.
  const handlePreview = useCallback(async () => {
    const themeId = useAuthStore.getState().merchant?.themeId;
    const tmpl = useThemeStore.getState().currentTemplate;
    const pageConfig = useTemplateStore.getState().pageConfig;
    const language = useThemeStore.getState().language;
    // Reuse the active session id if one exists; else the backend mints one.
    const activePreviewId = useTemplateStore.getState().activePreviewId;
    if (!themeId || !tmpl?.id || !pageConfig) {
      toast.error("Can't save preview — template isn't ready yet.");
      return;
    }
    // Split the merged editing config back into its real templates, mirroring
    // saveTemplate. Chrome (header/footer) sections are spliced into pageConfig
    // for editing (mergeChromeIntoPage) but belong to their OWN templates and
    // are rendered separately by the storefront layout (renderChrome). The
    // preview must store them the same way:
    //   • page-body sections  → the current template's preview (no chrome, so
    //     the layout's chrome isn't doubled and nothing accumulates per version)
    //   • each chrome group    → a preview for ITS template (dawn_header_default
    //     / dawn_footer_default) under the SAME previewId, so renderChrome
    //     resolves the edited header/footer in preview mode.
    const chromeConfigs = useTemplateStore.getState().chromeConfigs;
    // Pre-resolve t:-refs in every widget's settings before saving — exactly
    // what commitServer does for the LIVE preview. Translation-backed fields
    // (header logo image t:common.header.logoPath, nav links/dropdowns, etc.)
    // are edited into the DRAFT translations, which are only written live on
    // Publish. The preview snapshot stores pageConfig, not translations, so
    // saving raw t:-refs makes the storefront resolve them against the STALE
    // live translations — the edited image/menu wouldn't show until publish.
    // Resolving here bakes the current draft values into the snapshot.
    const ts = useTemplateStore.getState().translationService;
    const resolveSections = (sections: unknown[]): unknown[] =>
      ts
        ? sections.map((s) => {
            const sec = s as {
              widgets?: { settings?: Record<string, unknown> }[];
            };
            return {
              ...sec,
              widgets: (sec.widgets ?? []).map((w) => ({
                ...w,
                settings: ts.translateObject(
                  w.settings ?? {},
                ) as Record<string, unknown>,
              })),
            };
          })
        : sections;

    const bodySections: unknown[] = [];
    const chromeByTemplate = new Map<string, unknown[]>();
    for (const section of (pageConfig.sections ?? []) as {
      _chromeTemplateId?: string;
      _chromeRole?: string;
    }[]) {
      const chromeId = section._chromeTemplateId;
      if (chromeId) {
        const clean = { ...section };
        delete clean._chromeTemplateId;
        delete clean._chromeRole;
        chromeByTemplate.set(chromeId, [
          ...(chromeByTemplate.get(chromeId) ?? []),
          clean,
        ]);
      } else {
        bodySections.push(section);
      }
    }
    // pageConfig = RESOLVED (what the storefront renders); metadata.rawPageConfig
    // = the unresolved (t:-ref) config the editor resumes from, so reload keeps
    // the i18n model and a later Publish writes t:-refs + translations, never
    // baked literals.
    const bodyPageConfig = {
      ...pageConfig,
      sections: resolveSections(bodySections),
    };
    const rawBodyPageConfig = { ...pageConfig, sections: bodySections };

    setCreatingPreview(true);
    try {
      // Save the page body first — this establishes (or reuses) the previewId
      // that the chrome previews then share.
      // Snapshot the draft translations alongside the body preview so reload
      // restores t:-backed edits (header logo/nav text live in COMMON; page
      // text in TEMPLATE). Without this, resume reads live translations and
      // every t:-ref field reverts. Stored on the body preview (the resume
      // anchor); chrome text resolves from the shared common slice.
      const { commonTranslations, templateTranslations } =
        useTemplateStore.getState();
      const { previewId, url, version } = await EditorAPI.getPreviewLink({
        themeId,
        templateId: tmpl.id,
        previewId: activePreviewId ?? undefined,
        routeContext: tmpl.routeContext,
        env: PREVIEW_ENV,
        language,
        pageConfig: bodyPageConfig,
        metadata: {
          rawPageConfig: rawBodyPageConfig,
          translations: {
            common: commonTranslations,
            template: templateTranslations,
          },
        },
      });
      // Persist each edited chrome template's preview under the same previewId,
      // preserving that template's own layout/dataSources and swapping in the
      // edited sections. Best-effort — a chrome failure must not lose the page
      // preview the user asked for.
      await Promise.all(
        Array.from(chromeByTemplate, ([chromeId, sections]) =>
          EditorAPI.getPreviewLink({
            themeId,
            templateId: chromeId,
            previewId,
            env: PREVIEW_ENV,
            language,
            pageConfig: {
              ...(chromeConfigs[chromeId] ?? {}),
              sections: resolveSections(sections),
            },
            metadata: {
              rawPageConfig: { ...(chromeConfigs[chromeId] ?? {}), sections },
            },
          }).catch((e) =>
            console.warn(`Chrome preview save failed for ${chromeId}`, e),
          ),
        ),
      );
      // Bind the (possibly new) session id and clear the dirty flag so the
      // editor reflects a saved state (it reloads this same draft next time).
      useTemplateStore.setState({
        hasUnsavedChanges: false,
        activePreviewId: previewId,
      });
      // Surface the shareable link in a modal (open-in-tab / copy actions).
      setPreviewLink({ url, version });
    } catch (err) {
      console.error("getPreviewLink failed", err);
      toast.error("Couldn't save the preview.");
    } finally {
      setCreatingPreview(false);
    }
  }, []);

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
            // Load shared header/footer (their own DB templates) alongside the
            // page and splice their sections into pageConfig — see
            // mergeChromeIntoPage. Best-effort: missing rows → page only.
            const chrome = findChromeTemplateIds(
              useThemeStore.getState().theme,
            );
            const [
              common,
              template,
              draft,
              livePageConfig,
              headerLive,
              footerLive,
              headerDraft,
              footerDraft,
            ] = await Promise.all([
              EditorAPI.getTranslation(themeId, "common", lang),
              EditorAPI.getTranslation(themeId, tmpl.id, lang),
              // Resume the active "Save and Preview" draft if one exists…
              EditorAPI.getLatestPreview(themeId, tmpl.id),
              EditorAPI.getTemplate(themeId, tmpl.id),
              chrome.header
                ? EditorAPI.getTemplate(themeId, chrome.header).catch(() => null)
                : Promise.resolve(null),
              chrome.footer
                ? EditorAPI.getTemplate(themeId, chrome.footer).catch(() => null)
                : Promise.resolve(null),
              // …and resume the header/footer drafts too, so chrome edits saved
              // via "Save and Preview" reappear on reload (the body already does
              // this above). Chrome is saved as its own per-template preview.
              chrome.header
                ? EditorAPI.getLatestPreview(themeId, chrome.header).catch(
                    () => null,
                  )
                : Promise.resolve(null),
              chrome.footer
                ? EditorAPI.getLatestPreview(themeId, chrome.footer).catch(
                    () => null,
                  )
                : Promise.resolve(null),
            ]);
            // Resume from the RAW (t:-ref-preserving) snapshot stashed in
            // metadata, not the resolved pageConfig the storefront renders —
            // so editing/Publish keep the i18n template model. Falls back to
            // pageConfig (older drafts) then live.
            const draftRaw = (m: { rawPageConfig?: unknown } | null | undefined) =>
              m?.rawPageConfig;
            const pageConfig =
              draftRaw(draft?.metadata) ?? draft?.pageConfig ?? livePageConfig;
            // Draft-preferred chrome for editing/preview; falls back to live.
            const headerCfg =
              draftRaw(headerDraft?.metadata) ??
              headerDraft?.pageConfig ??
              headerLive;
            const footerCfg =
              draftRaw(footerDraft?.metadata) ??
              footerDraft?.pageConfig ??
              footerLive;
            const merged = mergeChromeIntoPage(
              pageConfig,
              { config: headerCfg, id: chrome.header },
              { config: footerCfg, id: chrome.footer },
            );
            const store = useTemplateStore.getState();
            // Resume the draft's translations when present, so t:-backed edits
            // (logo, nav text, search placeholder, …) reappear on reload. Fall
            // back to live for older drafts / first load. Common drives the
            // chrome (header/footer) text; template drives the page text.
            const draftT = draft?.metadata?.translations;
            store.setTranslationData({
              common: draftT?.common ?? common,
              template: draftT?.template ?? template,
            });
             if (draft) {
              useTemplateStore.setState({ activePreviewId: draft.previewId });
            }
            store.setPageConfig(merged);
            // Snapshot the LIVE chrome sections as the baseline so saveTemplate
            // only rewrites a header/footer template that actually differs from
            // live — and, crucially, so a resumed DRAFT edit (headerCfg above)
            // is seen as a change to publish (baseline = live, not the draft).
            const chromeSections = (cfg: unknown): unknown[] =>
              (cfg as { sections?: unknown[] } | null)?.sections ?? [];
            const chromeBaseline: Record<string, string> = {};
            if (chrome.header)
              chromeBaseline[chrome.header] = JSON.stringify(
                chromeSections(headerLive),
              );
            if (chrome.footer)
              chromeBaseline[chrome.footer] = JSON.stringify(
                chromeSections(footerLive),
              );
            store.setChromeBaseline(chromeBaseline);
            // Keep each chrome template's FULL config (layout/dataSources +
            // sections) so "Save and Preview" can persist a per-chrome preview
            // that preserves dataSources while swapping in the edited sections.
            const chromeConfigs: Record<string, Record<string, unknown>> = {};
            if (chrome.header && headerCfg)
              chromeConfigs[chrome.header] = headerCfg as Record<string, unknown>;
            if (chrome.footer && footerCfg)
              chromeConfigs[chrome.footer] = footerCfg as Record<string, unknown>;
            store.setChromeConfigs(chromeConfigs);
            const sectionIds: string[] =
              (merged as { sections?: { id: string }[] } | null)
                ?.sections?.map((s) => s.id) ?? [];
            store.setExpandedSections(new Set(sectionIds));
          }),

          validateHtml: fromPromise(async () => {
            await useTemplateStore.getState().validateAllHtml();
          }),

          // Publish: write the current pageConfig to the live/production
          // template, then PURGE the merchant's ENTIRE preview session (every
          // template under its single previewId). After publish there is no
          // draft — a reload (or any preview link to the purged id) falls back
          // to live, so preview == live, and the next edit mints a fresh
          // previewId.
          saveTemplate: fromPromise(async () => {
            const themeId = useAuthStore.getState().merchant?.themeId;
            const tmpl = useThemeStore.getState().currentTemplate;
            const pc = useTemplateStore.getState().pageConfig;
            if (!themeId || !tmpl?.id) {
              throw new Error("Missing themeId or currentTemplate.id");
            }
            if (!pc) throw new Error("No pageConfig to save");

            // Split the merged sections: page sections save to the current
            // template; chrome sections save back to their own (header/footer)
            // templates. The `_chromeTemplateId` tag is stripped before saving.
            const pageSections: any[] = [];
            const chromeByTemplate = new Map<string, any[]>();
            for (const section of (pc.sections ?? []) as any[]) {
              const chromeId: string | undefined = section._chromeTemplateId;
              if (chromeId) {
                const clean = { ...section };
                delete clean._chromeTemplateId;
                delete clean._chromeRole;
                chromeByTemplate.set(chromeId, [
                  ...(chromeByTemplate.get(chromeId) ?? []),
                  clean,
                ]);
              } else {
                pageSections.push(section);
              }
            }

            const theme = useThemeStore.getState().theme;
            const findEntry = (
              id: string,
            ): ThemeStructureTemplate | undefined =>
              theme?.templateStructure
                ?.flatMap((g) => g.templates ?? [])
                .find((t) => t.id === id);

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
              sections: pageSections,
              dataSources: pc.dataSources,
            });
            // Purge the merchant's whole preview session now that it's live.
            // By merchant (not previewId) so it clears regardless of which
            // template is open. Best-effort — must not fail the publish.
            try {
              await EditorAPI.deleteMerchantPreviews(themeId);
            } catch (e) {
              console.warn("Preview purge after publish failed", e);
            }
            useTemplateStore.setState({
              hasUnsavedChanges: false,
              activePreviewId: null,
            });

            // Persist only the chrome (header/footer) templates the user
            // actually edited — compare against the loaded baseline so a
            // page-only save leaves untouched header/footer rows alone.
            const baseline = useTemplateStore.getState().chromeBaseline;
            const nextBaseline = { ...baseline };
            for (const [chromeId, sections] of chromeByTemplate) {
              const serialized = JSON.stringify(sections);
              if (serialized === baseline[chromeId]) continue;
              const entry = findEntry(chromeId);
              await EditorAPI.saveTemplate(themeId, chromeId, {
                metadata: {
                  id: chromeId,
                  name: entry?.name || chromeId,
                  brand: themeId,
                  type: entry?.routeContext?.type || "header",
                  version: "1.0.0",
                  routeContext: entry?.routeContext,
                },
                sections,
                dataSources: {},
              });
              // Advance the baseline so a later page-only save doesn't
              // re-persist this now-saved chrome template again.
              nextBaseline[chromeId] = serialized;
            }
            useTemplateStore.getState().setChromeBaseline(nextBaseline);
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
            if (!pc) return;
            commitServer(pc);
            // Push chrome (header/footer) to the iframe too. In editor mode the
            // iframe renders chrome from the LIVE templates (it doesn't resolve
            // previews — that's only the shareable ?editorPreview link), and
            // commitServer's applyConfig carries the page BODY only. So a
            // resumed DRAFT's chrome wouldn't show until the user re-edited it.
            // Patch each chrome section/widget (t:-refs resolved by the bridge)
            // so the iframe reflects the draft header/footer immediately; the
            // body soft-nav doesn't re-render the layout, so these persist.
            for (const section of (pc.sections ?? []) as {
              id: string;
              _chromeTemplateId?: string;
              settings?: Record<string, unknown>;
              widgets?: { id: string; settings?: Record<string, unknown> }[];
            }[]) {
              if (!section._chromeTemplateId) continue;
              commitClientSection(section.id, section.settings ?? {});
              for (const widget of section.widgets ?? []) {
                commitClientWidget(
                  section.id,
                  widget.id,
                  widget.settings ?? {},
                );
              }
            }
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

  // Preview is only meaningful with in-progress edits to snapshot. Disable
  // it with no unsaved changes, while a snapshot is in flight, or mid-save
  // (a preview taken during a save would capture an ambiguous state).
  const previewDisabled =
    (!hasUnsavedChanges && !hasUnsavedTranslations) ||
    creatingPreview ||
    saveDisabled;

  const isCommitting = state.matches({ editing: { preview: "committing" } });
  const previewLoading = state.hasTag("previewLoading");
  // Carry the active "Save and Preview" draft id into the iframe URL so the
  // INITIAL render resolves the draft (no live→draft flip on reload). The
  // iframe mounts only after boot, by which point fetchTemplateData has set
  // activePreviewId, so the very first paint already has it. Reused id ⇒ stable
  // URL (no reload on subsequent saves); cleared on publish ⇒ reloads to live.
  const previewUrl = buildPreviewUrl(
    previewOrigin,
    currentTemplate.routeContext?.path,
    activePreviewId ? { previewId: activePreviewId } : undefined,
  );

  const isBooting = state.matches("bootingTemplate");
  const isLoadError = state.matches("loadError");

  return (
    <>
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
          onPreview={handlePreview}
          previewDisabled={previewDisabled}
          previewLoading={creatingPreview}
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
      <PreviewLinkModal
        isOpen={!!previewLink}
        url={previewLink?.url ?? ""}
        version={previewLink?.version ?? null}
        onClose={() => setPreviewLink(null)}
      />
    </>
  );
}

