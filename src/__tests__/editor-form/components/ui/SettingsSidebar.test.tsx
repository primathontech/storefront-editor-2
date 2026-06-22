// SOURCE: apps/visual-editor/src/editor-form/components/ui/SettingsSidebar.tsx
//
// The SettingsSidebar is the SUT and runs for real, driven by the REAL
// templateStore + themeStore (seeded via setState in beforeEach) and the real
// RightSidebarWidthProvider. We mock only the leaf children that would pull
// heavy deps or that are tested elsewhere: DynamicForm (Monaco/quill/dnd-kit),
// RemoveSectionButton, SidebarSkeleton, the design-system shell, and the
// preview-bridge network boundary. The DynamicForm mock surfaces its props as
// data-attributes so we can assert which schema/values it received and fire
// the onUpdate callback to drive the section/widget update handlers.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- Leaf mocks (dependencies, not the SUT) --------------------------------
// DynamicForm: render a probe per instance. It exposes the values it got and a
// button that fires onUpdate so the section/widget handlers run for real.
vi.mock("../../../../editor-form/components/ui/DynamicForm", () => ({
  DynamicForm: ({ values, onUpdate, sectionId }: any) => (
    <div
      data-testid="dynamic-form"
      data-values={JSON.stringify(values ?? null)}
      data-section-id={sectionId ?? ""}
    >
      <button
        type="button"
        data-testid="form-update"
        onClick={() => onUpdate?.("color", "red")}
      >
        update
      </button>
    </div>
  ),
}));
vi.mock("../../../../editor-form/components/ui/RemoveSectionButton", () => ({
  RemoveSectionButton: ({ onClick }: any) => (
    <button type="button" data-testid="remove-section" onClick={onClick}>
      remove
    </button>
  ),
}));
vi.mock("../../../../components/SidebarSkeleton", () => ({
  SidebarSkeleton: () => <div data-testid="sidebar-skeleton" />,
}));
// design-system shell: pass children through so structure renders in jsdom.
vi.mock("../../../../editor-form/components/ui/design-system", () => ({
  DesignSidebar: ({ children }: any) => (
    <div data-testid="design-sidebar">{children}</div>
  ),
  DesignSidebarHeader: ({ children }: any) => (
    <div data-testid="design-sidebar-header">{children}</div>
  ),
  IconButton: ({ onClick, "aria-label": ariaLabel }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick}>
      icon
    </button>
  ),
}));
// Keep the rest of the bridge real (templateStore imports commitServer from
// it); spy only on focusSection, which the close handler fires.
vi.mock("../../../../editor-form/preview-bridge", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, focusSection: vi.fn() };
});
// section-registry: a tiny fixed registry keyed by section type.
vi.mock("../../../../editor-form/schemas/section-registry", () => ({
  sectionRegistry: {
    ContentSection: {
      type: "ContentSection",
      name: "Content Section",
      settingsSchema: { padding: { type: "number", label: "Padding" } },
    },
  },
}));

import { SettingsSidebar } from "../../../../editor-form/components/ui/SettingsSidebar";
import { RightSidebarWidthProvider } from "../../../../editor-form/context/RightSidebarWidthContext";
import { useTemplateStore } from "../../../../stores/templateStore";
import { useThemeStore } from "../../../../stores/themeStore";
import { focusSection } from "../../../../editor-form/preview-bridge";

const renderSidebar = () =>
  render(
    <RightSidebarWidthProvider>
      <SettingsSidebar translationService={null} />
    </RightSidebarWidthProvider>,
  );

// A page config with one section holding one widget.
const seedConfig = () =>
  useTemplateStore.setState({
    pageConfig: {
      sections: [
        {
          id: "sec1",
          type: "ContentSection",
          settings: { padding: 4 },
          widgets: [
            {
              id: "w1",
              type: "Heading",
              name: "My Heading",
              settings: { text: "Hi" },
            },
          ],
        },
      ],
      dataSources: {},
    },
  });

const widgetSchemas = {
  Heading: {
    type: "Heading",
    name: "Heading",
    settingsSchema: { text: { type: "text", label: "Text" } },
  },
  CustomHtml: {
    type: "CustomHtml",
    name: "Custom HTML",
    settingsSchema: { html: { type: "html", label: "HTML" } },
  },
};

beforeEach(() => {
  useTemplateStore.getState().reset();
  useThemeStore.setState({
    schemas: widgetSchemas as never,
    sections: {},
    assetsStatus: "ready",
  });
});

