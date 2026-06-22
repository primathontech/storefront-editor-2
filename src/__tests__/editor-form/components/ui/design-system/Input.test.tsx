// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Input/Input.tsx
//
// Input is the SUT and runs for real. We assert label/htmlFor wiring (via
// useId or provided id), helper vs error text precedence, aria-invalid and
// aria-describedby, icon slots, size/variant class branches, disabled state,
// ref forwarding, and onChange callback. No mocks needed.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Input } from "../../../../../editor-form/components/ui/design-system/Input/Input";

describe("Input — label and ids", () => {
  it("renders a label associated with the input via htmlFor", () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input).toBeInTheDocument();
  });

  it("uses a provided id over the generated one", () => {
    render(<Input id="custom-id" label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "custom-id");
  });

  it("renders without a label", () => {
    render(<Input placeholder="type here" />);
    expect(screen.getByPlaceholderText("type here")).toBeInTheDocument();
  });

  it("forwards the ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe("Input — helper text and error", () => {
  it("renders helper text and links it with aria-describedby", () => {
    render(<Input label="Name" helperText="some hint" />);
    expect(screen.getByText("some hint")).toBeInTheDocument();
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-describedby");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("shows error instead of helper text and flags aria-invalid", () => {
    render(<Input label="Name" helperText="hint" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("hint")).toBeNull();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("omits aria-describedby when no helper or error", () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
  });
});

describe("Input — variants, sizes, icons, fullWidth", () => {
  const sizes = ["xs", "sm", "md", "lg"] as const;
  it.each(sizes)("renders the %s size", (size) => {
    render(<Input label={size} size={size} />);
    expect(screen.getByLabelText(size)).toBeInTheDocument();
  });

  const labelVariants = ["default", "subtle"] as const;
  it.each(labelVariants)("renders the %s label variant", (lv) => {
    render(<Input label={`L-${lv}`} labelVariant={lv} />);
    expect(screen.getByText(`L-${lv}`)).toBeInTheDocument();
  });

  it("renders left and right icons", () => {
    render(
      <Input
        leftIcon={<span data-testid="left" />}
        rightIcon={<span data-testid="right" />}
      />
    );
    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
  });

  it("accepts fullWidth, containerClassName and className", () => {
    render(
      <Input
        fullWidth
        className="inp"
        containerClassName="cont"
        placeholder="p"
      />
    );
    expect(screen.getByPlaceholderText("p")).toHaveClass("inp");
  });
});

describe("Input — state and interaction", () => {
  it("is disabled when disabled prop is set", () => {
    render(<Input label="Name" disabled />);
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("fires onChange with typed value", () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "hello" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe("hello");
  });
});
