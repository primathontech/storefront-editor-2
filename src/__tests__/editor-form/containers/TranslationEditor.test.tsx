// SOURCE: apps/visual-editor/src/editor-form/containers/TranslationEditor.tsx
//
// Render-level smoke test for the static-translation-lane container. Same
// approach as TemplateEditor.test: the container + real
// translationSessionMachine run for real; only the leaves are mocked — the
// heavy input components (one pulls react-quill), the EditorHeader, the
// postMessage bridge, and the network boundary (EditorAPI). Driving the
// fetch promise walks the machine through its render branches; the
// no-template path is the store-guard branch (no early null return here —
// it renders a "No template selected." message instead).
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { render, screen } from "@testing-library/react";

// --- Leaf mocks (dependencies, not the SUT) --------------------------------
vi.mock("../../../editor-form/components/ui/EditorHeader", () => ({
  default: () => <div data-testid="editor-header" />,
}));
vi.mock("../../../editor-form/components/ui/ArrayInput", () => ({
  ArrayInput: () => <div data-testid="array-input" />,
}));
vi.mock("../../../editor-form/components/ui/ObjectArrayInput", () => ({
  ObjectArrayInput: () => <div data-testid="object-array-input" />,
}));
vi.mock("../../../editor-form/components/ui/RichTextInput", () => ({
  RichTextInput: () => <div data-testid="rich-text-input" />,
}));
vi.mock("../../../editor-form/components/ui/design-system", () => ({
  Input: () => <div data-testid="design-input" />,
}));
vi.mock("../../../editor-form/translation-preview-bridge", () => ({
  registerTranslationBridge: vi.fn(),
  unregisterTranslationBridge: vi.fn(),
  commitTranslationPatch: vi.fn(),
  flushTranslationPatch: vi.fn(),
  focusTranslationKey: vi.fn(),
}));
vi.mock("../../../editor-form/services/api", () => ({
  EditorAPI: {
    getTranslation: vi.fn(),
    saveTranslation: vi.fn(),
  },
}));

import TranslationEditor from "../../../editor-form/containers/TranslationEditor";
import { EditorAPI } from "../../../editor-form/services/api";
import { useAuthStore } from "../../../stores/authStore";
import { useThemeStore } from "../../../stores/themeStore";

const getTranslation = EditorAPI.getTranslation as unknown as Mock;
const onSwitchTemplate = vi.fn();

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
    currentTemplate: { id: "privacy", name: "Privacy", routeContext: { path: "/privacy" } },
    language: "en",
  });
});

afterEach(() => {
  useAuthStore.getState().clear();
});

describe("TranslationEditor — render branches", () => {
  it("shows 'No template selected.' when no template is active", async () => {
    useThemeStore.setState({ currentTemplate: null });
    getTranslation.mockImplementation(pending);

    render(<TranslationEditor onSwitchTemplate={onSwitchTemplate} />);

    // findBy flushes the machine's microtask transition (the boot actor
    // throws on the missing template) under act so it doesn't warn.
    expect(
      await screen.findByText("No template selected."),
    ).toBeInTheDocument();
  });

  it("shows 'Loading page…' while booting", () => {
    getTranslation.mockImplementation(pending);

    render(<TranslationEditor onSwitchTemplate={onSwitchTemplate} />);

    expect(screen.getByText("Loading page…")).toBeInTheDocument();
    expect(screen.getByTestId("editor-header")).toBeInTheDocument();
  });

  it("shows the retry message when boot fetch fails", async () => {
    getTranslation.mockRejectedValue(new Error("boom"));

    render(<TranslationEditor onSwitchTemplate={onSwitchTemplate} />);

    expect(await screen.findByText("Failed to load page.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("mounts the preview iframe once boot data resolves (empty translations)", async () => {
    // No entries for this template → sidebar shows the empty-state copy.
    getTranslation.mockResolvedValue({});

    render(<TranslationEditor onSwitchTemplate={onSwitchTemplate} />);

    const iframe = await screen.findByTitle("translation preview");
    expect(iframe).toBeInTheDocument();
    expect(screen.getByText("Loading preview…")).toBeInTheDocument();
    expect(
      screen.getByText("No translations for this template."),
    ).toBeInTheDocument();
  });
});
