"use client";

import { clsx } from "clsx";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EditorAPI,
  type ThemeStructureGroup,
  type ThemeStructureTemplate,
} from "../../services/api";
import { useThemeStore } from "../../../stores/themeStore";
import { useAuthStore } from "../../../stores/authStore";
import { isUnhydratedPath } from "../../utils/preview-route";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { Popover } from "./Popover";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CollectionIcon,
  HomeIcon,
  PlusIcon,
  ProductIcon,
  TemplateIcon,
} from "./icons/template-picker-icons";

// Header/footer are "chrome" — edited inline on every page, not their own page
// type — so they're excluded from the picker (see the app's editor convention).
const CHROME_TYPES = new Set(["header", "footer"]);

// The page type comes straight from the API (`routeContext.type`, e.g.
// "product", "collection", "page"). No hardcoded lists — everything below is
// derived from the theme's templateStructure.
const typeOf = (t: ThemeStructureTemplate): string =>
  t.routeContext?.type ?? t.routeContext?.templateName ?? "page";

// Display label for a page type — just the type, capitalized ("product" →
// "Product"). Derived from data, no lookup table.
const labelForType = (type: string): string =>
  type.charAt(0).toUpperCase() + type.slice(1);

// Icon per page type. Icons can't be derived from a string, so this is the one
// place we map on the `type` field: home / collection / product get their own
// icon; everything else uses the generic default.
const iconForType = (type: string): React.ReactNode => {
  if (type === "home" || type === "index") return <HomeIcon />;
  if (type === "collection" || type === "collections") return <CollectionIcon />;
  if (type === "product" || type === "products") return <ProductIcon />;
  return <TemplateIcon />;
};

// Product & collection are the page types v1 supports custom templates for
// (PRD §2: PDP + PLP). They ALWAYS open a submenu and offer "Create template",
// even when only the default template exists. Every other type is data-driven
// (it expands only once it actually has more than one template).
const TEMPLATABLE_TYPES = new Set([
  "product",
  "products",
  "collection",
  "collections",
]);
const isTemplatable = (type: string): boolean => TEMPLATABLE_TYPES.has(type);

// The default (non-deletable) template is identified by its 🔑 ending in
// "_default". We intentionally do NOT trust `variant` — created templates can
// inherit "default" from the template they were duplicated from.
const isDefaultTemplate = (t: ThemeStructureTemplate): boolean =>
  t.id?.endsWith("_default") ?? false;

interface PageType {
  type: string;
  label: string;
  templates: ThemeStructureTemplate[];
}

interface TemplatePickerProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

/**
 * Page/template picker for the editor header.
 *
 * Driven by the theme's `templateStructure` from the API:
 *   1. Templates grouped by their `type` (product, collection, page, …).
 *   2. Product/collection ALWAYS open a submenu (+ "Create template"); other
 *      types open one only when they have more than one template; single-
 *      template types are selected directly on click.
 */
