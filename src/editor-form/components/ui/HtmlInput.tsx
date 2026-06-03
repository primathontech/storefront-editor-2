"use client";

import dynamic from "../../utils/next-dynamic-shim";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRightSidebarWidth } from "../../context/RightSidebarWidthContext";
import { ChatRole } from "../../models/chat-types";
import type { ChatMessage, Conversation } from "../../models/chat-types";
import { EditorAPI } from "../../services/api";
import { htmlChatService } from "../../services/chat/chat-service";
import { useTemplateStore } from "../../../stores/templateStore";
import styles from "./HtmlInput.module.css";
import { SparkleIcon } from "./SectionLibraryDialog";
import { HtmlErrorIcon } from "./icons/HtmlErrorIcon";
import {
  ImageFileInput,
  ImagePreview,
  ImageUploadIcon,
  handleImageValidationError,
  useImageAttachment,
} from "./useImageAttachment";

// Lazy load the entire editor component with all heavy dependencies in one chunk
const HtmlEditorWithValidation = dynamic(
  () =>
    import("./HtmlEditor").then((mod) => ({
      default: mod.HtmlEditorWithValidation,
    })),
  {
    ssr: false,
    loading: () => (
      <div className={styles["loading-editor"]}>Loading editor...</div>
    ),
  }
);

export interface HtmlInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  sectionId?: string;
}

