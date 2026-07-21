"use client";

import { useMemo, useState } from "react";
import type { ThemeStructureTemplate } from "../../services/api";
import { Button, Modal } from "./design-system";

// Editor slugifies Name → suffix (TRD §4.5 step 2). Charset is [a-z0-9-]; the
// backend enforces the same on write (§5.1). "default" is reserved.
const slugify = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

const BLANK = "__blank__";

// Default template = its 🔑 ends in "_default" (don't trust `variant`, which a
// duplicate can inherit from its source).
const isDefaultTemplate = (t: ThemeStructureTemplate): boolean =>
  t.id?.endsWith("_default") ?? false;

// Shared field-box look for the Name input + Based-on select (full width,
// bordered, rounded) so they line up exactly like the Shopify dialog.
const fieldBox =
  "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 " +
  "text-[14px] text-editor-text outline-none focus:border-editor-accent";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Existing templates of this type, offered as "Based on" sources. */
  basedOnTemplates: ThemeStructureTemplate[];
  /** Create the template. `basedOnId` is null for a Blank template. Rejecting
   *  surfaces the error in the modal; resolving closes it. */
  onCreate: (input: {
    name: string;
    suffix: string;
    basedOnId: string | null;
  }) => Promise<void>;
}

/**
 * "Create a template" modal — { Name, Based on } (TRD §4.5 / §6 "Create"),
 * matched to the Shopify create-template dialog. Built on the design-system
 * `Modal` shell; the fields are plain full-width controls (native <select> for
 * "Based on" so it never clips inside the modal's scroll area).
 */
export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  basedOnTemplates,
  onCreate,
}) => {
  const defaultTemplate = basedOnTemplates.find(isDefaultTemplate);

  // Fresh state per open is handled by the caller remounting via `key`, so
  // plain initial values are enough — no reset effect. "Based on" defaults to
  // the default template (Shopify defaults to "Default product").
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState(defaultTemplate?.id ?? BLANK);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const suffix = useMemo(() => slugify(name), [name]);

  const suffixError =
    name.trim().length > 0 && suffix.length === 0
      ? "Name must contain a letter or number"
      : suffix === "default"
        ? '"default" is reserved'
        : undefined;

  const canCreate = suffix.length > 0 && !suffixError;

  const basedOnOptions = useMemo(
    () => [
      ...basedOnTemplates.map((t) => ({
        value: t.id,
        label: t.name ?? t.id,
      })),
      { value: BLANK, label: "Blank" },
    ],
    [basedOnTemplates],
  );

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setSubmitError(null);
    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        suffix,
        basedOnId: basedOn === BLANK ? null : basedOn,
      });
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create template",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a template"
      size="md"
      headerActions={
        <button
          type="button"
          onClick={onClose}
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
      }
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleCreate}
            disabled={!canCreate}
            loading={creating}
          >
            Create template
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="m-0 text-[14px] leading-relaxed text-editor-text">
          Create a template to customize how your content is displayed. After
          it's published, assign it in the admin.
        </p>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tpl-name" className="text-[14px] text-editor-text">
            Name
          </label>
          <input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className={fieldBox}
          />
          {suffixError && (
            <span className="text-[13px] text-[#c0392b]">{suffixError}</span>
          )}
        </div>

        {/* Based on — full-width native select with a stacked-chevron caret. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tpl-based-on" className="text-[14px] text-editor-text">
            Based on
          </label>
          <div className="relative">
            <select
              id="tpl-based-on"
              value={basedOn}
              onChange={(e) => setBasedOn(e.target.value)}
              className={`${fieldBox} cursor-pointer appearance-none pr-10`}
            >
              {basedOnOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-editor-text-muted">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 6.5L8 3.5L11 6.5" />
                <path d="M5 9.5L8 12.5L11 9.5" />
              </svg>
            </span>
          </div>
        </div>

        {submitError && (
          <p className="m-0 text-[13px] text-[#c0392b]">{submitError}</p>
        )}
      </div>
    </Modal>
  );
};
