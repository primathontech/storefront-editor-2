// SOURCE: apps/visual-editor/src/editor-form/components/ui/SidebarSectionGroup.tsx
//
// A prop-driven, editor-only list row — no stores and no heavy deps (the only
// imports are plain inline-SVG icon components), so the SUT and its icon
// children all run for real with no mocks. We assert the structural branches:
// widget titles, selected-widget highlight, error vs selected styling, the
// stretched-link / per-widget click callbacks, the visibility toggle (both
// labels), and the optional add-section chip.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SidebarSectionGroup } from "../../../../editor-form/components/ui/SidebarSectionGroup";

const section = (widgets: unknown[] = []) => ({
  id: "sec1",
  type: "ContentSection",
  widgets,
});
const widget = (id: string, extra: object = {}) => ({
  id,
  type: "Heading",
  ...extra,
});

describe("SidebarSectionGroup — rendering", () => {
  it("renders a testid keyed by section id", () => {
    render(<SidebarSectionGroup section={section()} />);
    expect(screen.getByTestId("section-sec1")).toBeInTheDocument();
  });

  it("renders one title per widget, using name then type then section id", () => {
    render(
      <SidebarSectionGroup
        section={section([
          widget("w1", { name: "Named" }),
          widget("w2", { name: undefined, type: "Banner" }),
        ])}
      />,
    );
    expect(screen.getByText("Named")).toBeInTheDocument();
    expect(screen.getByText("Banner")).toBeInTheDocument();
  });

  it("falls back to the section id when a widget has no name or type", () => {
    render(
      <SidebarSectionGroup
        section={{ id: "sec1", widgets: [{ id: "w1" }] }}
      />,
    );
    expect(screen.getByText("sec1")).toBeInTheDocument();
  });

  it("renders nothing in the content area when there are no widgets", () => {
    render(<SidebarSectionGroup section={section([])} />);
    // No stretched link without a first widget.
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("SidebarSectionGroup — selection highlight", () => {
  it("applies the selected style on the matching widget title", () => {
    render(
      <SidebarSectionGroup
        section={section([widget("w1", { name: "A" })])}
        selectedWidgetId="w1"
      />,
    );
    expect(screen.getByText("A")).toHaveStyle({ fontWeight: "600" });
  });

  it("does not highlight a non-selected widget", () => {
    render(
      <SidebarSectionGroup
        section={section([widget("w1", { name: "A" })])}
        selectedWidgetId="other"
      />,
    );
    expect(screen.getByText("A")).not.toHaveStyle({ fontWeight: "600" });
  });
});

describe("SidebarSectionGroup — errors", () => {
  it("renders the error icon with a pluralized title when errors exist", () => {
    render(
      <SidebarSectionGroup
        section={section([widget("w1")])}
        sectionErrors={[{ msg: "a" }, { msg: "b" }]}
      />,
    );
    expect(
      screen.getByTitle("2 HTML validation errors"),
    ).toBeInTheDocument();
  });

  it("uses the singular title for a single error", () => {
    render(
      <SidebarSectionGroup
        section={section([widget("w1")])}
        sectionErrors={[{ msg: "a" }]}
      />,
    );
    expect(screen.getByTitle("1 HTML validation error")).toBeInTheDocument();
  });

  it("renders no error icon when there are no errors", () => {
    render(<SidebarSectionGroup section={section([widget("w1")])} />);
    expect(screen.queryByTitle(/HTML validation error/)).toBeNull();
  });
});

describe("SidebarSectionGroup — click callbacks", () => {
  it("fires onWidgetClick with the first widget via the stretched link", () => {
    const onWidgetClick = vi.fn();
    render(
      <SidebarSectionGroup
        section={section([widget("w1"), widget("w2")])}
        onWidgetClick={onWidgetClick}
      />,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(onWidgetClick).toHaveBeenCalledWith("w1", "sec1");
  });

  it("fires onWidgetClick for the specific widget title clicked", () => {
    const onWidgetClick = vi.fn();
    render(
      <SidebarSectionGroup
        section={section([
          widget("w1", { name: "A" }),
          widget("w2", { name: "B" }),
        ])}
        onWidgetClick={onWidgetClick}
      />,
    );
    fireEvent.click(screen.getByText("B"));
    expect(onWidgetClick).toHaveBeenCalledWith("w2", "sec1");
  });

  it("omits the stretched link when no onWidgetClick is given", () => {
    render(<SidebarSectionGroup section={section([widget("w1")])} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("SidebarSectionGroup — visibility toggle", () => {
  it("shows the hide affordance when visible and fires the toggle", () => {
    const onToggleVisibility = vi.fn();
    render(
      <SidebarSectionGroup
        section={section([widget("w1")])}
        onToggleVisibility={onToggleVisibility}
        isVisible
      />,
    );
    const btn = screen.getByRole("button", { name: "Hide section" });
    fireEvent.click(btn);
    expect(onToggleVisibility).toHaveBeenCalledWith("sec1");
  });

  it("shows the show affordance when hidden", () => {
    render(
      <SidebarSectionGroup
        section={section([widget("w1")])}
        onToggleVisibility={() => {}}
        isVisible={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Show section" }),
    ).toBeInTheDocument();
  });

  it("renders no visibility button without the callback", () => {
    render(<SidebarSectionGroup section={section([widget("w1")])} />);
    expect(
      screen.queryByRole("button", { name: /section/ }),
    ).toBeNull();
  });
});

describe("SidebarSectionGroup — add section chip", () => {
  it("renders the chip and fires onAddSection when provided", () => {
    const onAddSection = vi.fn();
    render(
      <SidebarSectionGroup
        section={section([widget("w1")])}
        onAddSection={onAddSection}
      />,
    );
    fireEvent.click(screen.getByText("Add Section"));
    expect(onAddSection).toHaveBeenCalledWith("sec1");
  });

  it("omits the chip when no onAddSection is given", () => {
    render(<SidebarSectionGroup section={section([widget("w1")])} />);
    expect(screen.queryByText("Add Section")).toBeNull();
  });
});

describe("SidebarSectionGroup — drag wiring", () => {
  it("applies the drag style and spreads listeners onto the handle", () => {
    const onMouseDown = vi.fn();
    render(
      <SidebarSectionGroup
        section={section([widget("w1", { name: "A" })])}
        dragStyle={{ opacity: 0.3 }}
        dragListeners={{ onMouseDown }}
        dragAttributes={{ role: "button" }}
      />,
    );
    const group = screen.getByTestId("section-sec1");
    expect(group).toHaveStyle({ opacity: "0.3" });
    // The handle carries the dragAttributes role and the listener.
    const handle = within(group).getByRole("button");
    fireEvent.mouseDown(handle);
    expect(onMouseDown).toHaveBeenCalled();
  });
});
