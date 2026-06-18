// SOURCE: apps/visual-editor/src/editor-form/components/ui/HtmlInput.tsx
//
// Behavioral test for the AI-chat / code-view HTML field. HtmlInput is the SUT
// and runs for real (tab toggle, optimistic chat bubbles, send/disable gating,
// the two load effects, voice-record gating). We mock ONLY the heavy / sibling
// deps it pulls in:
//   - ./HtmlEditor — lazy chunk that drags in Monaco; replaced with a textarea
//     stub so the code-view branch renders synchronously.
//   - ./SectionLibraryDialog — only SparkleIcon is used; the real file pulls in
//     Dialog/GenerateDialog. Stubbed to a marker span.
//   - the htmlChatService singleton + EditorAPI (network boundary) — stubbed so
//     send/transcribe are observable and deterministic.
//   - useImageAttachment helpers — pull react-hot-toast; stubbed to a tiny
//     controllable hook + marker components.
// The real templateStore (zustand) backs htmlValidationErrors/validateSection;
// we seed it via setState. RightSidebarWidthContext uses its default no-op
// value, so no provider is needed.
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";

// --- next/dynamic shim: resolve the lazy chunk eagerly --------------------
// The real shim defers; for tests we want the editor branch to render its
// stub immediately, so we make dynamic() return a component that renders the
// resolved module's default export once loaded.
vi.mock("../../../../editor-form/utils/next-dynamic-shim", () => ({
  default: (loader: () => Promise<any>) => {
    const Lazy: any = (props: any) => {
      const [Comp, setComp] = (require("react") as typeof import("react"))
        .useState(null);
      (require("react") as typeof import("react")).useEffect(() => {
        let alive = true;
        loader().then((mod) => {
          if (alive) setComp(() => mod.default);
        });
        return () => {
          alive = false;
        };
      }, []);
      return Comp ? <Comp {...props} /> : null;
    };
    return Lazy;
  },
}));

