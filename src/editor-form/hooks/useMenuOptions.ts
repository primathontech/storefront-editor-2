import * as React from "react";
import { api } from "../services/api";

export type MenuOption = { value: string; label: string };
export type MenuOptionsStatus = "loading" | "ready" | "error";

// Module-level cache — the menu list is the same for every Header/Footer field
// in a session, so fetch it once and share the in-flight promise. Reset is not
// needed within an editor session (menus rarely change mid-edit); a full reload
// re-fetches.
let cache: Promise<MenuOption[]> | null = null;

function loadMenuOptions(): Promise<MenuOption[]> {
  if (!cache) {
    cache = api.editor.getNavMenuOptions().catch((err) => {
      // Don't poison the cache on failure — let a later mount retry.
      cache = null;
      throw err;
    });
  }
  return cache;
}

/**
 * Fetches the merchant's published nav menus as dropdown options for the
 * `menuHandle` picker. Best-effort: on failure returns `[]` with status
 * "error" so the field can fall back to the saved handle.
 */
export function useMenuOptions(): {
  options: MenuOption[];
  status: MenuOptionsStatus;
} {
  const [options, setOptions] = React.useState<MenuOption[]>([]);
  const [status, setStatus] = React.useState<MenuOptionsStatus>("loading");

  React.useEffect(() => {
    let alive = true;
    loadMenuOptions()
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
  }, []);

  return { options, status };
}
