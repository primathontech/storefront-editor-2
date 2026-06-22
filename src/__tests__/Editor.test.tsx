// Component test — the persistent four-area editor shell. Renders the
// slot props and conditionally mounts the right sidebar. (It also renders
// SidebarChrome, which reads themeStore — reset to defaults here.)
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Editor } from "../Editor";
import { useThemeStore } from "../stores/themeStore";

beforeEach(() =>
  useThemeStore.setState({
    theme: null,
    schemas: {},
    sections: {},
    currentTemplate: null,
    language: "en",
    assetsStatus: "idle",
  }),
);

describe("Editor shell", () => {
  it("renders the header, left sidebar and preview slots", () => {
    render(
      <Editor
        header={<div>HEADER</div>}
        leftSidebar={<div>LEFT</div>}
        preview={<div>PREVIEW</div>}
      />,
    );
    expect(screen.getByText("HEADER")).toBeInTheDocument();
    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("PREVIEW")).toBeInTheDocument();
  });

  it("omits the right sidebar slot when not provided", () => {
    render(
      <Editor
        header={<div>H</div>}
        leftSidebar={<div>L</div>}
        preview={<div>P</div>}
      />,
    );
    expect(screen.queryByText("RIGHT")).not.toBeInTheDocument();
  });

  it("renders the right sidebar slot when provided", () => {
    render(
      <Editor
        header={<div>H</div>}
        leftSidebar={<div>L</div>}
        preview={<div>P</div>}
        rightSidebar={<div>RIGHT</div>}
      />,
    );
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });

  it("exposes the preview region with an accessible label", () => {
    render(
      <Editor header={<div>H</div>} leftSidebar={<div>L</div>} preview={<div>P</div>} />,
    );
    expect(screen.getByRole("main", { name: "Preview" })).toBeInTheDocument();
  });
});
