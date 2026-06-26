"use client";

import * as React from "react";
import type { DataSourceOptionSource } from "@shopkit/editor-bridge";
import { useTemplateStore } from "../../../stores/templateStore";
import {
  getSectionEditableDataSources,
  type EditableDataSource,
} from "../../data-source/editable";
import { useDataSourceOptions } from "../../data-source/useDataSourceOptions";
import { Dropdown } from "./design-system";
import { MultiSelect } from "./MultiSelect";

/**
 * Inspector block for re-pointing the selected section's data source(s) to a
 * different collection/product. One field per editable data source the
 * section's widgets reference — a single-select for COLLECTION/PRODUCT
 * (`handle`), a multi-select for COLLECTION_BY_HANDLES (`handles`).
 *
 * Single-select uses the design-system Dropdown; multi-select uses the
 * Tailwind MultiSelect (checkbox list) — both styled to match the settings
 * sidebar. Edits handle(s) only — other params are preserved. Locked
 * (route-driven / STATIC) sources never reach here (filtered in editable.ts).
 */

interface DataSourceEditorProps {
  section: { widgets?: Array<{ dataSourceKey?: string | null }> } | null;
}

const NOUN: Record<DataSourceOptionSource, string> = {
  collections: "collection",
  products: "product",
};

// Matches DynamicForm's .fieldWrapper (padding + 0.5px separators) so a
// data-source row sits flush with the section/widget form fields below it.
const FIELD_ROW = "p-3 border-b-[0.5px] border-r-[0.5px] border-[#dfdfdf]";

export function DataSourceEditor({ section }: DataSourceEditorProps) {
  const dataSources = useTemplateStore((s) => s.pageConfig?.dataSources);

  const editable = React.useMemo(
    () => getSectionEditableDataSources(section, dataSources),
    [section, dataSources],
  );

  if (editable.length === 0) return null;

  // With several sources in one section, the bare type label ("Collection")
  // can't tell two same-type fields apart — fall back to the referencing
  // widget's name. A single source keeps the clean type label.
  const disambiguate = editable.length > 1;

  return (
    <>
      {editable.map((ds) => {
        const label =
          disambiguate && ds.widgetName
            ? ds.widgetName
            : fieldLabel(ds.entry.optionSource, ds.entry.mode === "multi");
        return ds.entry.mode === "multi" ? (
          <MultiHandleField key={ds.key} ds={ds} label={label} />
        ) : (
          <SingleHandleField key={ds.key} ds={ds} label={label} />
        );
      })}
    </>
  );
}

/** Merge a handle/handles change into the source's params (keeps productLimit/
 *  first/etc.) and commit — reads params fresh so concurrent edits don't stomp. */
function commitHandle(key: string, paramKey: string, value: string | string[]) {
  const { updateDataSource, pageConfig } = useTemplateStore.getState();
  const params = pageConfig?.dataSources?.[key]?.params ?? {};
  updateDataSource(key, { params: { ...params, [paramKey]: value } });
}

function fieldLabel(source: DataSourceOptionSource, plural: boolean): string {
  const base = source === "products" ? "Product" : "Collection";
  return plural ? `${base}s` : base;
}

function placeholder(
  status: "loading" | "ready" | "error",
  source: DataSourceOptionSource,
  plural = false,
): string {
  const n = NOUN[source];
  if (status === "loading") return `Loading ${n}s…`;
  if (status === "error") return `Couldn't load ${n}s`;
  return `Select ${n}${plural ? "s" : ""}`;
}

/** Field label, matching the design-system Input label (the editor's primary
 *  field-label style: 12px / 500 / #333 / stacked) so the data-source fields
 *  read like the other inputs in the inspector. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium leading-[1.4] text-editor-text mb-2.5">
      {children}
    </label>
  );
}

function SingleHandleField({
  ds,
  label,
}: {
  ds: EditableDataSource;
  label: string;
}) {
  const { options, status } = useDataSourceOptions(ds.entry.optionSource);
  const value = typeof ds.value === "string" ? ds.value : "";

  // Keep the saved handle selectable even if it's not in the fetched list
  // (renamed / offline) so the field shows the real current value.
  const mergedOptions = React.useMemo(() => {
    if (!value || options.some((o) => o.value === value)) return options;
    return [{ value, label: value }, ...options];
  }, [options, value]);

  return (
    <div className={FIELD_ROW}>
      <FieldLabel>{label}</FieldLabel>
      <Dropdown
        options={mergedOptions}
        value={value}
        onChange={(v) => commitHandle(ds.key, ds.entry.paramKey, v)}
        disabled={status === "loading"}
        placeholder={placeholder(status, ds.entry.optionSource)}
        searchable
        searchPlaceholder={`Search ${NOUN[ds.entry.optionSource]}s…`}
        fullWidth
      />
    </div>
  );
}

function MultiHandleField({
  ds,
  label,
}: {
  ds: EditableDataSource;
  label: string;
}) {
  const { options, status } = useDataSourceOptions(ds.entry.optionSource);
  const selected = React.useMemo(
    () => (Array.isArray(ds.value) ? ds.value : []),
    [ds.value],
  );

  // Keep saved handles selectable even if absent from the fetched catalog
  // (renamed, or referenceable by-handle but not in the list endpoint) so they
  // show with a label and can still be deselected.
  const mergedOptions = React.useMemo(() => {
    const missing = selected.filter(
      (h) => !options.some((o) => o.value === h),
    );
    return missing.length
      ? [...missing.map((h) => ({ value: h, label: h })), ...options]
      : options;
  }, [options, selected]);

  return (
    <div className={FIELD_ROW}>
      <FieldLabel>{label}</FieldLabel>
      <MultiSelect
        options={mergedOptions}
        value={selected}
        onChange={(next) => commitHandle(ds.key, ds.entry.paramKey, next)}
        disabled={status === "loading"}
        placeholder={placeholder(status, ds.entry.optionSource, true)}
        searchPlaceholder={`Search ${NOUN[ds.entry.optionSource]}s…`}
      />
    </div>
  );
}