export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  onSwitchTemplate,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const currentTemplate = useThemeStore((s) => s.currentTemplate);
  const setTheme = useThemeStore((s) => s.setTheme);
  const language = useThemeStore((s) => s.language);

  const [open, setOpen] = useState(false);
  // null → showing the page-type list; a type → showing that type's templates.
  const [activeType, setActiveType] = useState<string | null>(null);
  // The page type the Create-template modal is open for (null → closed).
  const [createForType, setCreateForType] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);

  // Group every template by its type — same-type templates come together.
  const pageTypes = useMemo<PageType[]>(() => {
    const map = new Map<string, ThemeStructureTemplate[]>();
    for (const group of theme?.templateStructure ?? []) {
      for (const t of group.templates ?? []) {
        const type = typeOf(t);
        if (CHROME_TYPES.has(type)) continue; // header/footer aren't page types
        const list = map.get(type) ?? [];
        list.push(t);
        map.set(type, list);
      }
    }
    return [...map.entries()].map(([type, templates]) => ({
      type,
      label: labelForType(type),
      templates,
    }));
  }, [theme]);

  // A type opens a submenu when it's product/collection (always) or when it
  // simply has more than one template.
  const isExpandable = (pt: PageType): boolean =>
    isTemplatable(pt.type) || pt.templates.length > 1;

  const currentType = currentTemplate ? typeOf(currentTemplate) : null;
  const activePageType = pageTypes.find((p) => p.type === activeType) ?? null;

  const openMenu = () => {
    setActiveType(null);
    setOpen(true);
  };
  const closeMenu = () => setOpen(false);

  const handleSelectTemplate = (template: ThemeStructureTemplate) => {
    closeMenu();
    // No-op when re-selecting the active template (the editor only reloads on
    // id change, so re-selecting would blank state).
    if (template.id === currentTemplate?.id) return;
    onSwitchTemplate(template);
  };

  // Create a new (draft) template. Copies from the source's DRAFT (preview)
  // state — merchants edit in draft before publishing — falling back to live.
  // POSTs it (isTemplateLive:false), overlays the node into the in-memory theme
  // so the dropdown shows it, then switches to it.
  const handleCreateTemplate = useCallback(
    async ({
      name,
      suffix,
      basedOnId,
    }: {
      name: string;
      suffix: string;
      basedOnId: string | null;
    }) => {
      if (!theme || !createForType) return;
      const themeId = useAuthStore.getState().merchant?.themeId ?? theme.id;
      const structure = (theme.templateStructure ?? []) as ThemeStructureGroup[];
      const typeTemplates =
        pageTypes.find((p) => p.type === createForType)?.templates ?? [];

      // Structural base: the chosen "Based on" template, else the type's
      // default, else the first. Drives routeContext + 🔑.
      const base =
        (basedOnId && typeTemplates.find((t) => t.id === basedOnId)) ||
        typeTemplates.find(isDefaultTemplate) ||
        typeTemplates[0];
      const templateName = base?.routeContext?.templateName ?? createForType;
      const newId = `${themeId}_${templateName}_${suffix}`;

      // Prefer the source's DRAFT (preview) state — merchants edit in draft
      // ("Save and Preview") before publishing, so the draft holds the freshest
      // config + text. Fall back to the live template when there's no draft.
      const sourceDraft = basedOnId
        ? await EditorAPI.getLatestPreview(themeId, basedOnId)
        : null;

      // Copy the ENTIRE pageConfig — every section with its exact settings and
      // disabled/hidden flags, plus dataSources and layout — just with the new
      // id. Empty body for Blank. rawPageConfig keeps the t:-ref model; else
      // the resolved draft pageConfig; else the live template.
      let pageConfig: Record<string, unknown> = { id: newId, sections: [] };
      if (basedOnId) {
        const draftConfig = (sourceDraft?.metadata?.rawPageConfig ??
          sourceDraft?.pageConfig) as Record<string, unknown> | undefined;
        const baseConfig =
          draftConfig ??
          ((await EditorAPI.getTemplate(themeId, basedOnId)) as Record<
            string,
            unknown
          >);
        pageConfig = { ...baseConfig, id: newId };
      }

      // Clone the base group node so the new node matches the live shape;
      // override id/name/templates and mark it a draft.
      const baseGroup = structure.find((g) =>
        g.templates?.some((t) => t.id === base?.id),
      );
      const newTemplateNode: ThemeStructureTemplate = {
        ...(baseGroup?.templates?.[0] ?? base ?? { id: newId }),
        id: newId,
        name,
        // The new template's own suffix — never inherit the base's "default".
        variant: suffix,
        isTemplateLive: false,
        routeContext: { ...(base?.routeContext ?? {}) },
      };
      const structureNode: ThemeStructureGroup = {
        ...(baseGroup ?? { name }),
        id: `${templateName}-${suffix}`,
        name,
        isTemplateLive: false,
        templates: [newTemplateNode],
      };

      await EditorAPI.createTemplate(themeId, {
        id: newId,
        name,
        pageConfig,
        structureNode,
      });

      // Copy translations so the new template's t:-refs (e.g.
      // "products.productMain.saveLabel") resolve to the SAME text as the
      // source — otherwise the copied widgets show raw keys. Prefer the DRAFT's
      // template translations for the editing language (captures unpublished
      // text edits); fall back to the live translations, and use live for every
      // other supported language. Done before the switch so the reload picks
      // them up.
      if (basedOnId) {
        const languages = base?.supportedLanguages ?? [language || "en"];
        const draftTemplateT = sourceDraft?.metadata?.translations?.template as
          | Record<string, unknown>
          | undefined;
        for (const lang of languages) {
          let translations: Record<string, unknown> | undefined;
          if (
            lang === language &&
            draftTemplateT &&
            Object.keys(draftTemplateT).length > 0
          ) {
            translations = draftTemplateT;
          }
          if (!translations || Object.keys(translations).length === 0) {
            translations = await EditorAPI.getTranslation(
              themeId,
              basedOnId,
              lang,
            );
          }
          if (translations && Object.keys(translations).length > 0) {
            await EditorAPI.saveTranslation(themeId, newId, lang, translations);
          }
        }
      }

      setTheme({
        ...theme,
        templateCount: (theme.templateCount ?? structure.length) + 1,
        templateStructure: [...structure, structureNode],
      });

      onSwitchTemplate(newTemplateNode);
    },
    [theme, createForType, pageTypes, setTheme, onSwitchTemplate, language],
  );

  if (!theme?.templateStructure?.length || pageTypes.length === 0) {
    return null;
  }

  const currentTypeGroup = pageTypes.find((p) => p.type === currentType);
  const triggerLabel = currentTemplate
    ? currentTypeGroup && isExpandable(currentTypeGroup)
      ? `${labelForType(currentType ?? "page")} · ${
          currentTemplate.name ?? currentTemplate.id
        }`
      : labelForType(currentType ?? "page")
    : "Select template…";

  return (
    <div className="w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          "flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2",
          "font-[var(--font-inter)] text-[13px] font-medium text-editor-text",
          "transition-colors hover:bg-[#f4f6f9]",
          open && "bg-[#f4f6f9]",
        )}
      >
        <span className="shrink-0 text-editor-text-muted">
          {iconForType(currentType ?? "page")}
        </span>
        <span className="truncate">{triggerLabel}</span>
        <span
          className={clsx("shrink-0 transition-transform", open && "rotate-180")}
        >
          <ChevronDownIcon />
        </span>
      </button>

      <Popover
        open={open}
        onClose={closeMenu}
        anchorRef={triggerRef}
        minWidth={340}
        role="menu"
        className="z-[1400] overflow-hidden rounded-xl border border-editor-border bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
      >
        {activePageType === null ? (
          // ── View 1: page types ──────────────────────────────────
          <div className="max-h-[440px] overflow-y-auto py-1.5">
            {pageTypes.map((pt) => {
              const multi = isExpandable(pt);
              const isCurrentSingle =
                !multi && pt.templates[0]?.id === currentTemplate?.id;
              return (
                <button
                  key={pt.type}
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    multi
                      ? setActiveType(pt.type)
                      : pt.templates[0] && handleSelectTemplate(pt.templates[0])
                  }
                  className={clsx(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-editor-text",
                    "transition-colors hover:bg-[#f4f6f9]",
                    (pt.type === currentType || isCurrentSingle) &&
                      "bg-[#f4f6f9] font-medium",
                  )}
                >
                  <span className="shrink-0 text-editor-text-muted">
                    {iconForType(pt.type)}
                  </span>
                  <span className="flex-1 truncate">{pt.label}</span>
                  {multi ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-editor-text-subtle">
                      <span className="text-[12px]">{pt.templates.length}</span>
                      <ChevronRightIcon />
                    </span>
                  ) : (
                    isCurrentSingle && (
                      <span className="shrink-0 text-[#1d4a88]">
                        <CheckIcon />
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          // ── View 2: templates for the chosen type ────────────────
          <>
            <button
              type="button"
              onClick={() => setActiveType(null)}
              className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[13px] font-medium text-editor-text transition-colors hover:bg-[#f4f6f9]"
            >
              <span className="text-editor-text-muted">
                <ChevronLeftIcon />
              </span>
              <span className="truncate">{activePageType.label}</span>
            </button>

            <div className="max-h-[360px] overflow-y-auto pb-1">
              {activePageType.templates.map((t) => {
                const unhydrated = isUnhydratedPath(t.routeContext?.path);
                const selected = t.id === currentTemplate?.id;
                const isDefault = isDefaultTemplate(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    disabled={unhydrated}
                    title={
                      unhydrated
                        ? "Set sample params to preview this template"
                        : undefined
                    }
                    onClick={() => handleSelectTemplate(t)}
                    className={clsx(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      unhydrated
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-[#f4f6f9]",
                      selected && "bg-[#f4f6f9]",
                    )}
                  >
                    <span className="shrink-0 text-editor-text-muted">
                      <TemplateIcon />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] text-editor-text">
                        {t.name ?? t.id}
                      </span>
                      {isDefault && (
                        <span className="truncate text-[12px] text-editor-text-subtle">
                          Default template
                        </span>
                      )}
                    </span>
                    {selected && (
                      <span className="shrink-0 text-[#1d4a88]">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create is only offered for product/collection (v1 template
                types) — other types can drill for browsing but not create. */}
            {isTemplatable(activePageType.type) && (
              <button
                type="button"
                onClick={() => {
                  setCreateForType(activePageType.type);
                  closeMenu();
                }}
                className="flex w-full items-center gap-3 border-t border-editor-border px-3 py-2.5 text-left text-[13px] font-medium text-editor-accent transition-colors hover:bg-[#f4f6f9]"
              >
                <span className="shrink-0">
                  <PlusIcon />
                </span>
                Create template
              </button>
            )}
          </>
        )}
      </Popover>

      {/* Portal to <body>: the design-system Modal is position:fixed, but this
          picker lives in the header's `transform: translateX(-50%)` container,
          which would otherwise trap the modal inside the header slot. */}
      {typeof document !== "undefined" &&
        createPortal(
          <CreateTemplateModal
            key={createForType ?? "closed"}
            isOpen={createForType !== null}
            onClose={() => setCreateForType(null)}
            basedOnTemplates={
              pageTypes.find((p) => p.type === createForType)?.templates ?? []
            }
            onCreate={handleCreateTemplate}
          />,
          document.body,
        )}
    </div>
  );
};
