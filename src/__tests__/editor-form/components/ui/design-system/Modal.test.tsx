// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Modal/Modal.tsx
//
// Modal is the SUT and runs for real. It composes the real Button (sibling
// design-system component, not mocked) for the default footer. We cover the
// open/closed render gate, title/aria-label, header actions, the default
// Cancel/primary footer wiring, custom footer override, hideDefaultFooter,
// the Escape-key onClose effect (and its cleanup when closed), and sizes.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../../../../../editor-form/components/ui/design-system/Modal/Modal";

describe("Modal — visibility", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}}>
        body
      </Modal>
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a dialog with children when open", () => {
    render(
      <Modal isOpen onClose={() => {}}>
        body content
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });
});

describe("Modal — header", () => {
  it("renders the title heading", () => {
    render(
      <Modal isOpen onClose={() => {}} title="My Title">
        x
      </Modal>
    );
    expect(screen.getByRole("heading", { name: "My Title" })).toBeInTheDocument();
  });

  it("uses aria-label when no title", () => {
    render(
      <Modal isOpen onClose={() => {}} aria-label="Labelled dialog">
        x
      </Modal>
    );
    expect(
      screen.getByRole("dialog", { name: "Labelled dialog" })
    ).toBeInTheDocument();
  });

  it("renders header actions", () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="t"
        headerActions={<button>Act</button>}
      >
        x
      </Modal>
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });
});

describe("Modal — default footer", () => {
  it("renders a Cancel button that calls onClose", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        x
      </Modal>
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the primary action button only when onPrimaryAction is given", () => {
    const onPrimary = vi.fn();
    render(
      <Modal
        isOpen
        onClose={() => {}}
        primaryActionLabel="Save"
        onPrimaryAction={onPrimary}
      >
        x
      </Modal>
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("omits the primary button when onPrimaryAction is absent", () => {
    render(
      <Modal isOpen onClose={() => {}} primaryActionLabel="Save">
        x
      </Modal>
    );
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("renders a custom footer instead of the default buttons", () => {
    render(
      <Modal isOpen onClose={() => {}} footer={<span>custom footer</span>}>
        x
      </Modal>
    );
    expect(screen.getByText("custom footer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("hides the default footer when hideDefaultFooter is set", () => {
    render(
      <Modal isOpen onClose={() => {}} hideDefaultFooter>
        x
      </Modal>
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});

describe("Modal — escape key", () => {
  it("calls onClose when Escape is pressed while open", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        x
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Escape when closed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={false} onClose={onClose}>
        x
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        x
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Modal — sizes", () => {
  const sizes = ["sm", "md", "lg"] as const;
  it.each(sizes)("renders the %s size", (size) => {
    render(
      <Modal isOpen onClose={() => {}} size={size} title={size}>
        x
      </Modal>
    );
    expect(screen.getByRole("heading", { name: size })).toBeInTheDocument();
  });
});
