// SOURCE: apps/visual-editor/src/editor-form/components/ui/DynamicForm.tsx
//
// Behavioral test for the schema-driven form renderer. DynamicForm is the SUT
// and runs for real, including the real `useTranslationUtils` hook + the real
// design-system Input/Dropdown/Switch leaves it uses directly. We mock ONLY the
// heavy / out-of-file sibling field components (ArrayInput, FAQInput,
// MediaInput, ObjectArrayInput, ResponsiveSpacingInput, RichTextInput pulls
// react-quill, HtmlInput pulls Monaco) with lightweight stubs that surface
// their `value`/`label` and a button to fire `onChange` — enough to assert the
// renderField switch picks the right field per schema type and that onChange
// propagates through DynamicForm's onUpdate. The real templateStore (zustand)
// backs `updateTranslation`; we drive it through `setState`/`getState`.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// --- Sibling field-component stubs (deps, not the SUT) ---------------------
// Each stub renders its label + a JSON snapshot of `value` and a button that
// calls onChange with a deterministic payload so we can assert propagation.
vi.mock("../../../../editor-form/components/ui/ArrayInput", () => ({
  ArrayInput: ({ label, value, onChange, disabled }: any) => (
    <div data-testid="array-input">
      <span data-testid="array-label">{label}</span>
      <span data-testid="array-value">{JSON.stringify(value)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(["x", "y"])}
      >
        array-change
      </button>
    </div>
  ),
}));
vi.mock("../../../../editor-form/components/ui/FAQInput", () => ({
  FAQInput: ({ label, value, onChange, disabled }: any) => (
    <div data-testid="faq-input">
      <span data-testid="faq-label">{label}</span>
      <span data-testid="faq-value">{JSON.stringify(value)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([{ question: "Q1", answer: "A1" }])}
      >
        faq-change
      </button>
    </div>
  ),
}));
vi.mock("../../../../editor-form/components/ui/MediaInput", () => ({
  MediaInput: ({ label, kind, value, onChange, disabled }: any) => (
    <div data-testid="media-input">
      <span data-testid="media-kind">{kind}</span>
      <span data-testid="media-label">{label}</span>
      <span data-testid="media-value">{JSON.stringify(value)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ src: "new.png", alt: "new alt" })}
      >
        media-change
      </button>
    </div>
  ),
}));
vi.mock("../../../../editor-form/components/ui/ObjectArrayInput", () => ({
  ObjectArrayInput: ({ label, value, onChange, fields, disabled }: any) => (
    <div data-testid="object-array-input">
      <span data-testid="oa-label">{label}</span>
      <span data-testid="oa-fields">{JSON.stringify(fields)}</span>
      <span data-testid="oa-value">{JSON.stringify(value)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([{ title: "T2", image: "i2.png" }])}
      >
        oa-change
      </button>
    </div>
  ),
}));
vi.mock(
  "../../../../editor-form/components/ui/ResponsiveSpacingInput",
  () => ({
    ResponsiveSpacingInput: ({ label, value, onChange, disabled }: any) => (
      <div data-testid="spacing-input">
        <span data-testid="spacing-label">{label}</span>
        <span data-testid="spacing-value">{JSON.stringify(value)}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ top: "10px" })}
        >
          spacing-change
        </button>
      </div>
    ),
  }),
);
vi.mock("../../../../editor-form/components/ui/RichTextInput", () => ({
  RichTextInput: ({ label, value, onChange, disabled }: any) => (
    <div data-testid="richtext-input">
      <span data-testid="richtext-label">{label}</span>
      <span data-testid="richtext-value">{String(value)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("<p>new</p>")}
      >
        richtext-change
      </button>
    </div>
  ),
}));
vi.mock("../../../../editor-form/components/ui/HtmlInput", () => ({
  HtmlInput: ({ value, onChange, disabled, sectionId }: any) => (
    <div data-testid="html-input">
      <span data-testid="html-value">{String(value)}</span>
      <span data-testid="html-section">{String(sectionId)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("<div>html</div>")}
      >
        html-change
      </button>
    </div>
  ),
}));

