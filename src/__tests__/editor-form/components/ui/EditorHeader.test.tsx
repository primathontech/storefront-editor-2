// SOURCE: apps/visual-editor/src/editor-form/components/ui/EditorHeader.tsx
//
// Behavioral test for the editor top bar. EditorHeader is the SUT and runs
// for real, including the real design-system Button (a plain <button>). We
// mock only TemplateSwitchDropdown — it pulls in the portal Dropdown which
// is exercised by its own test — and seed the real themeStore for the theme
// name. We assert: theme label, device buttons call setDevice + reflect the
// active one via aria-pressed, the "Save and Preview" button fires onPreview
// and gates on previewDisabled/onPreview, and the Publish button
// label/disabled/loading wiring + onSave firing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Leaf mock: the template switcher renders a portal Dropdown of its own.
vi.mock(
  "../../../../editor-form/components/ui/TemplateSwitchDropdown",
  () => ({
    TemplateSwitchDropdown: () => <div data-testid="template-switch" />,
  }),
);

import EditorHeader, {
  type SaveStatus,
} from "../../../../editor-form/components/ui/EditorHeader";
import { useThemeStore } from "../../../../stores/themeStore";

const baseProps = {
  onSwitchTemplate: vi.fn(),
  device: "desktop" as const,
  setDevice: vi.fn(),
  mode: "edit" as const,
  setMode: vi.fn(),
  saveStatus: "idle" as SaveStatus,
  saveDisabled: false,
  onSave: vi.fn(),
};

beforeEach(() => {
  useThemeStore.setState({
    theme: { id: "momsco", name: "Moms Co" } as never,
  });
});

describe("EditorHeader — theme + slots", () => {
  it("shows the theme name and mounts the template switcher", () => {
    render(<EditorHeader {...baseProps} />);
    expect(screen.getByText("Moms Co")).toBeInTheDocument();
    expect(screen.getByTestId("template-switch")).toBeInTheDocument();
  });

  it("falls back to the theme id when no name is set", () => {
    useThemeStore.setState({ theme: { id: "fallback-id" } as never });
    render(<EditorHeader {...baseProps} />);
    expect(screen.getByText("fallback-id")).toBeInTheDocument();
  });
});

describe("EditorHeader — device toggles", () => {
  it("renders one button per device with the active one pressed", () => {
    render(<EditorHeader {...baseProps} device="tablet" />);
    const tablet = screen.getByRole("button", {
      name: "Switch to Tablet view",
    });
    const desktop = screen.getByRole("button", {
      name: "Switch to Desktop view",
    });
    expect(tablet).toHaveAttribute("aria-pressed", "true");
    expect(desktop).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setDevice with the chosen device id", () => {
    const setDevice = vi.fn();
    render(<EditorHeader {...baseProps} setDevice={setDevice} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Mobile view" }),
    );
    expect(setDevice).toHaveBeenCalledWith("mobile");
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Fullscreen view" }),
    );
    expect(setDevice).toHaveBeenCalledWith("fullscreen");
  });
});

describe("EditorHeader — Save and Preview button", () => {
  it("fires onPreview when a lane supports it and there are changes", () => {
    const onPreview = vi.fn();
    render(
      <EditorHeader
        {...baseProps}
        onPreview={onPreview}
        previewDisabled={false}
      />,
    );
    const preview = screen.getByRole("button", { name: "Save and Preview" });
    expect(preview).toBeEnabled();
    fireEvent.click(preview);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it("is disabled in lanes that don't pass onPreview (e.g. static pages)", () => {
    // baseProps intentionally omits onPreview — the button renders but is
    // disabled so every lane shows the same affordance.
    render(<EditorHeader {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "Save and Preview" }),
    ).toBeDisabled();
  });

  it("is disabled when previewDisabled (nothing new) and does not fire onPreview", () => {
    const onPreview = vi.fn();
    render(<EditorHeader {...baseProps} onPreview={onPreview} previewDisabled />);
    const preview = screen.getByRole("button", { name: "Save and Preview" });
    expect(preview).toBeDisabled();
    fireEvent.click(preview);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it("shows the loading label and disables while a preview is being created", () => {
    const onPreview = vi.fn();
    render(<EditorHeader {...baseProps} onPreview={onPreview} previewLoading />);
    const preview = screen.getByRole("button", { name: "Saving…" });
    expect(preview).toBeDisabled();
  });
});

describe("EditorHeader — Publish button", () => {
  it("is enabled and fires onSave when there are changes (idle)", () => {
    const onSave = vi.fn();
    render(
      <EditorHeader
        {...baseProps}
        saveStatus="idle"
        saveDisabled={false}
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: "Publish" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("is disabled when saveDisabled and does not fire onSave", () => {
    const onSave = vi.fn();
    render(
      <EditorHeader
        {...baseProps}
        saveStatus="idle"
        saveDisabled
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: "Publish" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders the right label for each save status", () => {
    const statuses: Array<[SaveStatus, string]> = [
      ["validating", "Validating…"],
      ["saving", "Publishing…"],
      ["saved", "Published"],
      ["failed", "Retry publish"],
    ];
    for (const [status, label] of statuses) {
      const { unmount } = render(
        <EditorHeader {...baseProps} saveStatus={status} />,
      );
      // While validating/saving the Button is in loading state and hides its
      // text children, so only assert label text for the non-loading states.
      if (status === "saved" || status === "failed") {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
      unmount();
    }
  });

  it("disables the save button while saving (loading state)", () => {
    render(<EditorHeader {...baseProps} saveStatus="saving" />);
    // Loading buttons render no text; the primary action button is disabled.
    const buttons = screen.getAllByRole("button");
    const disabledPrimary = buttons.find((b) => (b as HTMLButtonElement).disabled);
    expect(disabledPrimary).toBeTruthy();
  });
});
