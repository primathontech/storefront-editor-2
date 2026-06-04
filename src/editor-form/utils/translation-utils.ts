import { TranslationService, type Locale } from "@shopkit/i18n";

// Translation helpers shared by the legacy lane (dualTranslationStore +
// useEditorState) and the new lane (templateStore). Pure — no store refs.

// ---- Key helpers --------------------------------------------------------

export const isTranslationKey = (value: unknown): boolean =>
  typeof value === "string" && value.startsWith("t:");

export const getTranslationPath = (value: string): string[] =>
  value.substring(2).split(".");

export const createTranslationKey = (path: string[]): string =>
  `t:${path.join(".")}`;

// ---- Generic object helpers --------------------------------------------

export function setValueByPath(
  obj: Record<string, any>,
  path: string[],
  value: unknown,
): Record<string, any> {
  if (path.length === 1) {
    return { ...obj, [path[0]]: value };
  }
  const [head, ...rest] = path;
  return {
    ...obj,
    [head]: setValueByPath(obj[head] || {}, rest, value),
  };
}

export function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

export function flattenPaths(
  obj: Record<string, any>,
  path: string[] = [],
): string[][] {
  const result: string[][] = [];
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = [...path, key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result.push(...flattenPaths(value, currentPath));
    } else {
      result.push(currentPath);
    }
  });
  return result;
}

// ---- Section library: key remap + default-translation builder ----------

// Remaps `t:sections.<oldPattern>.*` → `t:sections.<newSectionKey>.*`
// for template-scoped sections; common keys pass through unchanged.
export function processSectionWidgets(
  widgets: any[],
  newSectionKey: string,
  templateId: string | null,
  isCommon: boolean,
): {
  remappedWidgets: any[];
  translationKeys: string[];
  oldSectionPattern: string | null;
} {
  const translationKeys: string[] = [];
  let oldSectionPattern: string | null = null;

  const remappedWidgets = widgets.map((widget) => {
    if (!widget.settings) return widget;
    const remappedSettings = remapAndCollectKeys(
      widget.settings,
      newSectionKey,
      templateId,
      isCommon,
      translationKeys,
      (pattern) => {
        if (!oldSectionPattern) oldSectionPattern = pattern;
      },
    );
    return { ...widget, settings: remappedSettings };
  });

  return { remappedWidgets, translationKeys, oldSectionPattern };
}

function remapAndCollectKeys(
  obj: unknown,
  newSectionKey: string,
  templateId: string | null,
  isCommon: boolean,
  translationKeys: string[],
  onPatternFound: (pattern: string) => void,
): unknown {
  if (typeof obj === "string") {
    if (isTranslationKey(obj)) {
      const path = getTranslationPath(obj);
      translationKeys.push(obj);
      if (path[0] === "common") return obj;
      if (isCommon) return obj;
      if (path.length >= 2 && path[0] === "sections" && templateId) {
        const pattern = path[1];
        onPatternFound(pattern);
        return createTranslationKey([
          "sections",
          newSectionKey,
          ...path.slice(2),
        ]);
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      remapAndCollectKeys(
        item,
        newSectionKey,
        templateId,
        isCommon,
        translationKeys,
        onPatternFound,
      ),
    );
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
      result[key] = remapAndCollectKeys(
        value,
        newSectionKey,
        templateId,
        isCommon,
        translationKeys,
        onPatternFound,
      );
    });
    return result;
  }
  return obj;
}

export function createSectionTranslations(
  translationKeys: string[],
  defaultTranslations: Record<string, Record<string, any>>,
  language: string,
  oldSectionPattern: string,
  newSectionKey: string,
): Record<string, any> {
  const result: Record<string, any> = {};
  const defaults =
    defaultTranslations[language] || defaultTranslations["en"] || {};
  for (const keyStr of translationKeys) {
    if (!isTranslationKey(keyStr)) continue;
    const path = getTranslationPath(keyStr);
    if (
      path[0] === "common" ||
      path[0] !== "sections" ||
      path.length < 2 ||
      path[1] !== oldSectionPattern
    ) {
      continue;
    }
    const defaultKey = path.join(".");
    const sourceValue = defaults[defaultKey] ?? "";
    result.sections = setValueByPath(
      result.sections || {},
      [newSectionKey, ...path.slice(2)],
      sourceValue,
    );
  }
  return result;
}

// ---- TranslationService factory ----------------------------------------

export function buildTranslationService(
  common: Record<string, any>,
  template: Record<string, any>,
  language: string,
): TranslationService | null {
  const merged = deepMerge(common, template);
  if (!merged || Object.keys(merged).length === 0) return null;
  return new TranslationService(language as Locale, merged);
}
