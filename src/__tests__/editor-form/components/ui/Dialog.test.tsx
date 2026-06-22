// SOURCE: apps/visual-editor/src/editor-form/components/ui/Dialog.tsx
//
// Behavioral test for the base modal/dialog. The Dialog is the SUT and runs
// for real (no portal — it renders inline). We exercise the open/closed
// branch, the title string vs node rendering, header action + footer slots,
// the close button, and the backdrop click that only closes when the click
// lands on the overlay itself (not bubbling from inner content).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "../../../../editor-form/components/ui/Dialog";

describe("Dialog — open / closed", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}}>
        <div>body</div>
      </Dialog>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("body")).toBeNull();
  });

  it("renders children when open", () => {
    render(
      <Dialog open onClose={() => {}}>
        <div>hello body</div>
      </Dialog>,
    );
    expect(screen.getByText("hello body")).toBeInTheDocument();
  });
});

describe("Dialog — header / title", () => {
  it("renders a string title as a heading", () => {
    render(
      <Dialog open onClose={() => {}} title="My Title">
        <div>x</div>
      </Dialog>,
    );
    expect(
      screen.getByRole("heading", { name: "My Title" }),
    ).toBeInTheDocument();
  });

  it("renders a ReactNode title without forcing a heading", () => {
    render(
      <Dialog open onClose={() => {}} title={<span>Custom Node Title</span>}>
        <div>x</div>
      </Dialog>,
    );
    expect(screen.getByText("Custom Node Title")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders the headerAction slot", () => {
    render(
      <Dialog open onClose={() => {}} headerAction={<button>Act</button>}>
        <div>x</div>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("renders the footer slot", () => {
    render(
      <Dialog open onClose={() => {}} footer={<div>footer-content</div>}>
        <div>x</div>
      </Dialog>,
    );
    expect(screen.getByText("footer-content")).toBeInTheDocument();
  });
});

describe("Dialog — closing", () => {
  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose}>
        <div>x</div>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop (overlay) itself is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open onClose={onClose}>
        <div data-testid="inner">x</div>
      </Dialog>,
    );
    // The overlay is the outermost rendered element (it owns the onClick).
    const overlay = container.firstElementChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when clicking inside the dialog surface", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose}>
        <div data-testid="inner">click me</div>
      </Dialog>,
    );
    // Clicking inner content: event.target !== overlay, so no close.
    fireEvent.click(screen.getByTestId("inner"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Dialog — size variants", () => {
  it.each(["sm", "md", "lg", "xl"] as const)(
    "renders without error for size=%s",
    (size) => {
      render(
        <Dialog open onClose={() => {}} size={size}>
          <div>sized</div>
        </Dialog>,
      );
      expect(screen.getByText("sized")).toBeInTheDocument();
    },
  );
});
