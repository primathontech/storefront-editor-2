import * as React from "react";
import { Modal } from "./design-system";

export interface ConfirmOptions {
  /** Dialog heading, e.g. "Remove section?". */
  title: string;
  /** Body text explaining the consequence of confirming. */
  message?: React.ReactNode;
  /** Label for the confirm (primary) button. Default "Remove". */
  confirmLabel?: string;
}

type PendingConfirm = ConfirmOptions & { onConfirm: () => void };

/**
 * Imperative confirm dialog for destructive actions. Call
 * `confirm(options, onConfirm)` to open the dialog; `onConfirm` runs only if the
 * user clicks the confirm button. Render `{dialog}` once in the component. Built
 * on the design-system Modal, whose default footer already supplies the
 * Cancel / primary-action row.
 */
export function useConfirm() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions, onConfirm: () => void) =>
      setPending({ ...options, onConfirm }),
    []
  );

  const close = React.useCallback(() => setPending(null), []);

  const dialog = pending ? (
    <Modal
      isOpen
      size="sm"
      title={pending.title}
      primaryActionLabel={pending.confirmLabel ?? "Remove"}
      onPrimaryAction={() => {
        pending.onConfirm();
        setPending(null);
      }}
      onClose={close}
    >
      {pending.message}
    </Modal>
  ) : null;

  return { confirm, dialog };
}
