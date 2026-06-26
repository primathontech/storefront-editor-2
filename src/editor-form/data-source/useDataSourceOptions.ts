import * as React from "react";
import type {
  DataSourceOption,
  DataSourceOptionSource,
} from "@shopkit/editor-bridge";
import { requestDataSourceOptions } from "../preview-bridge";

export type DataSourceOptionsStatus = "loading" | "ready" | "error";

// Module-level cache, one entry per catalog — the collections/products list is
// the same for the whole merchant session, so fetch each once (over the bridge)
// and share the in-flight promise. Same shape as useMenuOptions. Empty results
// aren't cached, so a picker opened before the iframe bridge was ready (or
// before the merchant wired its callback) retries on the next open.
const cache: Partial<
  Record<DataSourceOptionSource, Promise<DataSourceOption[]>>
> = {};

function loadOptions(
  source: DataSourceOptionSource,
): Promise<DataSourceOption[]> {
  if (!cache[source]) {
    cache[source] = requestDataSourceOptions(source).then((items) => {
      if (items.length === 0) cache[source] = undefined; // allow a later retry
      return items;
    });
  }
  return cache[source]!;
}

/**
 * Collections/products dropdown options for the data-source pickers, loaded
 * lazily on first use and cached per merchant session. Best-effort: returns
 * `[]` so the field falls back to the saved handle.
 */
export function useDataSourceOptions(source: DataSourceOptionSource): {
  options: DataSourceOption[];
  status: DataSourceOptionsStatus;
} {
  const [options, setOptions] = React.useState<DataSourceOption[]>([]);
  const [status, setStatus] = React.useState<DataSourceOptionsStatus>("loading");

  React.useEffect(() => {
    let alive = true;
    setStatus("loading");
    loadOptions(source)
      .then((opts) => {
        if (!alive) return;
        setOptions(opts);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [source]);

  return { options, status };
}
