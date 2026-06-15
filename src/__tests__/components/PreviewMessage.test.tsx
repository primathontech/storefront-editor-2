// Component test — the over-iframe / boot / error message in the preview area.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewMessage } from "../../components/PreviewMessage";

describe("PreviewMessage", () => {
  it("renders the label", () => {
    render(<PreviewMessage label="Loading preview…" />);
    expect(screen.getByText("Loading preview…")).toBeInTheDocument();
  });

  it("shows a spinner (no retry button) when onRetry is absent", () => {
    render(<PreviewMessage label="Loading…" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a Retry button when onRetry is given and calls it on click", async () => {
    const onRetry = vi.fn();
    render(<PreviewMessage label="Failed to load page." onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
