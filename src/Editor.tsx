import type { ReactNode } from "react";
import { RightSidebarWidthProvider } from "./editor-form/context/RightSidebarWidthContext";
import { SidebarChrome } from "./components/SidebarChrome";

// Persistent editor shell. Owns the four-area grid + theme-scoped chrome
// (page title + locale switcher via SidebarChrome). Lanes pass slot
// props; the grid + chrome stays mounted across template AND lane
// switches so nothing flickers.
//
// Sizing matches legacy EditorHeader.module.css (60px) and
// Sidebar.module.css (0.5px #dfdfdf borders).
//
//   --editor-header-height (default 60px)
//   --editor-left-width    (default 384px)
//   right column is `auto` so the resizable settings panel sets its own width

export interface EditorProps {
  header: ReactNode;
  leftSidebar: ReactNode;
  preview: ReactNode;
  rightSidebar?: ReactNode;
}

export const Editor = ({
  header,
  leftSidebar,
  preview,
  rightSidebar,
}: EditorProps) => (
  <RightSidebarWidthProvider>
    <div
      data-testid="editor-root"
      className="grid h-screen overflow-hidden bg-editor-canvas"
      style={{
        // minmax(0, 1fr) — NOT bare 1fr. A 1fr row is minmax(auto, 1fr),
        // whose auto minimum grows to the tallest sidebar's content; with the
        // container's overflow-hidden that clips the sidebars instead of
        // letting their inner overflow-y-auto scroll. minmax(0,…) caps the row
        // to viewport-minus-header so the scroll areas get a bounded height.
        gridTemplateRows: "var(--editor-header-height, 60px) minmax(0, 1fr)",
        gridTemplateColumns: rightSidebar
          ? "var(--editor-left-width, 384px) 1fr auto"
          : "var(--editor-left-width, 384px) 1fr",
        gridTemplateAreas: rightSidebar
          ? '"header header header" "leftSidebar preview rightSidebar"'
          : '"header header" "leftSidebar preview"',
      }}
    >
      <header
        className="min-w-0 bg-white border-b-[0.5px] border-editor-border"
        style={{ gridArea: "header" }}
      >
        {header}
      </header>
      <div
        className="min-w-0 bg-white border-r-[0.5px] border-editor-border flex flex-col"
        style={{ gridArea: "leftSidebar" }}
      >
        <SidebarChrome />
        {/* Flex column so the lane's footer (Add Section) pins to the bottom
            and its scroll area (SidebarScrollArea, flex-1 overflow-y-auto)
            takes the remaining height. Don't add overflow-auto here — the
            scroll area handles its own scrolling. */}
        <div className="flex-1 min-h-0 flex flex-col">{leftSidebar}</div>
      </div>
      <main
        className="min-w-0 relative overflow-auto"
        style={{ gridArea: "preview" }}
        aria-label="Preview"
      >
        {preview}
      </main>
      {rightSidebar && (
        <div
          data-testid="settings-drawer"
          className="min-w-0"
          style={{ gridArea: "rightSidebar" }}
        >
          {rightSidebar}
        </div>
      )}
    </div>
  </RightSidebarWidthProvider>
);
