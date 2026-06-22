// SOURCE: apps/visual-editor/src/editor-form/containers/TemplateEditor.tsx
//
// Render-level smoke test for the dynamic-lane container. The SUT is the
// container + the real templateSessionMachine it wires up — those run for
// real. We mock only the leaves around it: the heavy child components
// (BuilderToolbar/EditorHeader/SettingsSidebar pull Monaco etc.), the
// postMessage preview bridge, and the network boundary (EditorAPI). Driving
// EditorAPI's promises (hang / reject / resolve) walks the machine through
// its three render branches; the store guard covers the early null return.
//
// We keep the Editor shell, PreviewMessage, and SidebarSkeleton real so the
// slot wiring and branch labels are asserted against actual output.
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { act, render, screen } from "@testing-library/react";

// --- Leaf mocks (dependencies, not the SUT) --------------------------------
vi.mock("../../../editor-form/components/ui/BuilderToolbar", () => ({
  default: () => <div data-testid="builder-toolbar" />,
}));
vi.mock("../../../editor-form/components/ui/EditorHeader", () => ({
  default: () => <div data-testid="editor-header" />,
}));
vi.mock("../../../editor-form/components/ui/SettingsSidebar", () => ({
  SettingsSidebar: () => <div data-testid="settings-sidebar" />,
}));
vi.mock("../../../editor-form/preview-bridge", () => ({
  registerPreviewBridge: vi.fn(),
  unregisterPreviewBridge: vi.fn(),
  commitServer: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }));
vi.mock("../../../editor-form/services/api", () => ({
  EditorAPI: {
    getTranslation: vi.fn(),
    getTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    saveTranslation: vi.fn(),
  },
}));

import TemplateEditor from "../../../editor-form/containers/TemplateEditor";
import { EditorAPI } from "../../../editor-form/services/api";
import { useAuthStore } from "../../../stores/authStore";
import { useThemeStore } from "../../../stores/themeStore";

const getTranslation = EditorAPI.getTranslation as unknown as Mock;
const getTemplate = EditorAPI.getTemplate as unknown as Mock;
const onSwitchTemplate = vi.fn();

// A promise that never settles — pins the boot actor in `bootingTemplate`.
const pending = () => new Promise<never>(() => {});

beforeEach(() => {
  useAuthStore.getState().setSession({
    token: "tok",
    merchant: {
      id: "m1",
      themeId: "momsco",
      previewOrigin: "https://store.test",
    },
  });
  useThemeStore.setState({
    currentTemplate: { id: "home", name: "Home", routeContext: { path: "/" } },
    language: "en",
  });
});

afterEach(() => {
  useAuthStore.getState().clear();
});

describe("TemplateEditor — render branches", () => {
  it("returns null (renders nothing) before a template is selected", async () => {
    useThemeStore.setState({ currentTemplate: null });
    getTemplate.mockImplementation(pending);
    getTranslation.mockImplementation(pending);

    // act(async) flushes the machine's microtask transition (the boot actor
    // throws on the missing template) so it doesn't warn after the test.
    await act(async () => {
      render(<TemplateEditor onSwitchTemplate={onSwitchTemplate} />);
    });

    // The Editor shell (its <main> preview region) is never mounted.
    expect(screen.queryByRole("main", { name: "Preview" })).toBeNull();
  });

  it("shows the loading skeleton + 'Loading page…' while booting", () => {
    // Hang the fetch so the machine stays in bootingTemplate.
    getTranslation.mockImplementation(pending);
    getTemplate.mockImplementation(pending);

    render(<TemplateEditor onSwitchTemplate={onSwitchTemplate} />);

    expect(screen.getByText("Loading page…")).toBeInTheDocument();
    // Header slot is always present; the resolved-only iframe is not yet.
    expect(screen.getByTestId("editor-header")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-iframe")).toBeNull();
  });

  it("shows the retry message when boot fetch fails", async () => {
    getTranslation.mockResolvedValue({});
    getTemplate.mockRejectedValue(new Error("boom"));

    render(<TemplateEditor onSwitchTemplate={onSwitchTemplate} />);

    expect(await screen.findByText("Failed to load page.")).toBeInTheDocument();
    // PreviewMessage renders a retry affordance when onRetry is provided.
    expect(
      screen.getByRole("button", { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it("mounts the preview iframe + toolbar once boot data resolves", async () => {
    getTranslation.mockResolvedValue({});
    getTemplate.mockResolvedValue({ sections: [{ id: "s1" }] });

    render(<TemplateEditor onSwitchTemplate={onSwitchTemplate} />);

    // editing.preview starts in waitingForIframe (tagged previewLoading).
    expect(await screen.findByTestId("preview-iframe")).toBeInTheDocument();
    expect(screen.getByText("Loading preview…")).toBeInTheDocument();
    expect(screen.getByTestId("builder-toolbar")).toBeInTheDocument();
  });
});
