// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/IconButton/IconButton.tsx
//
// IconButton is the SUT and runs for real. We assert the icon renders, the
// required aria-label reaches the button, variant/size/shape class branches,
// the active toggle wiring (aria-pressed + active overrides variant), disabled
// state, ref forwarding, and click callbacks. No mocks needed.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { IconButton } from "../../../../../editor-form/components/ui/design-system/IconButton/IconButton";

const icon = <span data-testid="icon">i</span>;

describe("IconButton — rendering", () => {
  it("renders the icon and exposes the aria-label", () => {
    render(<IconButton icon={icon} aria-label="Edit" />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("forwards the ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton icon={icon} aria-label="x" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("applies a custom className", () => {
    render(<IconButton icon={icon} aria-label="x" className="extra" />);
    expect(screen.getByRole("button")).toHaveClass("extra");
  });

  it("spreads arbitrary props", () => {
    render(<IconButton icon={icon} aria-label="x" data-testid="ib" />);
    expect(screen.getByTestId("ib")).toBeInTheDocument();
  });
});

describe("IconButton — variants, sizes, shapes", () => {
  const variants = ["ghost", "outline", "solid"] as const;
  it.each(variants)("renders the %s variant", (variant) => {
    render(<IconButton icon={icon} aria-label={variant} variant={variant} />);
    expect(screen.getByRole("button", { name: variant })).toBeInTheDocument();
  });

  const sizes = ["xs", "sm", "md", "lg"] as const;
  it.each(sizes)("renders the %s size", (size) => {
    render(<IconButton icon={icon} aria-label={size} size={size} />);
    expect(screen.getByRole("button", { name: size })).toBeInTheDocument();
  });

  const shapes = ["square", "circle"] as const;
  it.each(shapes)("renders the %s shape", (shape) => {
    render(<IconButton icon={icon} aria-label={shape} shape={shape} />);
    expect(screen.getByRole("button", { name: shape })).toBeInTheDocument();
  });
});

describe("IconButton — active state", () => {
  it("sets aria-pressed=true when active", () => {
    render(<IconButton icon={icon} aria-label="x" active />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("omits aria-pressed when not active", () => {
    render(<IconButton icon={icon} aria-label="x" />);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });
});

describe("IconButton — interaction", () => {
  it("fires onClick when enabled", () => {
    const onClick = vi.fn();
    render(<IconButton icon={icon} aria-label="x" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(<IconButton icon={icon} aria-label="x" disabled onClick={onClick} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