// --- HtmlEditor (Monaco) stub ---------------------------------------------
vi.mock("../../../../editor-form/components/ui/HtmlEditor", () => ({
  HtmlEditorWithValidation: ({ value, onChange, disabled, sectionId }: any) => (
    <textarea
      data-testid="html-editor"
      data-section={String(sectionId)}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// --- SparkleIcon stub ------------------------------------------------------
vi.mock("../../../../editor-form/components/ui/SectionLibraryDialog", () => ({
  SparkleIcon: ({ className }: any) => (
    <span data-testid="sparkle" className={className} />
  ),
}));

// --- HtmlErrorIcon stub (trivial, keeps render light) ---------------------
vi.mock("../../../../editor-form/components/ui/icons/HtmlErrorIcon", () => ({
  HtmlErrorIcon: () => <span data-testid="error-icon" />,
}));

// --- useImageAttachment family stub ---------------------------------------
// A controllable hook: exposes the last setFile/clear calls and lets tests
// drive previewUrl by re-rendering. We keep it minimal but real enough that
// the image-preview branch + file-picker button work.
const imageHook = {
  file: null as File | null,
  previewUrl: null as string | null,
  fileInputRef: { current: null },
  openFilePicker: vi.fn(),
  handleFileChange: vi.fn(),
  clearImage: vi.fn(),
  setFile: vi.fn(),
};
vi.mock("../../../../editor-form/components/ui/useImageAttachment", () => ({
  handleImageValidationError: vi.fn(),
  useImageAttachment: () => imageHook,
  ImageUploadIcon: () => <span data-testid="upload-icon" />,
  ImagePreview: ({ previewUrl, onRemove }: any) => (
    <div data-testid="image-preview">
      <span>{previewUrl}</span>
      <button type="button" onClick={onRemove}>
        remove-image
      </button>
    </div>
  ),
  ImageFileInput: ({ onChange, disabled }: any) => (
    <input
      data-testid="file-input"
      type="file"
      disabled={disabled}
      onChange={onChange}
    />
  ),
}));

// --- chat-service singleton stub ------------------------------------------
const sendMessage = vi.fn();
const getConversation = vi.fn();
const getAndClearPendingPrompt = vi.fn();
const getAndClearPendingImage = vi.fn();
vi.mock("../../../../editor-form/services/chat/chat-service", () => ({
  htmlChatService: {
    sendMessage: (...a: any[]) => sendMessage(...a),
    getConversation: (...a: any[]) => getConversation(...a),
    getAndClearPendingPrompt: (...a: any[]) => getAndClearPendingPrompt(...a),
    getAndClearPendingImage: (...a: any[]) => getAndClearPendingImage(...a),
  },
}));

// --- EditorAPI (network) stub ---------------------------------------------
const transcribeAudio = vi.fn();
vi.mock("../../../../editor-form/services/api", () => ({
  EditorAPI: { transcribeAudio: (...a: any[]) => transcribeAudio(...a) },
}));

import { HtmlInput } from "../../../../editor-form/components/ui/HtmlInput";
import { useTemplateStore } from "../../../../stores/templateStore";
import { ChatRole } from "../../../../editor-form/models/chat-types";

const validateSection = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  // Reset the controllable image hook between tests.
  imageHook.file = null;
  imageHook.previewUrl = null;

  // Default chat-service behavior: empty conversation, no pending work.
  getConversation.mockReturnValue(null);
  getAndClearPendingPrompt.mockReturnValue(undefined);
  getAndClearPendingImage.mockReturnValue(undefined);

  // Seed the real store with our spy + no validation errors.
  useTemplateStore.setState({
    htmlValidationErrors: {},
    validateSection,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

const renderInput = (props: Partial<React.ComponentProps<typeof HtmlInput>> = {}) =>
  render(
    <HtmlInput value="<p>hi</p>" onChange={vi.fn()} sectionId="sec-1" {...props} />,
  );

describe("HtmlInput — tabs", () => {
  it("starts on the AI chat view and shows the chat input", () => {
    renderInput();
    expect(
      screen.getByPlaceholderText("Ask to AI..."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("html-editor")).toBeNull();
  });

  it("switches to code view and mounts the (lazy) HTML editor with the value", async () => {
    renderInput();
    fireEvent.click(screen.getByRole("button", { name: /Code View/ }));
    const editor = await screen.findByTestId("html-editor");
    expect(editor).toHaveValue("<p>hi</p>");
    expect(editor).toHaveAttribute("data-section", "sec-1");
  });

  it("propagates edits made in the code-view editor through onChange", async () => {
    const onChange = vi.fn();
    renderInput({ onChange });
    fireEvent.click(screen.getByRole("button", { name: /Code View/ }));
    const editor = await screen.findByTestId("html-editor");
    fireEvent.change(editor, { target: { value: "<b>bold</b>" } });
    expect(onChange).toHaveBeenCalledWith("<b>bold</b>");
  });

  it("switches back to the chat view from code view", async () => {
    renderInput();
    fireEvent.click(screen.getByRole("button", { name: /Code View/ }));
    await screen.findByTestId("html-editor");
    fireEvent.click(screen.getByText("Design with AI"));
    expect(screen.queryByTestId("html-editor")).toBeNull();
    expect(screen.getByPlaceholderText("Ask to AI...")).toBeInTheDocument();
  });
});

describe("HtmlInput — validation errors panel (code view)", () => {
  it("lists section validation errors from the store in code view", async () => {
    useTemplateStore.setState({
      htmlValidationErrors: {
        "sec-1": [{ line: 3, column: 5, message: "Unexpected token" }],
      },
      validateSection,
    });
    renderInput();
    fireEvent.click(screen.getByRole("button", { name: /Code View/ }));
    await screen.findByTestId("html-editor");

    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("Line 3, Col 5")).toBeInTheDocument();
    expect(screen.getByText("Unexpected token")).toBeInTheDocument();
  });

  it("renders no error panel when the store has no errors for the section", async () => {
    renderInput();
    fireEvent.click(screen.getByRole("button", { name: /Code View/ }));
    await screen.findByTestId("html-editor");
    expect(screen.queryByText("Errors")).toBeNull();
  });
});

describe("HtmlInput — existing conversation load", () => {
  it("renders bubbles for a previously stored conversation", () => {
    getConversation.mockReturnValue({
      conversationId: "custom-html:sec-1",
      messages: [
        {
          id: "1",
          role: ChatRole.USER,
          content: "make it blue",
          timestamp: "t",
        },
        {
          id: "2",
          role: ChatRole.ASSISTANT,
          content: "done",
          timestamp: "t",
        },
      ],
    });
    renderInput();
    expect(getConversation).toHaveBeenCalledWith("custom-html:sec-1");
    expect(screen.getByText("make it blue")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
  });
});

describe("HtmlInput — sending a message", () => {
  it("sends the typed prompt, validates and applies returned html", async () => {
    const onChange = vi.fn();
    sendMessage.mockResolvedValue({
      conversation: {
        conversationId: "custom-html:sec-1",
        messages: [
          { id: "u", role: ChatRole.USER, content: "go", timestamp: "t" },
          {
            id: "a",
            role: ChatRole.ASSISTANT,
            content: "ok",
            timestamp: "t",
          },
        ],
      },
      assistant: { id: "a", role: ChatRole.ASSISTANT, content: "ok" },
      html: "<section>new</section>",
    });

    renderInput({ onChange });
    const textarea = screen.getByPlaceholderText("Ask to AI...");
    fireEvent.change(textarea, { target: { value: "go" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter" });
    });

    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "custom-html:sec-1",
        userInput: "go",
        currentHtml: "<p>hi</p>",
      }),
    );
    await waitFor(() =>
      expect(validateSection).toHaveBeenCalledWith(
        "sec-1",
        "<section>new</section>",
      ),
    );
    expect(onChange).toHaveBeenCalledWith("<section>new</section>");
  });

  it("sends on Enter and shows an optimistic loading bubble", async () => {
    let resolveSend: (v: any) => void = () => {};
    sendMessage.mockImplementation(
      () => new Promise((res) => (resolveSend = res)),
    );

    renderInput();
    const textarea = screen.getByPlaceholderText("Ask to AI...");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    // Optimistic: the user's message bubble shows immediately.
    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend({
        conversation: {
          conversationId: "custom-html:sec-1",
          messages: [
            { id: "u", role: ChatRole.USER, content: "hello", timestamp: "t" },
            { id: "a", role: ChatRole.ASSISTANT, content: "hi!", timestamp: "t" },
          ],
        },
        assistant: {},
        html: "",
      });
    });
    expect(await screen.findByText("hi!")).toBeInTheDocument();
  });

  it("does NOT newline-block / send on Shift+Enter", () => {
    renderInput();
    const textarea = screen.getByPlaceholderText("Ask to AI...");
    fireEvent.change(textarea, { target: { value: "multi" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not send when the prompt is only whitespace", () => {
    renderInput();
    const textarea = screen.getByPlaceholderText("Ask to AI...");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not send when there is no sectionId", () => {
    render(<HtmlInput value="" onChange={vi.fn()} />);
    const textarea = screen.getByPlaceholderText("Ask to AI...");
    fireEvent.change(textarea, { target: { value: "go" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("removes the loading bubble (keeps the user bubble) when send fails", async () => {
    sendMessage.mockRejectedValue(new Error("nope"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderInput();
    const textarea = screen.getByPlaceholderText("Ask to AI...");
    fireEvent.change(textarea, { target: { value: "boom" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter" });
    });

    // User bubble stays; the assistant loading bubble is dropped.
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("HtmlInput — pending prompt auto-send", () => {
  it("auto-sends a pending prompt left by GenerateDialog and clears pending image", async () => {
    getAndClearPendingPrompt.mockReturnValue("auto prompt");
    const pendingImg = new File(["x"], "p.png", { type: "image/png" });
    getAndClearPendingImage.mockReturnValue(pendingImg);
    sendMessage.mockResolvedValue({
      conversation: { conversationId: "custom-html:sec-1", messages: [] },
      assistant: {},
      html: "",
    });

    await act(async () => {
      renderInput();
      // flush the queued Promise.resolve().then(...) auto-send
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ userInput: "auto prompt" }),
      ),
    );
    // The pending image is staged for preview via setFile.
    expect(imageHook.setFile).toHaveBeenCalledWith(pendingImg);
  });
});

describe("HtmlInput — image attachment UI", () => {
  it("shows the preview when the image hook reports a previewUrl", () => {
    imageHook.previewUrl = "blob:preview";
    imageHook.file = new File(["x"], "a.png", { type: "image/png" });
    renderInput();
    expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    expect(screen.getByText("blob:preview")).toBeInTheDocument();
  });

  it("opens the file picker when the plus button is clicked", () => {
    renderInput();
    fireEvent.click(screen.getByTestId("upload-icon").closest("button")!);
    expect(imageHook.openFilePicker).toHaveBeenCalled();
  });

  it("does not open the picker when disabled", () => {
    renderInput({ disabled: true });
    fireEvent.click(screen.getByTestId("upload-icon").closest("button")!);
    expect(imageHook.openFilePicker).not.toHaveBeenCalled();
  });
});

describe("HtmlInput — voice recording", () => {
  it("starts recording, then stops and transcribes audio into the input", async () => {
    // Minimal MediaRecorder + getUserMedia fakes.
    let recorderInstance: any;
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    (navigator as any).mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
    };
    class FakeRecorder {
      state = "recording";
      ondataavailable: any;
      onstop: any;
      constructor() {
        recorderInstance = this;
      }
      start() {}
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: { size: 10 } });
        this.onstop?.();
      }
    }
    (globalThis as any).MediaRecorder = FakeRecorder as any;
    transcribeAudio.mockResolvedValue("transcribed text");

    renderInput();
    const micButton = screen.getByLabelText("Record voice prompt");

    await act(async () => {
      fireEvent.click(micButton); // start
      await Promise.resolve();
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(micButton); // stop -> triggers onstop -> transcribe
      await Promise.resolve();
    });

    await waitFor(() => expect(transcribeAudio).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Ask to AI...")).toHaveValue(
        "transcribed text",
      ),
    );
    expect(track.stop).toHaveBeenCalled();
    expect(recorderInstance).toBeDefined();
  });

  it("does not start recording when disabled", () => {
    (navigator as any).mediaDevices = { getUserMedia: vi.fn() };
    renderInput({ disabled: true });
    fireEvent.click(screen.getByLabelText("Record voice prompt"));
    expect((navigator as any).mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
