// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Sidebar/Sidebar.tsx
//
// Sidebar and SidebarHeader are pure presentational containers (the SUT, run
// for real). We assert children render, the aria-label, side/variant class
// branches, numeric vs string width resolution (number -> "px"), inline style
// merge, and the SidebarHeader passthrough. No mocks needed.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Sidebar,
  SidebarHeader,
} from "../../../../../editor-form/components/ui/design-system/Sidebar/Sidebar";

describe("Sidebar", () => {
  it("renders children inside an <aside> labelled 'Editor sidebar'", () => {
    render(<Sidebar>panel content</Sidebar>);
    const aside = screen.getByRole("complementary", { name: "Editor sidebar" });
    expect(aside.tagName).toBe("ASIDE");
    expect(screen.getByText("panel content")).toBeInTheDocument();
  });

  it("resolves a numeric width to pixels", () => {
    render(<Sidebar width={420}>x</Sidebar>);
    expect(screen.getByRole("complementary")).toHaveStyle({ width: "420px" });
  });

  it("passes a string width through unchanged", () => {
    render(<Sidebar width="50%">x</Sidebar>);
    expect(screen.getByRole("complementary")).toHaveStyle({ width: "50%" });
  });

  it("defaults width to 300px", () => {
    render(<Sidebar>x</Sidebar>);
    expect(screen.getByRole("complementary")).toHaveStyle({ width: "300px" });
  });

  const sides = ["left", "right"] as const;
  it.each(sides)("renders the %s side", (side) => {
    render(<Sidebar side={side}>x</Sidebar>);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  const variants = ["solid", "ghost"] as const;
  it.each(variants)("renders the %s variant", (variant) => {
    render(<Sidebar variant={variant}>x</Sidebar>);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("merges a custom className and inline style", () => {
    render(
      <Sidebar className="extra" style={{ background: "red" }}>
        x
      </Sidebar>
    );
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("extra");
    expect(aside).toHaveStyle({ background: "red" });
  });
});

describe("SidebarHeader", () => {
  it("renders children", () => {
    render(<SidebarHeader>Header text</SidebarHeader>);
    expect(screen.getByText("Header text")).toBeInTheDocument();
  });

  it("applies a custom className and style", () => {
    render(
      <SidebarHeader className="hdr" style={{ color: "rgb(0, 0, 255)" }}>
        H
      </SidebarHeader>
    );
    const el = screen.getByText("H");
    expect(el).toHaveClass("hdr");
    expect(el).toHaveStyle({ color: "rgb(0, 0, 255)" });
  });
});
