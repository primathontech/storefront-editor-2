import { Button } from "./design-system";
import styles from "./EditorHeader.module.css";
import { HeaderMobileIcon } from "./icons/HeaderMobileIcon";
import { HeaderMonitorIcon } from "./icons/HeaderMonitorIcon";
import { HeaderStackedIcon } from "./icons/HeaderStackedIcon";
import { HeaderTabletIcon } from "./icons/HeaderTabletIcon";
import { PreviewIcon } from "./icons/PreviewIcon";
import { TemplateSwitchDropdown } from "./TemplateSwitchDropdown";
import type { ThemeStructureTemplate } from "../../services/api";
import { useThemeStore } from "../../../stores/themeStore";

export type Device = "desktop" | "mobile" | "tablet" | "fullscreen";
export type Mode = "edit" | "preview";
export type SaveStatus =
  | "idle"
  | "validating"
  | "saving"
  | "saved"
  | "failed";

interface EditorHeaderProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
  device: Device;
  setDevice: (d: Device) => void;
  // Vestigial: the old edit/preview mode toggle was replaced by the
  // shareable-preview button below. Kept optional for back-compat with
  // callers that still pass them; no longer rendered.
  mode?: Mode;
  setMode?: (m: Mode) => void;
  saveStatus: SaveStatus;
  saveDisabled: boolean;
  onSave: () => void;
  // Shareable-preview action. When `onPreview` is provided the button fires
  // it — creating a preview snapshot via the backend. Lanes that don't pass
  // `onPreview` (e.g. the static-template lane, where shareable preview isn't
  // built yet) render the SAME button but disabled. `previewDisabled` gates
  // it on having unsaved edits for lanes that do support it.
  onPreview?: () => void;
  previewDisabled?: boolean;
  previewLoading?: boolean;
  // Tooltip shown when the preview button is disabled at rest.
  previewDisabledReason?: string;
}

/**
 * Display-only theme label for the header.
 *
 * A 2.0 theme's id/name carries a backend disambiguation suffix ("-2"/"2")
 * that separates it from the legacy 1.0 theme sharing the same backend — noise
 * in the editor, which is always the 2.0 tool. For slug-like values we drop
 * that suffix, turn separators into spaces, and title-case into a clean label.
 * Values that already look intentional (mixed-case, or containing spaces) are
 * shown untouched so a real branded name isn't mangled. Never mutates the
 * stored theme — purely how it renders.
 *
 * Transition-scoped: drop this once themes expose a clean display name.
 */
export function formatThemeName(raw: string | undefined): string {
  if (!raw) return "";
  const looksIntentional =
    /\s/.test(raw) || (/[a-z]/.test(raw) && /[A-Z]/.test(raw));
  if (looksIntentional) return raw;
  return raw
    .replace(/-?2$/, "") // drop the 2.0 disambiguation suffix
    .replace(/[-_]+/g, " ") // separators → spaces
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const DEVICES = [
  { id: "desktop", label: "Desktop", Icon: HeaderMonitorIcon },
  { id: "tablet", label: "Tablet", Icon: HeaderTabletIcon },
  { id: "mobile", label: "Mobile", Icon: HeaderMobileIcon },
  { id: "fullscreen", label: "Fullscreen", Icon: HeaderStackedIcon },
] as const;

// The primary action publishes the draft to the live (production) template.
const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "Publish",
  validating: "Validating…",
  saving: "Publishing…",
  saved: "Published",
  failed: "Retry publish",
};

const EditorHeader: React.FC<EditorHeaderProps> = ({
  onSwitchTemplate,
  device,
  setDevice,
  saveStatus,
  saveDisabled,
  onSave,
  onPreview,
  previewDisabled = false,
  previewLoading = false,
  previewDisabledReason = "Make a change to save a preview",
}) => {
  const theme = useThemeStore((s) => s.theme);
  const isSaving = saveStatus === "validating" || saveStatus === "saving";

  return (
    <header className={styles.header}>
      <div className={styles["left-container"]}>
        <span className={styles["theme-name"]}>
          {formatThemeName(theme?.name || theme?.id)}
        </span>
      </div>

      <div className={styles["center-container"]}>
        <div className={styles["template-dropdown-wrapper"]}>
          <TemplateSwitchDropdown onSwitchTemplate={onSwitchTemplate} />
        </div>
      </div>

      <div className={styles["right-container"]}>
        <div className={styles["device-group"]}>
          {DEVICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id as Device)}
              aria-pressed={device === id}
              aria-label={`Switch to ${label} view`}
              title={`Switch to ${label} view`}
              className={`${styles["device-button"]} ${
                device === id
                  ? styles["device-button-active"]
                  : styles["device-button-inactive"]
              }`}
            >
              <Icon />
            </button>
          ))}
        </div>
        <div className={styles["action-buttons-container"]}>
          {/* Shareable-preview button — same in every lane. Disabled when a
              lane doesn't support it yet (no onPreview, e.g. static pages) or
              when there's nothing new to preview. span carries the hint: a
              native title doesn't show on a disabled <button>. */}
          <span
            title={
              (previewDisabled || !onPreview) && !previewLoading
                ? previewDisabledReason
                : undefined
            }
            style={{ display: "inline-flex" }}
          >
            <Button
              variant="secondary"
              size="md"
              leftIcon={<PreviewIcon />}
              onClick={onPreview}
              disabled={previewDisabled || !onPreview}
              loading={previewLoading}
              title="Save a draft and open a shareable preview"
            >
              {previewLoading ? "Saving…" : "Save and Preview"}
            </Button>
          </span>

          {/* span carries the hint: a native title doesn't show on a
              disabled <button>. Only set when Save is disabled at rest. */}
          <span
            title={
              saveDisabled && saveStatus === "idle"
                ? "Nothing to publish"
                : undefined
            }
            style={{ display: "inline-flex" }}
          >
            <Button
              variant="primary"
              size="md"
              onClick={onSave}
              disabled={saveDisabled}
              loading={isSaving}
              title={
                saveStatus === "failed"
                  ? "Last publish failed"
                  : "Publish to live"
              }
              style={{ minWidth: "100px" }}
            >
              {SAVE_LABEL[saveStatus]}
            </Button>
          </span>
        </div>
      </div>
    </header>
  );
};

export default EditorHeader;
