// Component test — the booting/error placeholder for the left sidebar.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SidebarSkeleton } from "../../components/SidebarSkeleton";

describe("SidebarSkeleton", () => {
  it("renders four pulse rows", () => {
    const { container } = render(<SidebarSkeleton />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("is decorative (aria-hidden) so it's skipped by assistive tech", () => {
    const { container } = render(<SidebarSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden");
  });
});
