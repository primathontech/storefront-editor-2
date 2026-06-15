// Component test — the single pre-Editor message surface (auth/theme
// loading + error states). Driven entirely by props.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FullPageMessage } from "../../components/FullPageMessage";

describe("FullPageMessage", () => {
  it("renders the title", () => {
    render(<FullPageMessage title="Authenticating…" />);
    expect(screen.getByRole("heading", { name: "Authenticating…" })).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<FullPageMessage title="Unauthorized" subtitle="Please reopen." />);
    expect(screen.getByText("Please reopen.")).toBeInTheDocument();
  });

  it("omits the subtitle when not provided", () => {
    render(<FullPageMessage title="Loading" />);
    expect(screen.queryByText("Please reopen.")).not.toBeInTheDocument();
  });

  it("shows the retry button only when onRetry is given, and calls it on click", async () => {
    const onRetry = vi.fn();
    render(<FullPageMessage title="Network error" onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: "Try again" });
    await userEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has no retry button when onRetry is absent", () => {
    render(<FullPageMessage title="Loading" spinner />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
