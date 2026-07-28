"use client";

import { clsx } from "clsx";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EditorAPI,
  type ThemeStructureGroup,
  type ThemeStructureTemplate,
} from "../../services/api";
import { useThemeStore } from "../../../stores/themeStore";
import { useAuthStore } from "../../../stores/authStore";
import { Popover } from "./Popover";
import { Button, Modal } from "./design-system";
// TrashIcon commented out — the Delete-template button is temporarily disabled
// (branch: delete-template-commented). Re-enable it with the Delete button below.
import { KebabIcon, PencilIcon /* , TrashIcon */ } from "./icons/template-picker-icons";

// Shared field-box look for text inputs — identical to CreateTemplateModal so
// the Create / Rename dialogs line up the same way.
const fieldBox =
  "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 " +
  "text-[14px] text-editor-text outline-none focus:border-editor-accent";

// The header ✕ close button, matching CreateTemplateModal.
const CloseX: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="flex h-6 w-6 items-center justify-center rounded text-editor-text-muted transition-colors hover:bg-[#f4f6f9] hover:text-editor-text"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4 4L12 12M12 4L4 12" />
    </svg>
  </button>
);

const typeOf = (t: ThemeStructureTemplate): string =>
  t.routeContext?.type ?? t.routeContext?.templateName ?? "page";
const isDefaultTemplate = (t: ThemeStructureTemplate): boolean =>
  t.id?.endsWith("_default") ?? false;

// Templates are only manageable (create/delete) for product & collection pages
// in v1 — home / pages / policy pages etc. have a single default only.
const TEMPLATABLE_TYPES = new Set([
  "product",
  "products",
  "collection",
  "collections",
]);

interface TemplateActionsMenuProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

/**
 * "⋮" actions menu for the ACTIVE template, shown next to Publish. Always
 * visible. Offers Delete (Rename later). Deleting removes the template from the
 * live catalog and switches the editor to the default of the same type, so
 * everything falls back to the default. The default template cannot be deleted:
 * the item is disabled with a "Can't delete the default template" tooltip (and
 * the backend rejects it regardless).
 */
