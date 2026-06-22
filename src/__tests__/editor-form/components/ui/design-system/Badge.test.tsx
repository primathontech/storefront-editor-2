// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Badge/Badge.tsx
//
// Badge is a pure presentational <span>. SUT runs for real. We render each
// variant/size (className branches), confirm children render, ref forwards,
// and arbitrary HTML attributes spread through. No mocks needed.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Badge } from "../../../../../editor-form/components/ui/design-system/Badge/Badge";

describe("Badge — rendering", () => {
  it("renders children inside a <span>", () => {
    render(<Badge>Draft</Badge>);
    const el = screen.getByText("Draft");
    expect(el.tagName).toBe("SPAN");
  });

  it("forwards the ref to the span", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>X</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it("spreads arbitrary attributes (data-*, title)", () => {
    render(
      <Badge data-testid="badge" title="tip">
        X
      </Badge>
    );
    const el = screen.getByTestId("badge");
    expect(el).toHaveAttribute("title", "tip");
  });

  it("applies a custom className", () => {
    render(<Badge className="extra">X</Badge>);
    expect(screen.getByText("X")).toHaveClass("extra");
  });
});

describe("Badge — variants and sizes", () => {
  const variants = ["draft", "published", "error", "warning", "info", "neutral"] as const;
  it.each(variants)("renders the %s variant", (variant) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    expect(screen.getByText(variant)).toBeInTheDocument();
  });

  const sizes = ["sm", "md", "lg"] as const;
  it.each(sizes)("renders the %s size", (size) => {
    render(<Badge size={size}>{size}</Badge>);
    expect(screen.getByText(size)).toBeInTheDocument();
  });
});
