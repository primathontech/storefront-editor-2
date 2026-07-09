/**
 * Display-only theme label for the editor header.
 *
 * A 2.0 theme's id/name carries a backend disambiguation suffix ("-2"/"2")
 * that separates it from the legacy 1.0 theme sharing the same backend — noise
 * in the editor, which is always the 2.0 tool. For slug-like values we drop
 * that suffix, turn separators into spaces, and title-case into a clean label.
 * Values that already look intentional (mixed-case, or containing spaces) are
 * shown untouched so a real branded name isn't mangled. Never mutates the
 * stored theme — purely how it renders.
 *
 * Transition-scoped: drop this once themes expose a clean display name.
 */
export function formatThemeName(raw: string | undefined): string {
  if (!raw) return "";
  const looksIntentional =
    /\s/.test(raw) || (/[a-z]/.test(raw) && /[A-Z]/.test(raw));
  if (looksIntentional) return raw;
  return raw
    .replace(/-?2$/, "") // drop the 2.0 disambiguation suffix
    .replace(/[-_]+/g, " ") // separators → spaces
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
