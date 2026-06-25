import type { DataSourceOptionSource } from "@shopkit/editor-bridge";

/**
 * Which data sources a merchant can re-point, and how to render the picker.
 *
 * Two concerns, both about *what to show* for a selected section (not about
 * what to prefetch — there are only two catalogs, so pickers just load their
 * catalog lazily on open; see useDataSourceOptions):
 *   - the editable registry (type -> mode/paramKey/catalog)
 *   - the editability gate (editable type AND a pinned, non-route-driven handle)
 */

// Mirror of the @shopkit/builder DATA_SOURCE_TYPES values we edit — kept local
// to avoid pulling the builder package into the editor (same pattern as
// schemas/section-types.ts). These strings are the data-layer contract keys
// the runtime data-fetcher switches on.
const DATA_SOURCE_TYPES = {
  COLLECTION: "COLLECTION",
  COLLECTION_BY_HANDLES: "COLLECTION_BY_HANDLES",
  PRODUCT: "PRODUCT",
} as const;

export type DataSourceEditMode = "single" | "multi";

export interface DataSourceEditableEntry {
  /** single-select (string handle) vs multi-select (handles array). */
  mode: DataSourceEditMode;
  /** params key holding the editable handle(s). */
  paramKey: "handle" | "handles";
  /** which catalog the dropdown picks from. */
  optionSource: DataSourceOptionSource;
}

/**
 * The only editable types in v1. Mirrors the data-layer contract: COLLECTION /
 * PRODUCT take a single `handle`, COLLECTION_BY_HANDLES takes a `handles`
 * array. Types not listed are intentionally not editable (COLLECTIONS,
 * STATIC, raw fetch/graphql). Scope: edit handle/handles only — other params
 * (productLimit, first, …) stay theme-author-fixed.
 */
const DATA_SOURCE_EDITABLE_REGISTRY: Record<string, DataSourceEditableEntry> = {
  [DATA_SOURCE_TYPES.COLLECTION_BY_HANDLES]: {
    mode: "multi",
    paramKey: "handles",
    optionSource: "collections",
  },
  [DATA_SOURCE_TYPES.COLLECTION]: {
    mode: "single",
    paramKey: "handle",
    optionSource: "collections",
  },
  [DATA_SOURCE_TYPES.PRODUCT]: {
    mode: "single",
    paramKey: "handle",
    optionSource: "products",
  },
};

interface DataSourceConfigLike {
  type?: string;
  params?: Record<string, unknown>;
  required?: boolean;
}
type DataSourcesMap = Record<string, DataSourceConfigLike>;

const INTERPOLATION = /\{\{.*\}\}/;

function isPinnedString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "" && !INTERPOLATION.test(v);
}

export interface EditableDataSource {
  key: string;
  type: string;
  entry: DataSourceEditableEntry;
  /** current handle (single) or handles (multi). */
  value: string | string[];
}

/**
 * Resolve one data source to an editable descriptor, or null if its type isn't
 * editable or its handle is route-driven/empty (locked — e.g. a PDP/PLP source
 * whose handle is `{{params.handle}}` or resolved at render).
 */
export function resolveEditableDataSource(
  key: string,
  config: DataSourceConfigLike | undefined,
): EditableDataSource | null {
  if (!config?.type) return null;
  const entry = DATA_SOURCE_EDITABLE_REGISTRY[config.type];
  if (!entry) return null;
  const raw = config.params?.[entry.paramKey];

  // Multi (handles array) sources are always editable: an empty array is a
  // valid in-progress state — the merchant cleared all chips to re-pick — not
  // a lock. COLLECTION_BY_HANDLES is never route-resolved, so there's nothing
  // to guard against here.
  if (entry.mode === "multi") {
    const value = Array.isArray(raw) ? raw.filter(isPinnedString) : [];
    return { key, type: config.type, entry, value };
  }

  // Single sources are editable only when the handle is a literal; empty or a
  // {{…}} interpolation token means route-driven (PDP/PLP) → locked.
  if (!isPinnedString(raw)) return null;
  return { key, type: config.type, entry, value: String(raw) };
}

/** Editable data sources referenced by a section's widgets (deduped by key) —
 *  drives which dropdowns the inspector shows when a section is selected. */
export function getSectionEditableDataSources(
  section:
    | { widgets?: Array<{ dataSourceKey?: string | null }> }
    | null
    | undefined,
  dataSources: DataSourcesMap | undefined,
): EditableDataSource[] {
  if (!section?.widgets || !dataSources) return [];
  const out: EditableDataSource[] = [];
  const seen = new Set<string>();
  for (const w of section.widgets) {
    const key = w.dataSourceKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const editable = resolveEditableDataSource(key, dataSources[key]);
    if (editable) out.push(editable);
  }
  return out;
}