import { DynamicForm } from "../../../../editor-form/components/ui/DynamicForm";
import type { FormSchema } from "../../../../editor-form/components/ui/DynamicForm";
import { useTemplateStore } from "../../../../stores/templateStore";

beforeEach(() => {
  // Dropdown's open effect scrolls the selected option into view.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("DynamicForm — field type rendering", () => {
  it("renders a text input and propagates typed value through onUpdate", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { title: { type: "text", label: "Title" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ title: "hello" }}
        onUpdate={onUpdate}
      />,
    );

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input).toHaveValue("hello");
    fireEvent.change(input, { target: { value: "world" } });
    expect(onUpdate).toHaveBeenCalledWith("title", "world");
  });

  it("renders a number input and coerces the value to a Number", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = {
      count: { type: "number", label: "Count", min: 0, max: 10, step: 1 },
    };
    render(
      <DynamicForm schema={schema} values={{ count: 3 }} onUpdate={onUpdate} />,
    );

    const input = screen.getByLabelText("Count") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "number");
    fireEvent.change(input, { target: { value: "7" } });
    expect(onUpdate).toHaveBeenCalledWith("count", 7);
  });

  it("renders a select and propagates the chosen option value", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = {
      align: {
        type: "select",
        label: "Align",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{ align: "left" }}
        onUpdate={onUpdate}
      />,
    );

    // Open the real design-system Dropdown and pick an option.
    fireEvent.click(
      document.querySelector('[aria-haspopup="listbox"]') as HTMLButtonElement,
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: "Right" }));
    expect(onUpdate).toHaveBeenCalledWith("align", "right");
  });

  it("renders a boolean switch and toggles its value", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = {
      visible: { type: "boolean", label: "Visible" },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{ visible: false }}
        onUpdate={onUpdate}
      />,
    );

    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onUpdate).toHaveBeenCalledWith("visible", true);
  });

  it("renders the spacing field and propagates its object payload", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { pad: { type: "spacing", label: "Padding" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ pad: { top: "0" } }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId("spacing-label")).toHaveTextContent("Padding");
    fireEvent.click(screen.getByText("spacing-change"));
    expect(onUpdate).toHaveBeenCalledWith("pad", { top: "10px" });
  });

  it("renders an image MediaInput with kind=image and a default value", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { hero: { type: "image", label: "Hero" } };
    render(
      <DynamicForm schema={schema} values={{}} onUpdate={onUpdate} />,
    );

    expect(screen.getByTestId("media-kind")).toHaveTextContent("image");
    // Undefined value falls back to { src:"", alt:"" }.
    expect(screen.getByTestId("media-value")).toHaveTextContent(
      JSON.stringify({ src: "", alt: "" }),
    );
    fireEvent.click(screen.getByText("media-change"));
    expect(onUpdate).toHaveBeenCalledWith("hero", {
      src: "new.png",
      alt: "new alt",
    });
  });

  it("renders a video MediaInput with kind=video", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { clip: { type: "video", label: "Clip" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ clip: { src: "v.mp4", alt: "" } }}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByTestId("media-kind")).toHaveTextContent("video");
  });

  it("renders the richtext field and propagates HTML string", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { body: { type: "richtext", label: "Body" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ body: "<p>old</p>" }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId("richtext-value")).toHaveTextContent("<p>old</p>");
    fireEvent.click(screen.getByText("richtext-change"));
    expect(onUpdate).toHaveBeenCalledWith("body", "<p>new</p>");
  });

  it("renders the html field, passes sectionId, and propagates HTML", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { custom: { type: "html" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ custom: "<div/>" }}
        onUpdate={onUpdate}
        sectionId="sec-1"
      />,
    );

    expect(screen.getByTestId("html-section")).toHaveTextContent("sec-1");
    fireEvent.click(screen.getByText("html-change"));
    expect(onUpdate).toHaveBeenCalledWith("custom", "<div>html</div>");
  });

  it("returns null for an unknown field type", () => {
    const { container } = render(
      <DynamicForm
        // @ts-expect-error — exercising the default branch of renderField
        schema={{ weird: { type: "totally-unknown" } }}
        values={{}}
        onUpdate={vi.fn()}
      />,
    );
    // The root div renders but contains no field markup.
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("DynamicForm — faq field", () => {
  it("renders legacy array FAQ items and remaps changes per index", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = { faqs: { type: "faq", label: "FAQs" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ faqs: [{ question: "Q", answer: "A" }] }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId("faq-value")).toHaveTextContent(
      JSON.stringify([{ question: "Q", answer: "A" }]),
    );
    fireEvent.click(screen.getByText("faq-change"));
    expect(onUpdate).toHaveBeenCalledWith("faqs", [
      { question: "Q1", answer: "A1" },
    ]);
  });

  it("treats a t:-prefixed string value as a whole-array translation key", () => {
    const updateTranslation = vi.fn();
    useTemplateStore.setState({ updateTranslation });

    const onUpdate = vi.fn();
    const schema: FormSchema = { faqs: { type: "faq" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ faqs: "t:sections.x.faqs" }}
        onUpdate={onUpdate}
      />,
    );
    // The stored value is a t: key, so handleTranslationChange writes the new
    // items to the store and keeps the t: reference as the onUpdate value.
    fireEvent.click(screen.getByText("faq-change"));
    expect(updateTranslation).toHaveBeenCalledWith(
      ["sections", "x", "faqs"],
      [{ question: "Q1", answer: "A1" }],
    );
    expect(onUpdate).toHaveBeenCalledWith("faqs", "t:sections.x.faqs");
  });
});

