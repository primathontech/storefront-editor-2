// SOURCE: apps/visual-editor/src/editor-form/components/ui/icons/*.tsx
//
// Render-only SVG icon components. They're pure presentational leaves, so a
// single data-driven smoke test is the right altitude: render each, confirm
// it emits an <svg>, and confirm the SVGProps spread reaches the element
// (className passes through). The two icons that take `(props)` directly
// (DragDotsIcon, TrashRedIcon) exercise the same passthrough as the ones
// that destructure className/style first.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type React from "react";

import { AddCircleIcon } from "../../../../editor-form/components/ui/icons/AddCircleIcon";
import { ChevronDownIcon } from "../../../../editor-form/components/ui/icons/ChevronDownIcon";
import { ChevronUpIcon } from "../../../../editor-form/components/ui/icons/ChevronUpIcon";
import { CloseIcon } from "../../../../editor-form/components/ui/icons/CloseIcon";
import { DragDotsIcon } from "../../../../editor-form/components/ui/icons/DragDotsIcon";
import { EditIcon } from "../../../../editor-form/components/ui/icons/EditIcon";
import { HeaderHomeIcon } from "../../../../editor-form/components/ui/icons/HeaderHomeIcon";
import { HeaderMobileIcon } from "../../../../editor-form/components/ui/icons/HeaderMobileIcon";
import { HeaderMonitorIcon } from "../../../../editor-form/components/ui/icons/HeaderMonitorIcon";
import { HeaderStackedIcon } from "../../../../editor-form/components/ui/icons/HeaderStackedIcon";
import { HeaderTabletIcon } from "../../../../editor-form/components/ui/icons/HeaderTabletIcon";
import { HtmlErrorIcon } from "../../../../editor-form/components/ui/icons/HtmlErrorIcon";
import { LayoutIcon } from "../../../../editor-form/components/ui/icons/LayoutIcon";
import { MediaIcon } from "../../../../editor-form/components/ui/icons/MediaIcon";
import { PreviewIcon } from "../../../../editor-form/components/ui/icons/PreviewIcon";
import { TrashRedIcon } from "../../../../editor-form/components/ui/icons/TrashIcon";
import {
  VisibilityIcon,
  VisibilityOffIcon,
} from "../../../../editor-form/components/ui/icons/VisibilityIcon";

type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

const ICONS: Array<[string, IconComponent]> = [
  ["AddCircleIcon", AddCircleIcon],
  ["ChevronDownIcon", ChevronDownIcon],
  ["ChevronUpIcon", ChevronUpIcon],
  ["CloseIcon", CloseIcon],
  ["DragDotsIcon", DragDotsIcon],
  ["EditIcon", EditIcon],
  ["HeaderHomeIcon", HeaderHomeIcon],
  ["HeaderMobileIcon", HeaderMobileIcon],
  ["HeaderMonitorIcon", HeaderMonitorIcon],
  ["HeaderStackedIcon", HeaderStackedIcon],
  ["HeaderTabletIcon", HeaderTabletIcon],
  ["HtmlErrorIcon", HtmlErrorIcon],
  ["LayoutIcon", LayoutIcon],
  ["MediaIcon", MediaIcon],
  ["PreviewIcon", PreviewIcon],
  ["TrashRedIcon", TrashRedIcon],
  ["VisibilityIcon", VisibilityIcon],
  ["VisibilityOffIcon", VisibilityOffIcon],
];

// These five destructure `className`/`style` out of props but never apply
// them back onto the <svg> — so the class is silently dropped. Documented
// here rather than papered over; everything else forwards className.
const DROPS_CLASSNAME = new Set([
  "HeaderMobileIcon",
  "HeaderMonitorIcon",
  "HeaderStackedIcon",
  "HeaderTabletIcon",
  "HtmlErrorIcon",
]);

describe("UI icons", () => {
  // `data-testid` lives in ...props for every icon (none destructure it), so
  // this passthrough holds universally and confirms each renders an <svg>.
  it.each(ICONS)("%s renders an <svg> and forwards arbitrary props", (_name, Icon) => {
    const { container } = render(<Icon data-testid="ico" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("data-testid", "ico");
  });

  const forwarders = ICONS.filter(([name]) => !DROPS_CLASSNAME.has(name));
  it.each(forwarders)("%s forwards className onto the <svg>", (_name, Icon) => {
    const { container } = render(<Icon className="ico-test" />);
    expect(container.querySelector("svg")).toHaveClass("ico-test");
  });

  const droppers = ICONS.filter(([name]) => DROPS_CLASSNAME.has(name));
  it.each(droppers)("%s drops className (known quirk)", (_name, Icon) => {
    const { container } = render(<Icon className="ico-test" />);
    expect(container.querySelector("svg")).not.toHaveClass("ico-test");
  });
});
