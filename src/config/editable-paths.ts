// Display-side mirror of the BE path allowlist (plan §9). The tree
// arrives pre-filtered from the BE; this matcher is belt + suspenders so
// the FE never *renders* a path the BE would 403 on write.

export const EDITABLE_GLOBS = [
  "src/widgets/common/*/V*/**/*.tsx",
  "src/widgets/common/*/V*/**/*.ts",
  "src/widgets/common/*/V*/**/*.css",
  "src/themes/dawn/templates/**/*.ts",
  "src/themes/dawn/theme.json",
  "src/themes/dawn/locales/**/*.json",
] as const;

export const FORBIDDEN_GLOBS = [
  "src/widgets/common/*/index.tsx",
  "src/widgets/common/*/variants.ts",
  "src/widgets/common/*/types.ts",
  "src/themes/dawn/templates/.generated/**",
  "src/widgets/.generated/**",
] as const;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Minimal glob→RegExp for the patterns above:
 *   `**` segment — zero or more whole path segments.
 *   `*` within a segment — any run of non-slash characters.
 */
export function globToRegExp(glob: string): RegExp {
  const segments = glob.split("/");
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    if (segment === "**") {
      // Trailing `**` swallows everything; mid-pattern `**` matches zero
      // or more complete segments (own trailing slash included so
      // "a/**/b" still matches "a/b").
      parts.push(isLast ? ".*" : "(?:[^/]+/)*");
      continue;
    }
    const segmentPattern = segment.split("*").map(escapeRegExp).join("[^/]*");
    parts.push(isLast ? segmentPattern : `${segmentPattern}/`);
  }
  return new RegExp(`^${parts.join("")}$`);
}

const EDITABLE_MATCHERS = EDITABLE_GLOBS.map(globToRegExp);
const FORBIDDEN_MATCHERS = FORBIDDEN_GLOBS.map(globToRegExp);

const normalize = (path: string) => path.replace(/^\/+/, "");

export function isEditablePath(path: string): boolean {
  const p = normalize(path);
  if (FORBIDDEN_MATCHERS.some((re) => re.test(p))) return false;
  return EDITABLE_MATCHERS.some((re) => re.test(p));
}

export type EditorLanguage = "typescript" | "json" | "css" | "plaintext";

export function inferLanguage(path: string): EditorLanguage {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return "typescript";
    case "json":
      return "json";
    case "css":
      return "css";
    default:
      return "plaintext";
  }
}