describe("DynamicForm — array & objectArray fields", () => {
  it("renders a legacy array and propagates new items", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = {
      tags: { type: "array", label: "Tags", fields: ["text"] },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{ tags: ["a", "b"] }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId("array-value")).toHaveTextContent('["a","b"]');
    fireEvent.click(screen.getByText("array-change"));
    expect(onUpdate).toHaveBeenCalledWith("tags", ["x", "y"]);
  });

  it("renders a t:-prefixed array as a translation-key managed array", () => {
    const updateTranslation = vi.fn();
    useTemplateStore.setState({ updateTranslation });

    const onUpdate = vi.fn();
    const schema: FormSchema = { tags: { type: "array" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ tags: "t:sections.x.tags" }}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText("array-change"));
    expect(updateTranslation).toHaveBeenCalledWith(
      ["sections", "x", "tags"],
      ["x", "y"],
    );
    expect(onUpdate).toHaveBeenCalledWith("tags", "t:sections.x.tags");
  });

  it("renders a legacy objectArray, strips image:/video: field prefixes for data keys", () => {
    const onUpdate = vi.fn();
    const schema: FormSchema = {
      cards: {
        type: "objectArray",
        label: "Cards",
        fields: ["title", "image:image"],
      },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{ cards: [{ title: "T1", image: "i1.png" }] }}
        onUpdate={onUpdate}
      />,
    );

    // Display item only carries the resolved data keys (title + image).
    expect(screen.getByTestId("oa-value")).toHaveTextContent(
      JSON.stringify([{ title: "T1", image: "i1.png" }]),
    );
    fireEvent.click(screen.getByText("oa-change"));
    expect(onUpdate).toHaveBeenCalledWith("cards", [
      { title: "T2", image: "i2.png" },
    ]);
  });

  it("renders a t:-prefixed objectArray as a translation-key managed array", () => {
    const updateTranslation = vi.fn();
    useTemplateStore.setState({ updateTranslation });

    const onUpdate = vi.fn();
    const schema: FormSchema = {
      cards: { type: "objectArray", fields: ["title"] },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{ cards: "t:sections.x.cards" }}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText("oa-change"));
    expect(updateTranslation).toHaveBeenCalledWith(
      ["sections", "x", "cards"],
      [{ title: "T2", image: "i2.png" }],
    );
    expect(onUpdate).toHaveBeenCalledWith("cards", "t:sections.x.cards");
  });
});

