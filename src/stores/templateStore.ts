import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { TranslationService } from "@shopkit/i18n";
import {
  commitClientSection,
  commitClientWidget,
  commitServer,
} from "../editor-form/preview-bridge";
import { sectionRegistry } from "../editor-form/schemas/section-registry";
import {
  buildTranslationService,
  createSectionTranslations as buildSectionTranslations,
  deepMerge,
  flattenPaths,
  processSectionWidgets,
  setValueByPath,
} from "../editor-form/utils/translation-utils";
import { useThemeStore } from "./themeStore";

// Template-scoped editing data — data layer for templateSessionMachine
// and the dynamic-template lane. Self-contained: no imports from
// useEditorState or dualTranslationStore.

export interface HtmlValidationError {
  line: number;
  column: number;
  message: string;
}

export interface TemplateStore {
  // ---- Data ----
  pageConfig: any | null;

  // True once the user makes any structural pageConfig edit (section /
  // widget / data-source). Reset on load (`reset`) and after a successful
  // save. Gates the header's "Preview" action — a shareable preview is only
  // worth taking once there are in-progress changes to snapshot.
  hasUnsavedChanges: boolean;

  // The opaque id of the current preview session for the loaded template, or
  // null when none exists. "Save and Preview" reuses it (new version each
  // time); resumed from the backend on load; cleared on publish (which purges
  // the session) so the next preview starts a fresh id.
  activePreviewId: string | null;
  // Serialized (JSON) snapshot of each chrome (header/footer) template's
  // sections as last loaded/saved, keyed by template id. saveTemplate
  // compares the current chrome sections against this so a page-only edit
  // doesn't rewrite untouched header/footer templates.
  chromeBaseline: Record<string, string>;
  // Full chrome (header/footer) template pageConfigs as last loaded, keyed by
  // template id. Lets "Save and Preview" persist a per-chrome preview snapshot
  // that preserves the template's own layout/dataSources while swapping in the
  // edited sections — so the storefront's renderChrome resolves the edited
  // header/footer in preview mode.
  chromeConfigs: Record<string, Record<string, unknown>>;

  // ---- Translations (self-contained — no dualTranslationStore) ----
  // `language` lives in themeStore (theme-level per Lakshya contract).
  // Translation slices below are written by fetchTemplateData and
  // updateTranslation; the subscribe block at the bottom of this file
  // rebuilds translationService from (these slices + themeStore.language).
  commonTranslations: Record<string, any>;
  templateTranslations: Record<string, any>;
  translationSourceMap: Map<string, "common" | "template">;
  hasUnsavedTranslations: boolean;
  // Derived from common + template + language. Rebuilt by every
  // translation-mutating action so preview-bridge always reads fresh
  // via templateStore.getState().translationService.
  translationService: TranslationService | null;

  // ---- Selection / sidebar ----
  selectedSectionId: string | null;
  selectedWidgetId: string | null;
  expandedSections: Set<string>;
  showSettingsDrawer: boolean;

  // ---- Validation ----
  htmlValidationErrors: Record<string, HtmlValidationError[]>;

  // ---- Setters (write-only state) ----
  setPageConfig: (config: any) => void;
  setChromeBaseline: (baseline: Record<string, string>) => void;
  setChromeConfigs: (configs: Record<string, Record<string, unknown>>) => void;
  setSelectedSection: (id: string | null) => void;
  setSelectedWidget: (id: string | null) => void;
  toggleSectionExpansion: (sectionId: string) => void;
  setShowSettingsDrawer: (show: boolean) => void;
  setExpandedSections: (expandedSections: Set<string>) => void;
  setHtmlValidationErrors: (
    sectionId: string,
    errors: HtmlValidationError[],
  ) => void;
  clearHtmlValidationErrors: (sectionId: string) => void;
  reset: () => void;

  // ---- Translation actions ----
  setTranslationData: (args: {
    common: Record<string, any>;
    template: Record<string, any>;
  }) => void;
  updateTranslation: (path: string[], value: any) => void;
  createSectionTranslations: (args: {
    translationKeys: string[];
    defaultTranslations: Record<string, Record<string, any>>;
    oldSectionPattern: string;
    newSectionKey: string;
  }) => void;
  removeSectionTranslations: (sectionId: string) => void;