describe("SettingsSidebar — header / title", () => {
  it("shows the generic 'Settings' title when nothing is selected", () => {
    renderSidebar();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows the section schema name when only a section is selected", () => {
    seedConfig();
    useTemplateStore.setState({ selectedSectionId: "sec1" });
    renderSidebar();
    expect(screen.getByText("Content Section")).toBeInTheDocument();
  });

  it("shows the widget name when a widget is selected", () => {
    seedConfig();
    useTemplateStore.setState({
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    expect(screen.getByText("My Heading")).toBeInTheDocument();
  });
});

describe("SettingsSidebar — schema readiness gating", () => {
  it("renders the skeleton (no forms) while assets are not ready", () => {
    seedConfig();
    useThemeStore.setState({ assetsStatus: "idle" });
    useTemplateStore.setState({
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    expect(screen.getByTestId("sidebar-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("dynamic-form")).toBeNull();
  });
});

describe("SettingsSidebar — widget + section forms", () => {
  it("renders both the widget form and the section form for a normal widget", () => {
    seedConfig();
    useTemplateStore.setState({
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    // widget form + section form (CustomHtml exception not triggered).
    expect(screen.getAllByTestId("dynamic-form")).toHaveLength(2);
  });

  it("hides the section form for a Custom HTML widget", () => {
    useTemplateStore.setState({
      pageConfig: {
        sections: [
          {
            id: "sec1",
            type: "ContentSection",
            settings: {},
            widgets: [{ id: "w1", type: "CustomHtml", settings: {} }],
          },
        ],
        dataSources: {},
      },
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    // only the widget form, no section form.
    expect(screen.getAllByTestId("dynamic-form")).toHaveLength(1);
  });

  it("renders no forms when the selected widget has an unknown schema", () => {
    useTemplateStore.setState({
      pageConfig: {
        sections: [
          {
            id: "sec1",
            type: "ContentSection",
            settings: {},
            widgets: [{ id: "w1", type: "Unknown", settings: {} }],
          },
        ],
        dataSources: {},
      },
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    expect(screen.queryByTestId("dynamic-form")).toBeNull();
  });
});

describe("SettingsSidebar — update handlers", () => {
  it("widget form onUpdate writes through to the widget settings", () => {
    seedConfig();
    useTemplateStore.setState({
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    // First form is the widget form.
    fireEvent.click(screen.getAllByTestId("form-update")[0]);
    const w =
      useTemplateStore.getState().pageConfig.sections[0].widgets[0];
    expect(w.settings.color).toBe("red");
    expect(w.settings.text).toBe("Hi"); // merge, not replace
  });

  it("section form onUpdate writes through to the section settings", () => {
    seedConfig();
    useTemplateStore.setState({
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
    });
    renderSidebar();
    // Second form is the section form.
    fireEvent.click(screen.getAllByTestId("form-update")[1]);
    const sec = useTemplateStore.getState().pageConfig.sections[0];
    expect(sec.settings.color).toBe("red");
    expect(sec.settings.padding).toBe(4); // merge, not replace
  });
});

describe("SettingsSidebar — remove section", () => {
  it("shows the remove button only when the section is in the library", () => {
    seedConfig();
    useThemeStore.setState({
      sections: { sec1: { id: "sec1" } } as never,
    });
    useTemplateStore.setState({ selectedSectionId: "sec1" });
    renderSidebar();
    expect(screen.getByTestId("remove-section")).toBeInTheDocument();
  });

  it("hides the remove button when the section is not in the library", () => {
    seedConfig();
    useTemplateStore.setState({ selectedSectionId: "sec1" });
    renderSidebar();
    expect(screen.queryByTestId("remove-section")).toBeNull();
  });

  it("clicking remove drops the section from the config", () => {
    seedConfig();
    useThemeStore.setState({
      sections: { sec1: { id: "sec1" } } as never,
    });
    useTemplateStore.setState({ selectedSectionId: "sec1" });
    renderSidebar();
    fireEvent.click(screen.getByTestId("remove-section"));
    expect(useTemplateStore.getState().pageConfig.sections).toHaveLength(0);
  });
});

describe("SettingsSidebar — close", () => {
  it("close clears selection, hides the drawer, and clears the iframe focus", () => {
    seedConfig();
    useTemplateStore.setState({
      selectedSectionId: "sec1",
      selectedWidgetId: "w1",
      showSettingsDrawer: true,
    });
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    const s = useTemplateStore.getState();
    expect(s.selectedSectionId).toBeNull();
    expect(s.selectedWidgetId).toBeNull();
    expect(s.showSettingsDrawer).toBe(false);
    expect(focusSection).toHaveBeenCalledWith(null);
  });
});
