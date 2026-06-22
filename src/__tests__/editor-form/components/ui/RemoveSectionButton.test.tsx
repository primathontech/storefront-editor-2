// Component test — the "Remove section" footer button.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemoveSectionButton } from "../../../../editor-form/components/ui/RemoveSectionButton";

describe("RemoveSectionButton", () => {
  it("renders a labelled button", () => {
    render(<RemoveSectionButton />);
    expect(
      screen.getByRole("button", { name: /remove section/i }),
    ).toBeInTheDocument();
  });

  it("invokes onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<RemoveSectionButton onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /remove section/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not throw when clicked without an onClick handler", async () => {
    render(<RemoveSectionButton />);
    await userEvent.click(screen.getByRole("button", { name: /remove section/i }));
    // no assertion needed — absence of a thrown error is the contract
  });
});
