// Layer 3 — Unit. Editor-wide UI prefs store (device + mode).
import { describe, it, expect, beforeEach } from "vitest";
import { useEditorUiStore } from "../../stores/editorUiStore";

describe("editorUiStore", () => {
  beforeEach(() => {
    useEditorUiStore.setState({ device: "desktop", mode: "edit" });
  });

  it("starts on desktop / edit", () => {
    const s = useEditorUiStore.getState();
    expect(s.device).toBe("desktop");
    expect(s.mode).toBe("edit");
  });

  it("setDevice updates the viewport", () => {
    useEditorUiStore.getState().setDevice("mobile");
    expect(useEditorUiStore.getState().device).toBe("mobile");
  });

  it("setMode toggles edit/preview", () => {
    useEditorUiStore.getState().setMode("preview");
    expect(useEditorUiStore.getState().mode).toBe("preview");
  });

  it("device and mode are independent", () => {
    const { setDevice, setMode } = useEditorUiStore.getState();
    setDevice("tablet");
    setMode("preview");
    const s = useEditorUiStore.getState();
    expect(s.device).toBe("tablet");
    expect(s.mode).toBe("preview");
  });
});