  // ---- Edit actions (fire preview-bridge commits) ----
  updateSection: (sectionId: string, updates: any) => void;
  updateSectionSettings: (sectionId: string, key: string, value: any) => void;
  setSectionVisibility: (
    sectionId: string,
    breakpoint: "mobile" | "tablet" | "desktop",
    visible: boolean,
  ) => void;
  updateWidget: (sectionId: string, widgetId: string, updates: any) => void;
  updateWidgetSettings: (
    sectionId: string,
    widgetId: string,
    key: string,
    value: any,
  ) => void;

  addSection: (
    section: any,
    insertIndex?: number,
    extraDataSources?: Record<string, any>,
  ) => void;
  addSectionFromLibrary: (
    libraryKey: string,
    insertAfterIndex?: number | null,
  ) => void;
  removeSection: (sectionId: string) => void;
  removeWidget: (sectionId: string, widgetId: string) => void;
  moveSection: (fromId: string, toId: string) => void;

  addDataSource: (key: string, type: string, params?: any) => void;
  updateDataSource: (key: string, updates: any) => void;
  removeDataSource: (key: string) => void;

  // ---- Async ----
  validateAllHtml: () => Promise<void>;
  validateSection: (sectionId: string, html: string) => Promise<void>;

  // ---- Read-side helpers ----
  getSelectedSection: () => any;
  getSelectedWidget: () => any;
  getSelectedSectionSchema: () => any;
  getSelectedWidgetSchema: () => any;
}

