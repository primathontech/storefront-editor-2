/**
 * Editor Design System Components
 *
 * Isolated design system for the editor UI, independent of merchant themes.
 * All components use CSS modules for styling.
 */

export { Button } from "./Button/Button";
export type { ButtonProps } from "./Button/Button";

export { IconButton } from "./IconButton/IconButton";
export type { IconButtonProps } from "./IconButton/IconButton";

export { Badge } from "./Badge/Badge";
export type { BadgeProps } from "./Badge/Badge";

export { Dropdown } from "./Dropdown/Dropdown";
export type { DropdownOption, DropdownProps } from "./Dropdown/Dropdown";

export {
  Sidebar as DesignSidebar,
  SidebarHeader as DesignSidebarHeader,
} from "./Sidebar/Sidebar";

export { Input } from "./Input/Input";
export type { InputProps } from "./Input/Input";

export { Switch } from "./Switch/Switch";
export type { SwitchProps } from "./Switch/Switch";

export { SpacingFields } from "./SpacingFields/SpacingFields";
export type {
  SpacingFieldsProps,
  SpacingSide,
  SpacingValue,
} from "./SpacingFields/SpacingFields";

export { Modal } from "./Modal/Modal";
export type { ModalProps, ModalSize } from "./Modal/Modal";