export const TemplateActionsMenu: React.FC<TemplateActionsMenuProps> = ({
  onSwitchTemplate,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const currentTemplate = useThemeStore((s) => s.currentTemplate);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setCurrentTemplate = useThemeStore((s) => s.setCurrentTemplate);

  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleDeleteCurrent = useCallback(async () => {
    if (!theme || !currentTemplate) return;
    const themeId = useAuthStore.getState().merchant?.themeId ?? theme.id;
    const deletedId = currentTemplate.id;
    const type = typeOf(currentTemplate);
    setDeleting(true);
    setDeleteError(null);
    try {
      await EditorAPI.deleteTemplate(themeId, deletedId);

      // Drop the deleted template from the in-memory catalog (and any group
      // node left empty), so the picker updates without a reload.
      const structure = (theme.templateStructure ?? []) as ThemeStructureGroup[];
      const nextStructure = structure
        .map((g) => ({
          ...g,
          templates: (g.templates ?? []).filter((t) => t.id !== deletedId),
        }))
        .filter((g) => (g.templates ?? []).length > 0);

      setTheme({
        ...theme,
        templateCount: Math.max(0, (theme.templateCount ?? structure.length) - 1),
        templateStructure: nextStructure,
      });

      // Fall back to the default template of the same type.
      const defaultNode = nextStructure
        .flatMap((g) => g.templates ?? [])
        .find((t) => typeOf(t) === type && isDefaultTemplate(t));

      setConfirmDelete(false);
      setOpen(false);
      if (defaultNode) onSwitchTemplate(defaultNode);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete template",
      );
    } finally {
      setDeleting(false);
    }
  }, [theme, currentTemplate, setTheme, onSwitchTemplate]);

  // Rename the ACTIVE template — display name ONLY (id/suffix/pageConfig
  // untouched). Updates the in-memory catalog + the active-template label; the
  // backend mirrors the name onto templateStructure so the Admin list reflects
  // it too.
  const handleRename = useCallback(async () => {
    if (!theme || !currentTemplate) return;
    const name = renameValue.trim();
    if (!name) return;
    // "default" is reserved for the default template (same rule as Create).
    // Renaming is name-only so this wouldn't collide with the real default's
    // id, but a second "default"-named entry is confusing — block it.
    if (name.toLowerCase() === "default") {
      setRenameError('"default" is reserved — pick another name.');
      return;
    }
    const themeId = useAuthStore.getState().merchant?.themeId ?? theme.id;
    const id = currentTemplate.id;
    setRenaming(true);
    setRenameError(null);
    try {
      await EditorAPI.renameTemplate(themeId, id, name);

      const structure = (theme.templateStructure ?? []) as ThemeStructureGroup[];
      const nextStructure = structure.map((g) => {
        const templates = g.templates ?? [];
        if (!templates.some((t) => t.id === id)) return g;
        const nextTemplates = templates.map((t) =>
          t.id === id ? { ...t, name } : t,
        );
        // Flat single-template group node: keep its own label in sync.
        const gName = templates.length === 1 ? name : g.name;
        return { ...g, name: gName, templates: nextTemplates };
      });
      setTheme({ ...theme, templateStructure: nextStructure });
      setCurrentTemplate({ ...currentTemplate, name });

      setRenameOpen(false);
      setOpen(false);
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Failed to rename template",
      );
    } finally {
      setRenaming(false);
    }
  }, [theme, currentTemplate, renameValue, setTheme, setCurrentTemplate]);

  // The ⋮ is ALWAYS shown; the eligibility check lives on the menu items.
  if (!currentTemplate) return null;

  const currentIsDefault = isDefaultTemplate(currentTemplate);
  const currentIsLive = currentTemplate.isTemplateLive === true;
  const isTemplatable = TEMPLATABLE_TYPES.has(typeOf(currentTemplate));
  // Rename & Delete are allowed only for a NON-default product/collection
  // template (same rule for both).
  const canManage = isTemplatable && !currentIsDefault;
  // "default" is reserved — gate the Rename button + show an inline hint.
  const renameReserved = renameValue.trim().toLowerCase() === "default";
  // Delete-template feature temporarily disabled (branch: delete-template-commented).
  // Tooltip kept commented for easy re-enable alongside the Delete button below.
  // const deleteTooltip = !isTemplatable
  //   ? "Only product and collection templates can be deleted"
  //   : currentIsDefault
  //     ? "Can't delete the default template"
  //     : undefined;
  const renameTooltip = !isTemplatable
    ? "Only product and collection templates can be renamed"
    : currentIsDefault
      ? "Can't rename the default template"
      : undefined;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Template actions"
        className={clsx(
          "flex h-10 w-9 shrink-0 items-center justify-center rounded-md text-editor-text-muted transition-colors hover:bg-[#f4f6f9]",
          open && "bg-[#f4f6f9]",
        )}
      >
        <KebabIcon />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        minWidth={220}
        role="menu"
        className="z-[1400] overflow-hidden rounded-xl border border-editor-border bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
      >
        <button
          type="button"
          role="menuitem"
          disabled={!canManage}
          title={renameTooltip}
          onClick={() => {
            if (!canManage) return;
            setRenameError(null);
            setRenameValue(currentTemplate.name ?? "");
            setOpen(false);
            setRenameOpen(true);
          }}
          className={clsx(
            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
            canManage
              ? "text-editor-text hover:bg-[#f4f6f9]"
              : "cursor-not-allowed text-editor-text-subtle",
          )}
        >
          <span className="shrink-0">
            <PencilIcon />
          </span>
          Rename template
        </button>

        {/* Delete template button — TEMPORARILY DISABLED (branch:
            delete-template-commented). The delete handler (handleDeleteCurrent),
            its state, and the Delete modal below are intentionally left intact so
            this can be re-enabled by uncommenting: this button, the `deleteTooltip`
            declaration above, and the `TrashIcon` import at the top.
        <button
          type="button"
          role="menuitem"
          disabled={!canManage}
          title={deleteTooltip}
          onClick={() => {
            if (!canManage) return;
            setOpen(false);
            setDeleteError(null);
            setConfirmDelete(true);
          }}
          className={clsx(
            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
            canManage
              ? "text-[#b42318] hover:bg-[#fef3f2]"
              : "cursor-not-allowed text-editor-text-subtle",
          )}
        >
          <span className="shrink-0">
            <TrashIcon />
          </span>
          Delete template
        </button>
        */}
      </Popover>

      {/* Delete — same Modal shell as Create (header / body / footer). A LIVE
          template gets a stronger warning since deleting it reverts every
          resource using it to the default template. */}
      {typeof document !== "undefined" &&
        createPortal(
          <Modal
            isOpen={confirmDelete && canManage}
            onClose={() => !deleting && setConfirmDelete(false)}
            title="Delete template"
            size="md"
            headerActions={
              <CloseX onClick={() => !deleting && setConfirmDelete(false)} />
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteCurrent}
                  className="rounded-lg bg-[#b42318] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#932114] disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete template"}
                </button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {currentIsLive ? (
                <p className="m-0 text-[14px] leading-relaxed text-editor-text">
                  <strong className="font-medium">
                    “{currentTemplate.name ?? currentTemplate.id}”
                  </strong>{" "}
                  is currently <strong className="font-medium">live</strong>.
                  Deleting it is permanent, and every product or collection
                  using it will fall back to the{" "}
                  <strong className="font-medium">default</strong> template. Are
                  you sure you want to delete this live template?
                </p>
              ) : (
                <p className="m-0 text-[14px] leading-relaxed text-editor-text">
                  Delete{" "}
                  <strong className="font-medium">
                    “{currentTemplate.name ?? currentTemplate.id}”
                  </strong>
                  ? Anything using it falls back to the{" "}
                  <strong className="font-medium">default</strong> template.
                  This can’t be undone.
                </p>
              )}
              {deleteError && (
                <p className="m-0 text-[13px] text-[#c0392b]">{deleteError}</p>
              )}
            </div>
          </Modal>,
          document.body,
        )}

      {/* Rename — same Modal shell as Create; display name only. */}
      {typeof document !== "undefined" &&
        createPortal(
          <Modal
            isOpen={renameOpen && canManage}
            onClose={() => !renaming && setRenameOpen(false)}
            title="Rename template"
            size="md"
            headerActions={
              <CloseX onClick={() => !renaming && setRenameOpen(false)} />
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setRenameOpen(false)}
                  disabled={renaming}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleRename}
                  disabled={renaming || !renameValue.trim() || renameReserved}
                  loading={renaming}
                >
                  Rename
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-5">
              <p className="m-0 text-[14px] leading-relaxed text-editor-text">
                Changes the display name only — the template’s URL/suffix stays
                the same.
              </p>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="tpl-rename"
                  className="text-[14px] text-editor-text"
                >
                  Name
                </label>
                <input
                  id="tpl-rename"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className={fieldBox}
                />
                {renameReserved && (
                  <span className="text-[13px] text-[#c0392b]">
                    &quot;default&quot; is reserved
                  </span>
                )}
              </div>
              {renameError && (
                <p className="m-0 text-[13px] text-[#c0392b]">{renameError}</p>
              )}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
};