export const HtmlInput: React.FC<HtmlInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Ask to AI...",
  sectionId,
}) => {
  const [isCodeView, setIsCodeView] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const {
    file: chatImageFile,
    previewUrl: chatImagePreviewUrl,
    fileInputRef,
    openFilePicker,
    handleFileChange,
    clearImage: clearChatImage,
    setFile: setChatImageFile,
  } = useImageAttachment({
    onValidationError: handleImageValidationError,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const processedPendingPromptRef = useRef<string | null>(null);
  const { setWidth } = useRightSidebarWidth();
  const { htmlValidationErrors, validateSection } = useTemplateStore();

  // Get errors for this section from store (single source of truth)
  const validationErrors = sectionId
    ? htmlValidationErrors[sectionId] || []
    : [];

  // Adjust sidebar width based on view mode while this widget is active:
  // - chat view: 340px
  // - code view: 600px
  // On unmount, always reset to 340px so other widgets see the default width.
  useEffect(() => {
    setWidth(isCodeView ? 600 : 340);

    return () => {
      setWidth(340);
    };
  }, [isCodeView, setWidth]);

  // Core send message function that accepts prompt text (and optional image override)
  const handleSendMessageWithPrompt = useCallback(
    async (promptText: string, imageOverride?: File | null) => {
      if (!sectionId || !promptText.trim() || isSending || disabled) {
        return;
      }

      const conversationId = `custom-html:${sectionId}`;
      const trimmedPrompt = promptText.trim();
      const imageFileToSend = imageOverride ?? chatImageFile;

      // Create optimistic messages
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: ChatRole.USER,
        content: trimmedPrompt,
        timestamp: new Date().toISOString(),
        hasImage: imageFileToSend ? true : undefined,
      };

      const loadingMessageId = crypto.randomUUID();
      const loadingMessage: ChatMessage = {
        id: loadingMessageId,
        role: ChatRole.ASSISTANT,
        content: "", // Empty content triggers shimmer
        timestamp: new Date().toISOString(),
      };

      // Optimistic update using functional state update to avoid stale closure
      setConversation((prev) => {
        const currentMessages = prev?.messages || [];
        return {
          conversationId,
          messages: [...currentMessages, userMessage, loadingMessage],
        };
      });

      setChatInput("");
      clearChatImage();
      setIsSending(true);

      try {
        const { conversation: updatedConversation, html } =
          await htmlChatService.sendMessage({
            conversationId,
            userInput: trimmedPrompt,
            currentHtml: value,
            imageFile: imageFileToSend,
          });

        // Service returns the complete conversation with user + assistant messages
        // Simply replace our optimistic state with the service's authoritative state
        setConversation(updatedConversation);

        if (html) {
          if (sectionId) {
            await validateSection(sectionId, html);
          }
          onChange(html);
        }
      } catch (error) {
        console.error("AI chat error:", error);
        // On error, remove only the loading message, keep user message
        setConversation((prev) => {
          if (!prev) {
            return null;
          }
          return {
            ...prev,
            messages: prev.messages.filter(
              (msg) => msg.id !== loadingMessageId
            ),
          };
        });
      } finally {
        setIsSending(false);
      }
    },
    [
      sectionId,
      isSending,
      disabled,
      value,
      chatImageFile,
      onChange,
      clearChatImage,
    ]
  );

  const handleSendMessage = useCallback(async () => {
    if (!sectionId || !chatInput.trim() || isSending || disabled) {
      return;
    }
    await handleSendMessageWithPrompt(chatInput.trim());
  }, [sectionId, chatInput, isSending, disabled, handleSendMessageWithPrompt]);

  // Load existing conversation when sectionId changes
  useEffect(() => {
    if (!sectionId) {
      return;
    }
    const conversationId = `custom-html:${sectionId}`;
    const existing = htmlChatService.getConversation(conversationId);
    setConversation(existing);
    // Reset the processed flag when sectionId changes
    processedPendingPromptRef.current = null;
  }, [sectionId]);

  // Handle pending prompt from GenerateDialog - runs after conversation is loaded
  useEffect(() => {
    if (!sectionId) {
      return;
    }
    if (isCodeView || disabled || isSending) {
      return;
    }

    // Check for pending prompt from GenerateDialog
    const pendingPrompt = htmlChatService.getAndClearPendingPrompt(sectionId);
    if (!pendingPrompt?.trim()) {
      return;
    }

    // Prevent processing the same prompt multiple times
    // (in case effect runs again due to dependency changes)
    if (processedPendingPromptRef.current === pendingPrompt) {
      return;
    }
    processedPendingPromptRef.current = pendingPrompt;

    const pendingImage = htmlChatService.getAndClearPendingImage(sectionId);
    // Set image for preview (if any) - this is separate from sending
    if (pendingImage) {
      setChatImageFile(pendingImage);
    }

    // IMPORTANT: Do NOT set chatInput - we want to auto-send directly to chat bubbles.
    // The handleSendMessageWithPrompt will perform optimistic UI and network call.
    Promise.resolve().then(() => {
      handleSendMessageWithPrompt(pendingPrompt.trim(), pendingImage);
    });
  }, [sectionId, isCodeView, disabled, isSending, handleSendMessageWithPrompt]);

  const sendAudioToWhisper = useCallback(async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      const transcript = await EditorAPI.transcribeAudio(audioBlob);
      if (transcript) {
        // Replace the current input with the latest transcript so each
        // recording starts fresh instead of appending indefinitely.
        setChatInput(transcript);
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (disabled || isSending || isTranscribing) {
      return;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        if (audioBlob.size > 0) {
          void sendAudioToWhisper(audioBlob);
        }
      };

      recorder.start();
    } catch (error) {
      console.error("Error starting audio recording:", error);
      setIsRecording(false);
    }
  }, [disabled, isSending, isTranscribing, sendAudioToWhisper]);

  return (
    <div className={styles.container}>
      {/* Tabs header */}
      <div className={styles["tabs-header"]}>
        {/* AI tab first */}
        <button
          type="button"
          onClick={() => setIsCodeView(false)}
          className={`${styles["tab-button"]} ${
            isCodeView
              ? styles["tab-button-inactive"]
              : styles["tab-button-active"]
          }`}
        >
          <div className={styles["sparkle-icon"]}>
            <SparkleIcon className={styles["sparkle-main"]} />
            <SparkleIcon
              className={`${styles["sparkle-small"]} ${styles["sparkle-top-left"]}`}
            />
            <SparkleIcon
              className={`${styles["sparkle-small"]} ${styles["sparkle-bottom-right"]}`}
            />
          </div>
          Design with AI
        </button>
        {/* Code tab second */}
        <button
          type="button"
          onClick={() => setIsCodeView(true)}
          className={`${styles["tab-button"]} ${
            isCodeView
              ? styles["tab-button-active"]
              : styles["tab-button-inactive"]
          }`}
        >
          &lt;/&gt; Code View
        </button>
      </div>

      {/* Body: either Chat view or Code view */}
      <div className={styles.body}>
        {isCodeView ? (
          <div className={styles["code-view-wrapper"]}>
            <div className={styles["code-view-container"]}>
              <HtmlEditorWithValidation
                value={value}
                onChange={onChange}
                disabled={disabled}
                sectionId={sectionId}
              />
            </div>

            {validationErrors.length > 0 && (
              <div className={styles["error-container"]}>
                <div className={styles["error-header"]}>
                  <span className={styles["error-icon-wrapper"]}>
                    <HtmlErrorIcon />
                  </span>
                  <div className={styles["error-text-group"]}>
                    <div className={styles["error-text-main"]}>Errors</div>
                  </div>
                </div>
                <ul className={styles["error-list"]}>
                  {validationErrors.map((e, idx) => (
                    <li key={idx} className={styles["error-list-item"]}>
                      <span className={styles["error-location"]}>
                        Line {e.line}, Col {e.column}
                      </span>
                      <span className={styles["error-message"]}>
                        {e.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={styles["chat-container"]}>
              {/* Chat history - full height scroll */}
              <div className={styles["chat-history"]}>
                {conversation &&
                  conversation.messages.map((msg: ChatMessage) => {
                    const isLoading =
                      msg.role === ChatRole.ASSISTANT &&
                      (!msg.content || msg.content.trim() === "");
                    return (
                      <div
                        key={msg.id}
                        className={`${styles["message-wrapper"]} ${
                          msg.role === ChatRole.USER
                            ? styles["message-wrapper-user"]
                            : styles["message-wrapper-assistant"]
                        }`}
                      >
                        <div
                          className={`${styles["message-bubble"]} ${
                            msg.role === ChatRole.USER
                              ? styles["message-bubble-user"]
                              : styles["message-bubble-assistant"]
                          } ${isLoading ? styles["message-bubble-loading"] : ""}`}
                        >
                          {isLoading ? (
                            <div className={styles["loading-container"]}>
                              <div className={styles["loading-dot"]} />
                              <div
                                className={`${styles["loading-dot"]} ${styles["loading-dot-delay-1"]}`}
                              />
                              <div
                                className={`${styles["loading-dot"]} ${styles["loading-dot-delay-2"]}`}
                              />
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Chat input - anchored at bottom */}
              <div className={styles["input-container"]}>
                <div className={styles["textarea-wrapper"]}>
                  {chatImagePreviewUrl && (
                    <ImagePreview
                      previewUrl={chatImagePreviewUrl}
                      fileName={chatImageFile?.name}
                      onRemove={() => setChatImageFile(null)}
                      containerClassName={styles["image-preview-container"]}
                      wrapperClassName={styles["image-preview-wrapper"]}
                      imageClassName={styles["image-preview"]}
                      removeButtonClassName={styles["image-remove-button"]}
                    />
                  )}
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter to send, Shift+Enter for newline (common chat UX)
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={placeholder}
                    disabled={isSending || disabled}
                    className={`${styles["chat-textarea"]} ${
                      chatImagePreviewUrl
                        ? styles["chat-textarea-with-image"]
                        : ""
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isSending || disabled) {
                      return;
                    }
                    openFilePicker();
                  }}
                  disabled={isSending || disabled}
                  className={`${styles["input-button"]} ${styles["plus-button"]}`}
                >
                  <ImageUploadIcon />
                </button>
                <ImageFileInput
                  inputRef={fileInputRef}
                  onChange={handleFileChange}
                  disabled={isSending || disabled}
                  className={styles["file-input"]}
                />
                <button
                  type="button"
                  onClick={handleToggleRecording}
                  disabled={isSending || disabled || isTranscribing}
                  className={`${styles["input-button"]} ${styles["mic-button"]} ${
                    isRecording ? styles["mic-button-recording"] : ""
                  }`}
                  aria-label="Record voice prompt"
                >
                  {isRecording ? (
                    <span className={styles["mic-levels"]}>
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
                      <path d="M19 10a7 7 0 0 1-14 0" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || disabled}
                  className={`${styles["input-button"]} ${styles["send-button"]}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 12 17"
                    fill="none"
                  >
                    <path
                      d="M4.99262 0.2197C5.28551 -0.0731945 5.76039 -0.0731945 6.05328 0.2197L10.8262 4.99267C11.1191 5.28556 11.1191 5.76044 10.8262 6.05333C10.5334 6.34622 10.0585 6.34622 9.76559 6.05333L5.52295 1.81069L1.28031 6.05333C0.987415 6.34622 0.512541 6.34622 0.219648 6.05333C-0.0732457 5.76044 -0.0732457 5.28556 0.219648 4.99267L4.99262 0.2197ZM5.52295 16.2183L4.77295 16.2183L4.77295 0.75003L5.52295 0.75003L6.27295 0.75003L6.27295 16.2183L5.52295 16.2183Z"
                      fill="white"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