export const useTemplateStore = create<TemplateStore>()(
  devtools(
    (set, get) => ({
      pageConfig: null,
      hasUnsavedChanges: false,
      activePreviewId: null,
      chromeBaseline: {},
      chromeConfigs: {},

      commonTranslations: {},
      templateTranslations: {},
      translationSourceMap: new Map(),
      hasUnsavedTranslations: false,
      translationService: null,

      selectedSectionId: null,
      selectedWidgetId: null,
      expandedSections: new Set<string>(),
      showSettingsDrawer: false,
      htmlValidationErrors: {},

      // -- Setters --
      setPageConfig: (config) => set({ pageConfig: config }),
      setChromeBaseline: (baseline) => set({ chromeBaseline: baseline }),
      setChromeConfigs: (configs) => set({ chromeConfigs: configs }),

      setSelectedSection: (id) =>
        set({
          selectedSectionId: id,
          selectedWidgetId: null,
          showSettingsDrawer: id !== null,
        }),

      setSelectedWidget: (id) =>
        set({
          selectedWidgetId: id,
          showSettingsDrawer: id !== null,
        }),

      toggleSectionExpansion: (sectionId) =>
        set((state) => {
          const next = new Set(state.expandedSections);
          if (next.has(sectionId)) {
            next.delete(sectionId);
          } else {
            next.add(sectionId);
          }
          return { expandedSections: next };
        }),

      setShowSettingsDrawer: (show) => set({ showSettingsDrawer: show }),
      setExpandedSections: (expandedSections) => set({ expandedSections }),

      setHtmlValidationErrors: (sectionId, errors) =>
        set((state) => ({
          htmlValidationErrors: {
            ...state.htmlValidationErrors,
            [sectionId]: errors,
          },
        })),

      clearHtmlValidationErrors: (sectionId) =>
        set((state) => {
          const { [sectionId]: _drop, ...rest } = state.htmlValidationErrors;
          return { htmlValidationErrors: rest };
        }),

      // Editor-wide UI prefs (mode, device) live in editorUiStore so
      // they survive lane / template switches without special-casing here.
      reset: () =>
        set({
          pageConfig: null,
          hasUnsavedChanges: false,
          activePreviewId: null,
          chromeBaseline: {},
          chromeConfigs: {},
          selectedSectionId: null,
          selectedWidgetId: null,
          expandedSections: new Set<string>(),
          showSettingsDrawer: false,
          htmlValidationErrors: {},
          commonTranslations: {},
          templateTranslations: {},
          translationSourceMap: new Map(),
          hasUnsavedTranslations: false,
          translationService: null,
        }),

      // -- Translation actions --
      //
      // Actions mutate (commonTranslations, templateTranslations,
      // language, sourceMap) only. translationService is derived
      // automatically by the subscribe block at the bottom of this file
      // — single source of truth for the rebuild rule.
      setTranslationData: ({ common, template }) => {
        const sourceMap = new Map<string, "common" | "template">();
        flattenPaths(common).forEach((p) =>
          sourceMap.set(p.join("."), "common"),
        );
        flattenPaths(template).forEach((p) =>
          sourceMap.set(p.join("."), "template"),
        );
        set({
          commonTranslations: common,
          templateTranslations: template,
          translationSourceMap: sourceMap,
          hasUnsavedTranslations: false,
        });
      },

      updateTranslation: (path, value) =>
        set((state) => {
          const pathKey = path.join(".");
          const source = state.translationSourceMap.get(pathKey) || "template";
          if (source === "common") {
            return {
              commonTranslations: setValueByPath(
                state.commonTranslations,
                path,
                value,
              ),
              hasUnsavedTranslations: true,
            };
          }
          return {
            templateTranslations: setValueByPath(
              state.templateTranslations,
              path,
              value,
            ),
            hasUnsavedTranslations: true,
          };
        }),

      createSectionTranslations: ({
        translationKeys,
        defaultTranslations,
        oldSectionPattern,
        newSectionKey,
      }) =>
        set((state) => {
          const newTranslations = buildSectionTranslations(
            translationKeys,
            defaultTranslations,
            useThemeStore.getState().language,
            oldSectionPattern,
            newSectionKey,
          );
          const nextSourceMap = new Map(state.translationSourceMap);
          flattenPaths(newTranslations).forEach((p) =>
            nextSourceMap.set(p.join("."), "template"),
          );
          return {
            templateTranslations: deepMerge(
              state.templateTranslations,
              newTranslations,
            ),
            translationSourceMap: nextSourceMap,
            hasUnsavedTranslations: true,
          };
        }),

      removeSectionTranslations: (sectionId) =>
        set((state) => {
          const uniqueSectionKey = sectionId.replace(/-/g, "_");
          const sectionPath = `sections.${uniqueSectionKey}`;

          // sourceMap may have entries even when templateTranslations
          // subtree is absent (e.g. all values were in common). Always
          // sweep sourceMap; mutate templateTranslations only if a
          // subtree exists.
          const nextSourceMap = new Map(state.translationSourceMap);
          let sourceMapChanged = false;
          for (const k of Array.from(nextSourceMap.keys())) {
            if (k.startsWith(sectionPath)) {
              nextSourceMap.delete(k);
              sourceMapChanged = true;
            }
          }

          const hasSubtree =
            !!state.templateTranslations.sections?.[uniqueSectionKey];
          if (!hasSubtree && !sourceMapChanged) {
            return {};
          }

          if (!hasSubtree) {
            return {
              translationSourceMap: nextSourceMap,
              hasUnsavedTranslations: true,
            };
          }

          const { [uniqueSectionKey]: _removed, ...remainingSections } =
            state.templateTranslations.sections || {};
          const nextTemplate: Record<string, any> = {
            ...state.templateTranslations,
            sections:
              Object.keys(remainingSections).length > 0
                ? remainingSections
                : undefined,
          };
          if (!nextTemplate.sections) {
            delete nextTemplate.sections;
          }
          return {
            templateTranslations: nextTemplate,
            translationSourceMap: nextSourceMap,
            hasUnsavedTranslations: true,
          };
        }),

      // -- Section / Widget edits (fire preview-bridge commits) --
      updateSection: (sectionId, updates) =>
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const i = sections.findIndex((s: any) => s.id === sectionId);
          if (i === -1) return {};
          sections[i] = { ...sections[i], ...updates };
          commitClientSection(sectionId, sections[i].settings ?? {});
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
          };
        }),

      updateSectionSettings: (sectionId, key, value) =>
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const i = sections.findIndex((s: any) => s.id === sectionId);
          if (i === -1) return {};
          sections[i] = {
            ...sections[i],
            settings: { ...sections[i].settings, [key]: value },
          };
          commitClientSection(sectionId, sections[i].settings);
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
          };
        }),

      setSectionVisibility: (sectionId, breakpoint, visible) =>
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const i = sections.findIndex((s: any) => s.id === sectionId);
          if (i === -1) return {};
          // Visibility lives at `settings.responsive[bp].visible` — that's
          // where both the sidebar (BuilderToolbar) reads it and the
          // iframe (SectionWrapperEditor) reads it to apply the
          // `hidden-{bp}` class. Write it there, not on a separate
          // `section.visibility` key.
          const prevSettings = sections[i].settings ?? {};
          const prevResponsive = prevSettings.responsive ?? {};
          const newSettings = {
            ...prevSettings,
            responsive: {
              ...prevResponsive,
              [breakpoint]: {
                ...(prevResponsive[breakpoint] || {}),
                visible,
              },
            },
          };
          sections[i] = { ...sections[i], settings: newSettings };
          // Commit the FULL updated settings: the iframe-side override
          // merge is shallow (`{ ...settings, ...override }`), so it
          // replaces `responsive` wholesale — the payload must carry the
          // merged responsive object for the change to land.
          commitClientSection(sectionId, newSettings);
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
          };
        }),

      updateWidget: (sectionId, widgetId, updates) =>
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const si = sections.findIndex((s: any) => s.id === sectionId);
          if (si === -1) return {};
          const section = { ...sections[si] };
          const widgets = [...section.widgets];
          const wi = widgets.findIndex((w: any) => w.id === widgetId);
          if (wi === -1) return {};
          widgets[wi] = { ...widgets[wi], ...updates };
          section.widgets = widgets;
          sections[si] = section;
          commitClientWidget(sectionId, widgetId, widgets[wi].settings ?? {});
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
          };
        }),

      updateWidgetSettings: (sectionId, widgetId, key, value) =>
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const si = sections.findIndex((s: any) => s.id === sectionId);
          if (si === -1) return {};
          const section = { ...sections[si] };
          const widgets = [...section.widgets];
          const wi = widgets.findIndex((w: any) => w.id === widgetId);
          if (wi === -1) return {};
          widgets[wi] = {
            ...widgets[wi],
            settings: { ...widgets[wi].settings, [key]: value },
          };
          section.widgets = widgets;
          sections[si] = section;
          commitClientWidget(sectionId, widgetId, widgets[wi].settings);
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
          };
        }),

      addSection: (section, insertIndex, extraDataSources) => {
        set((state) => {
          const prev = state.pageConfig || {};
          const sections = [...(prev.sections || [])];
          const at = insertIndex !== undefined ? insertIndex : sections.length;
          sections.splice(at, 0, section);

          const dataSources = {
            ...(prev.dataSources || {}),
            ...(extraDataSources || {}),
          };

          const expandedSections = new Set(state.expandedSections);
          expandedSections.add(section.id);

          return {
            pageConfig: { ...prev, sections, dataSources },
            hasUnsavedChanges: true,
            selectedSectionId: section.id,
            selectedWidgetId: section.widgets?.[0]?.id ?? null,
            expandedSections,
            showSettingsDrawer: true,
          };
        });
        commitServer(get().pageConfig);
      },

      addSectionFromLibrary: (libraryKey, insertAfterIndex) => {
        const entries = useThemeStore.getState().sections || {};
        const existingBlock = (entries as any)[libraryKey];
        if (!existingBlock) {
          console.error("Available section not found for key:", libraryKey);
          return;
        }

        const uniqueId = nanoid(6);
        const {
          id,
          name,
          type,
          isCommon: isCommonFlag,
          settings,
          widgets: libraryWidgets = [],
        } = existingBlock as any;
        const isCommon = isCommonFlag === true;

        const sectionId = `${id}-${uniqueId}`;
        const widgets = libraryWidgets.map((widget: any) => ({
          ...widget,
          id: `${widget.id}-${uniqueId}`,
        }));

        const extraDataSources: Record<string, any> = {};

        const sectionForPage = {
          id: sectionId,
          name,
          type,
          isCommon,
          settings,
          widgets: widgets.map((widget: any) => {
            if (!widget.dataSourceTemplate) return widget;
            const baseKey = widget.id || widget.name || "dataSource";
            const safeBase = String(baseKey)
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "_");
            const dataSourceKey = `${safeBase}_${uniqueId}`;
            extraDataSources[dataSourceKey] = {
              type: widget.dataSourceTemplate.type,
              params: widget.dataSourceTemplate.params || {},
              required:
                widget.dataSourceTemplate.required === undefined
                  ? false
                  : widget.dataSourceTemplate.required,
            };
            return { ...widget, dataSourceKey };
          }),
        };

        // Translation key remapping for template-scoped sections.
        const templateId = useThemeStore.getState().currentTemplate?.id ?? null;
        const uniqueSectionKey = sectionId.replace(/-/g, "_");

        if (!isCommon && templateId) {
          const { remappedWidgets, translationKeys, oldSectionPattern } =
            processSectionWidgets(
              sectionForPage.widgets,
              uniqueSectionKey,
              templateId,
              isCommon,
            );
          sectionForPage.widgets = remappedWidgets;
          if (translationKeys.length > 0 && oldSectionPattern) {
            get().createSectionTranslations({
              translationKeys,
              defaultTranslations: existingBlock.defaultTranslations || {
                en: {},
              },
              oldSectionPattern,
              newSectionKey: uniqueSectionKey,
            });
          }
        }

        const state = get();
        const currentSections = state.pageConfig?.sections || [];
        const insertIndex =
          insertAfterIndex != null
            ? Math.min(insertAfterIndex + 1, currentSections.length)
            : currentSections.length;

        state.addSection(sectionForPage, insertIndex, extraDataSources);
      },

      removeSection: (sectionId) => {
        set((state) => {
          const base = state.pageConfig || {};
          const sections = [...(base.sections || [])];
          const i = sections.findIndex((s: any) => s.id === sectionId);
          if (i === -1) return {};
          const removed = sections[i];

          // Refcount data sources — drop ones no other section references.
          const dataSourceKeys: string[] = (removed.widgets || [])
            .filter((w: any) => w.dataSourceKey)
            .map((w: any) => w.dataSourceKey);
          const stillUsed = new Set<string>();
          sections
            .filter((s: any) => s.id !== sectionId)
            .forEach((s: any) =>
              (s.widgets || []).forEach((w: any) => {
                if (w.dataSourceKey) stillUsed.add(w.dataSourceKey);
              }),
            );
          const dataSources = { ...(base.dataSources || {}) };
          dataSourceKeys.forEach((k) => {
            if (!stillUsed.has(k)) delete dataSources[k];
          });

          sections.splice(i, 1);

          const { [sectionId]: _drop, ...remainingErrors } =
            state.htmlValidationErrors;

          const expandedSections = new Set(state.expandedSections);
          expandedSections.delete(sectionId);

          return {
            pageConfig: { ...base, sections, dataSources },
            hasUnsavedChanges: true,
            selectedSectionId: null,
            selectedWidgetId: null,
            showSettingsDrawer: false,
            htmlValidationErrors: remainingErrors,
            expandedSections,
          };
        });
        // Remove translation keys scoped to this section (own slice).
        get().removeSectionTranslations(sectionId);
        commitServer(get().pageConfig);
      },

      removeWidget: (sectionId, widgetId) => {
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const si = sections.findIndex((s: any) => s.id === sectionId);
          if (si === -1) return {};
          const widgets = [...sections[si].widgets];
          const wi = widgets.findIndex((w: any) => w.id === widgetId);
          if (wi === -1) return {};
          widgets.splice(wi, 1);
          sections[si] = { ...sections[si], widgets };
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
            selectedWidgetId: null,
            showSettingsDrawer: false,
          };
        });
        commitServer(get().pageConfig);
      },

      moveSection: (fromId, toId) => {
        set((state) => {
          const sections = [...(state.pageConfig?.sections || [])];
          const from = sections.findIndex((s: any) => s.id === fromId);
          const to = sections.findIndex((s: any) => s.id === toId);
          if (from < 0 || to < 0) return {};
          const [moved] = sections.splice(from, 1);
          sections.splice(to, 0, moved);
          return {
            pageConfig: { ...state.pageConfig, sections },
            hasUnsavedChanges: true,
            selectedSectionId: toId,
          };
        });
        commitServer(get().pageConfig);
      },

      // -- Data sources --
      addDataSource: (key, type, params = {}) =>
        set((state) => ({
          pageConfig: {
            ...state.pageConfig,
            dataSources: {
              ...(state.pageConfig?.dataSources || {}),
              [key]: { type, params, required: false },
            },
          },
          hasUnsavedChanges: true,
        })),

      updateDataSource: (key, updates) => {
        set((state) => ({
          pageConfig: {
            ...state.pageConfig,
            dataSources: {
              ...(state.pageConfig?.dataSources || {}),
              [key]: {
                ...(state.pageConfig?.dataSources?.[key] || {}),
                ...updates,
              },
            },
          },
          hasUnsavedChanges: true,
        }));
        // Re-point a data source -> the preview must re-fetch with the new
        // handle, so go through the commit lane (full pageConfig applyConfig +
        // soft-nav), not the patch fast-lane which only swaps settings.
        commitServer(get().pageConfig);
      },

      removeDataSource: (key) =>
        set((state) => {
          const { [key]: _drop, ...remaining } =
            state.pageConfig?.dataSources || {};
          const sections = (state.pageConfig?.sections || []).map(
            (section: any) => ({
              ...section,
              widgets: section.widgets.map((w: any) =>
                w.dataSourceKey === key ? { ...w, dataSourceKey: null } : w,
              ),
            }),
          );
          return {
            pageConfig: {
              ...state.pageConfig,
              dataSources: remaining,
              sections,
            },
            hasUnsavedChanges: true,
          };
        }),

      // Whole-page revalidation — drops stale errors for sections that
      // got fixed since last run. Sections without CustomHtml widgets
      // are unaffected (they don't appear in errorsBySection and they
      // also don't appear in the cleared scope below).
      validateAllHtml: async () => {
        const pageConfig = get().pageConfig;
        if (!pageConfig?.sections) return;

        const { validateHtmlContent } = await import(
          "../editor-form/utils/htmlValidation"
        );

        type Task = {
          sectionId: string;
          promise: Promise<HtmlValidationError[]>;
        };
        const tasks: Task[] = [];
        const customHtmlSectionIds = new Set<string>();
        for (const section of pageConfig.sections) {
          for (const widget of section.widgets || []) {
            if (widget.type === "CustomHtml") {
              customHtmlSectionIds.add(section.id);
              tasks.push({
                sectionId: section.id,
                promise: validateHtmlContent(widget.settings?.html || ""),
              });
            }
          }
        }

        const results = await Promise.allSettled(tasks.map((t) => t.promise));
        const errorsBySection: Record<string, HtmlValidationError[]> = {};
        tasks.forEach(({ sectionId }, i) => {
          const r = results[i];
          if (r.status === "fulfilled" && r.value.length > 0) {
            (errorsBySection[sectionId] ||= []).push(...r.value);
          }
        });

        set((state) => {
          const next = { ...state.htmlValidationErrors };
          // Drop any previous CustomHtml-section entries that didn't
          // come back with errors this run — they're now clean.
          for (const sectionId of customHtmlSectionIds) {
            delete next[sectionId];
          }
          return {
            htmlValidationErrors: { ...next, ...errorsBySection },
          };
        });
      },

      // Per-section validation (clear → validate → set). Single home for
      // the trio that was duplicated across HtmlInput and HtmlEditor.
      validateSection: async (sectionId, html) => {
        get().clearHtmlValidationErrors(sectionId);
        if (!html?.trim()) return;
        const { validateHtmlContent } = await import(
          "../editor-form/utils/htmlValidation"
        );
        const errors = await validateHtmlContent(html);
        get().setHtmlValidationErrors(sectionId, errors);
      },

      // -- Read-side helpers --
      getSelectedSection: () => {
        const s = get();
        if (s.selectedSectionId === null) return null;
        return (
          s.pageConfig?.sections?.find(
            (sec: any) => sec.id === s.selectedSectionId,
          ) ?? null
        );
      },

      getSelectedWidget: () => {
        const s = get();
        const sec = s.getSelectedSection();
        if (!sec || s.selectedWidgetId === null) return null;
        return (
          sec.widgets?.find((w: any) => w.id === s.selectedWidgetId) ?? null
        );
      },

      getSelectedSectionSchema: () => {
        const sec = get().getSelectedSection();
        return sec ? ((sectionRegistry as any)[sec.type] ?? null) : null;
      },

      getSelectedWidgetSchema: () => {
        const w = get().getSelectedWidget();
        if (!w) return null;
        return useThemeStore.getState().schemas[w.type] ?? null;
      },
    }),
    { name: "template-store" },
  ),
);

// Derive translationService from (common, template, language). A language
// change always triggers a refetch (machine's TEMPLATE_CHANGED), which
// calls setTranslationData and rewrites the slices below — so subscribing
// to slice changes alone covers both edit and language-switch paths.
useTemplateStore.subscribe((state, prev) => {
  if (
    state.commonTranslations === prev.commonTranslations &&
    state.templateTranslations === prev.templateTranslations
  ) {
    return;
  }
  useTemplateStore.setState({
    translationService: buildTranslationService(
      state.commonTranslations,
      state.templateTranslations,
      useThemeStore.getState().language,
    ),
  });
});
