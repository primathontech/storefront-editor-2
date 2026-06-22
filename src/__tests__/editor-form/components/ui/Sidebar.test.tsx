// SOURCE: apps/visual-editor/src/editor-form/components/ui/Sidebar.tsx
//
// Pure presentational primitives (Sidebar / SidebarHeader / SidebarContent /
// SidebarScrollArea) — no stores, no heavy deps, so everything runs for real
// with no mocks. We assert the structural branches: width resolution (default
// / number / string / collapsed), border side, ref forwarding, header
// title/subtitle vs children override, and className passthrough.
import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarScrollArea,
} from "../../../../editor-form/components/ui/Sidebar";

describe("Sidebar — root", () => {
  it("renders children and defaults to 320px width with a right border", () => {
    render(
      <Sidebar data-testid="sb">
        <span>content</span>
      </Sidebar>,
    );
    const el = screen.getByTestId("sb");
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(el).toHaveStyle({ width: "320px" });
    expect(el.className).toContain("border-r");
  });

  it("resolves a numeric width to pixels", () => {
    render(
      <Sidebar data-testid="sb" width={240}>
        x
      </Sidebar>,
    );
    expect(screen.getByTestId("sb")).toHaveStyle({ width: "240px" });
  });

  it("passes a string width through unchanged", () => {
    render(
      <Sidebar data-testid="sb" width="50%">
        x
      </Sidebar>,
    );
    expect(screen.getByTestId("sb")).toHaveStyle({ width: "50%" });
  });

  it("collapses to 60px regardless of width", () => {
    render(
      <Sidebar data-testid="sb" width={400} collapsed>
        x
      </Sidebar>,
    );
    expect(screen.getByTestId("sb")).toHaveStyle({ width: "60px" });
  });

  it("uses a left border when borderSide is left", () => {
    render(
      <Sidebar data-testid="sb" borderSide="left">
        x
      </Sidebar>,
    );
    expect(screen.getByTestId("sb").className).toContain("border-l");
  });

  it("merges a custom className and inline style", () => {
    render(
      <Sidebar data-testid="sb" className="custom-x" style={{ opacity: 0.5 }}>
        x
      </Sidebar>,
    );
    const el = screen.getByTestId("sb");
    expect(el.className).toContain("custom-x");
    expect(el).toHaveStyle({ opacity: "0.5" });
  });

  it("forwards the ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sidebar ref={ref} data-testid="sb">
        x
      </Sidebar>,
    );
    expect(ref.current).toBe(screen.getByTestId("sb"));
  });
});

describe("SidebarHeader", () => {
  it("renders title and subtitle when no children are given", () => {
    render(<SidebarHeader title="Title" subtitle="Sub" data-testid="h" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Sub")).toBeInTheDocument();
  });

  it("renders children instead of title/subtitle when provided", () => {
    render(
      <SidebarHeader title="Title" data-testid="h">
        <span>custom</span>
      </SidebarHeader>,
    );
    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.queryByText("Title")).toBeNull();
  });

  it("forwards the ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<SidebarHeader ref={ref} data-testid="h" />);
    expect(ref.current).toBe(screen.getByTestId("h"));
  });
});

describe("SidebarContent", () => {
  it("renders children and forwards the ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SidebarContent ref={ref} data-testid="c">
        <span>body</span>
      </SidebarContent>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByTestId("c"));
  });
});

describe("SidebarScrollArea", () => {
  it("renders children, merges className, and forwards the ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SidebarScrollArea ref={ref} data-testid="s" className="extra">
        <span>scroll</span>
      </SidebarScrollArea>,
    );
    const el = screen.getByTestId("s");
    expect(screen.getByText("scroll")).toBeInTheDocument();
    expect(el.className).toContain("extra");
    expect(ref.current).toBe(el);
  });
});