describe("DynamicForm — disabled, errors & helper text", () => {
  it("disables every field when the form is disabled", () => {
    const schema: FormSchema = {
      title: { type: "text", label: "Title" },
      count: { type: "number", label: "Count" },
      visible: { type: "boolean", label: "Visible" },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{}}
        onUpdate={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Count")).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("honors a per-field disabled flag from the schema", () => {
    const schema: FormSchema = {
      title: { type: "text", label: "Title", disabled: true },
    };
    render(<DynamicForm schema={schema} values={{}} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText("Title")).toBeDisabled();
  });

  it("renders helper text via FieldWrapper for a select field", () => {
    const schema: FormSchema = {
      align: { type: "select", label: "Align", options: [] },
    };
    render(
      <DynamicForm
        schema={schema}
        values={{}}
        onUpdate={vi.fn()}
        helperTexts={{ align: "choose alignment" }}
      />,
    );
    expect(screen.getByText("choose alignment")).toBeInTheDocument();
  });

  it("prefers per-field error/helperText from the schema when props omit them", () => {
    const schema: FormSchema = {
      align: {
        type: "select",
        label: "Align",
        options: [],
        helperText: "schema hint",
        error: true,
      },
    };
    render(<DynamicForm schema={schema} values={{}} onUpdate={vi.fn()} />);
    expect(screen.getByText("schema hint")).toBeInTheDocument();
  });
});

describe("DynamicForm — multi-field & forwarded props", () => {
  it("renders all schema entries in order and forwards ref + style", () => {
    const ref = { current: null as HTMLDivElement | null };
    const schema: FormSchema = {
      a: { type: "text", label: "A" },
      b: { type: "boolean", label: "B" },
      c: { type: "html" },
    };
    render(
      <DynamicForm
        ref={ref}
        schema={schema}
        values={{}}
        onUpdate={vi.fn()}
        style={{ color: "red" }}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveStyle({ color: "rgb(255, 0, 0)" });
    expect(screen.getByLabelText("A")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByTestId("html-input")).toBeInTheDocument();
  });
});

describe("DynamicForm — translation handling", () => {
  it("keeps the t: reference and routes the new value to updateTranslation", () => {
    const updateTranslation = vi.fn();
    // Override the store's updateTranslation so we can observe the write
    // without standing up a TranslationService.
    useTemplateStore.setState({ updateTranslation });

    const onUpdate = vi.fn();
    const schema: FormSchema = { title: { type: "text", label: "Title" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ title: "t:sections.x.title" }}
        onUpdate={onUpdate}
      />,
    );

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Localized" } });

    // handleTranslationChange writes to the store and returns the t: ref.
    expect(updateTranslation).toHaveBeenCalledWith(
      ["sections", "x", "title"],
      "Localized",
    );
    expect(onUpdate).toHaveBeenCalledWith("title", "t:sections.x.title");
  });

  it("writes media leaves individually for a t: image value", () => {
    const updateTranslation = vi.fn();
    useTemplateStore.setState({ updateTranslation });

    const onUpdate = vi.fn();
    const schema: FormSchema = { hero: { type: "image", label: "Hero" } };
    render(
      <DynamicForm
        schema={schema}
        values={{ hero: "t:sections.x.hero" }}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("media-change"));

    // Each leaf of { src, alt } is written under the base path.
    expect(updateTranslation).toHaveBeenCalledWith(
      ["sections", "x", "hero", "src"],
      "new.png",
    );
    expect(updateTranslation).toHaveBeenCalledWith(
      ["sections", "x", "hero", "alt"],
      "new alt",
    );
    // The stored value remains the t: reference.
    expect(onUpdate).toHaveBeenCalledWith("hero", "t:sections.x.hero");
  });
});
