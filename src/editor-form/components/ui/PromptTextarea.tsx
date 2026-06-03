import React from "react";
import styles from "./PromptTextarea.module.css";
import { useAnimatedPlaceholder } from "./useAnimatedPlaceholder";

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  imagePreviewUrl?: string | null;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const PromptTextarea: React.FC<PromptTextareaProps> = ({
  value,
  onChange,
  imagePreviewUrl,
  rows = 3,
  onKeyDown,
}) => {
  const animatedPlaceholder = useAnimatedPlaceholder([
    "Design testimonials section",
    "Design marquee section",
    "Create hero section",
    "Design banner section",
  ]);

  return (
    <textarea
      className={`${styles["prompt-input"]} ${
        imagePreviewUrl ? styles["prompt-input-with-image"] : ""
      }`}
      placeholder={animatedPlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={rows}
    />
  );
};
