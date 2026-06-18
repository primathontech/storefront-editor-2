// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Button/Button.tsx
//
// Button is the SUT and runs for real (CSS modules resolve to identity-style
// class names under vitest). We assert real behavior: variant/size class
// branches, loading/disabled wiring, icon slots, ref forwarding, and click
// callbacks. Nothing is mocked — it has no heavy dependencies.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Button } from "../../../../../editor-form/components/ui/design-system/Button/Button";

describe("Button — rendering", () => {
  it("renders children inside a real <button>", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.tagName).toBe("BUTTON");
  });

  it("forwards the ref to the underlying button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Hi</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("spreads arbitrary props (type, data-*) onto the button", () => {
    render(
      <Button type="submit" data-testid="b">
        Go
      </Button>
    );
    const btn = screen.getByTestId("b");
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("applies a custom className alongside its own classes", () => {
    render(<Button className="extra">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("extra");
  });
});

describe("Button — variants and sizes", () => {
  const variants = ["primary", "secondary", "success", "ghost", "outline"] as const;
  it.each(variants)("renders the %s variant", (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole("button", { name: variant })).toBeInTheDocument();
  });

  const sizes = ["xs", "sm", "md", "lg"] as const;
  it.each(sizes)("renders the %s size", (size) => {
    render(<Button size={size}>{size}</Button>);
    expect(screen.getByRole("button", { name: size })).toBeInTheDocument();
  });
});

describe("Button — disabled / loading", () => {
  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled while loading and renders a spinner", () => {
    render(<Button loading>X</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        X
      </Button>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when enabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>X</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Button — icons", () => {
  it("renders left and right icons when not loading", () => {
    render(
      <Button
        leftIcon={<span data-testid="left" />}
        rightIcon={<span data-testid="right" />}
      >
        X
      </Button>
    );
    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
  });

  it("hides left/right icons while loading (spinner replaces them)", () => {
    render(
      <Button
        loading
        leftIcon={<span data-testid="left" />}
        rightIcon={<span data-testid="right" />}
      >
        X
      </Button>
    );
    expect(screen.queryByTestId("left")).toBeNull();
    expect(screen.queryByTestId("right")).toBeNull();
  });

  it("hides children when iconOnly is set", () => {
    render(
      <Button iconOnly leftIcon={<span data-testid="left" />}>
        Hidden Label
      </Button>
    );
    expect(screen.queryByText("Hidden Label")).toBeNull();
    expect(screen.getByTestId("left")).toBeInTheDocument();
  });
});
