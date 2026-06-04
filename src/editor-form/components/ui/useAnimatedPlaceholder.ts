import { useEffect, useState } from "react";

export function useAnimatedPlaceholder(texts: string[]) {
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset charIndex when text changes
  useEffect(() => {
    setCharIndex(0);
    setIsDeleting(false);
  }, [textIndex]);

  useEffect(() => {
    const currentText = texts[textIndex];
    if (!currentText) return;

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setCharIndex((prev) => {
            const next = prev + 1;
            if (next === currentText.length) {
              setTimeout(() => setIsDeleting(true), 1000);
            }
            return next;
          });
        } else {
          setCharIndex((prev) => {
            const next = prev - 1;
            if (next === 0) {
              setIsDeleting(false);
              setTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
            }
            return next;
          });
        }
      },
      isDeleting ? 40 : 70
    );

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex, texts]);

  const currentText = texts[textIndex];
  return currentText.substring(0, charIndex);
}
