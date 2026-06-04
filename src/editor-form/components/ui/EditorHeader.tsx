import { Button } from "./design-system";
import styles from "./EditorHeader.module.css";
import { EditIcon } from "./icons/EditIcon";
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
  mode: Mode;
  setMode: (m: Mode) => void;
  saveStatus: SaveStatus;
  saveDisabled: boolean;
  onSave: () => void;
}

const DEVICES = [
  { id: "desktop", label: "Desktop", Icon: HeaderMonitorIcon },
  { id: "tablet", label: "Tablet", Icon: HeaderTabletIcon },
  { id: "mobile", label: "Mobile", Icon: HeaderMobileIcon },
  { id: "fullscreen", label: "Fullscreen", Icon: HeaderStackedIcon },
] as const;

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "Save",
  validating: "Validating…",
  saving: "Saving…",
  saved: "Saved",
  failed: "Retry save",
};

const EditorHeader: React.FC<EditorHeaderProps> = ({
  onSwitchTemplate,
  device,
  setDevice,
  mode,
  setMode,
  saveStatus,
  saveDisabled,
  onSave,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const isSaving = saveStatus === "validating" || saveStatus === "saving";

  return (
    <header className={styles.header}>
      <div className={styles["left-container"]}>
        <span className={styles["theme-name"]}>{theme?.name || theme?.id}</span>
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
          <Button
            variant="secondary"
            size="md"
            leftIcon={mode === "preview" ? <EditIcon /> : <PreviewIcon />}
            onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
            style={{ width: "122px" }}
          >
            {mode === "preview" ? "Edit" : "Preview"}
          </Button>

          {/* span carries the hint: a native title doesn't show on a
              disabled <button>. Only set when Save is disabled at rest. */}
          <span
            title={
              saveDisabled && saveStatus === "idle"
                ? "No changes to save"
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
                saveStatus === "failed" ? "Last save failed" : "Save changes"
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
