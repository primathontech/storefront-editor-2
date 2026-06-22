// Component test — the theme-scoped strip atop the left sidebar (page
// title + locale switcher). Reads themeStore directly.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarChrome } from "../../components/SidebarChrome";
import { useThemeStore } from "../../stores/themeStore";

const resetTheme = (over: object = {}) =>
  useThemeStore.setState({
    theme: null,
    schemas: {},
    sections: {},
    currentTemplate: null,
    language: "en",
    assetsStatus: "idle",
    ...over,
  });

beforeEach(() => resetTheme());

describe("SidebarChrome", () => {
  it("shows the current template's name", () => {
    resetTheme({
      currentTemplate: { id: "home", name: "Home Page", supportedLanguages: ["en"] },
    });
    render(<SidebarChrome />);
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("falls back to the id when the template has no name", () => {
    resetTheme({ currentTemplate: { id: "about", supportedLanguages: ["en"] } });
    render(<SidebarChrome />);
    expect(screen.getByText("about")).toBeInTheDocument();
  });

  it("falls back to 'Untitled Page' when there is no current template", () => {
    resetTheme({ currentTemplate: null });
    render(<SidebarChrome />);
    expect(screen.getByText("Untitled Page")).toBeInTheDocument();
  });
});
