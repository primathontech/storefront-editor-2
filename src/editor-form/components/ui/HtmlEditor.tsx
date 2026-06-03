"use client";

import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import React, { useCallback, useEffect, useRef } from "react";
import { useTemplateStore } from "../../../stores/templateStore";

interface HtmlEditorWithValidationProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  sectionId?: string;
}

export const HtmlEditorWithValidation: React.FC<
  HtmlEditorWithValidationProps
> = ({ value, onChange, disabled = false, sectionId }) => {
  const { validateSection, clearHtmlValidationErrors } = useTemplateStore();
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      editorInstance.onDidBlurEditorText(() => {
        if (sectionId) {
          validateSection(sectionId, valueRef.current || "");
        }
      });
    },
    [sectionId, validateSection]
  );

  return (
    <Editor
      language="html"
      value={value}
      onChange={(val) => {
        // Clear errors immediately on edit; revalidate on blur.
        if (sectionId) {
          clearHtmlValidationErrors(sectionId);
        }
        onChange(val || "");
      }}
      onMount={handleMount}
      theme="vs"
      options={{
        minimap: { enabled: false },
        wordWrap: "on",
        lineNumbers: "on",
        readOnly: disabled,
      }}
    />
  );
};
