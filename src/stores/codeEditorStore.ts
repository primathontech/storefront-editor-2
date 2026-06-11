import { create } from "zustand";
import type { FileNode } from "../editor-form/services/api";

// Code-editor lane data — pure data layer for codeEditorSessionMachine
// (plan §6.5). The machine's actor bodies write here; FileTree /
// MonacoCodePanel / ActionBar subscribe. No async, no HTTP.

export interface CodeEditorStore {
  tree: FileNode[];
  treeError: string | null;
  openPath: string | null;
  openContent: string;
  openVersion: string; // BE-provided opaque token (etag or sha)
  openIsOverride: boolean;
  isDirty: boolean;

  setTree: (nodes: FileNode[]) => void;
  setTreeError: (error: string | null) => void;
  openFile: (
    path: string,
    content: string,
    version: string,
    isOverride: boolean,
  ) => void;
  setContent: (next: string) => void;
  closeFile: () => void;
  reset: () => void;
}

const EMPTY_FILE_STATE = {
  openPath: null,
  openContent: "",
  openVersion: "",
  openIsOverride: false,
  isDirty: false,
} as const;

export const useCodeEditorStore = create<CodeEditorStore>((set) => ({
  tree: [],
  treeError: null,
  ...EMPTY_FILE_STATE,

  setTree: (nodes) => set({ tree: nodes }),
  setTreeError: (error) => set({ treeError: error }),

  openFile: (path, content, version, isOverride) =>
    set({
      openPath: path,
      openContent: content,
      openVersion: version,
      openIsOverride: isOverride,
      isDirty: false,
    }),

  setContent: (next) =>
    set((state) => ({
      openContent: next,
      isDirty: state.openPath !== null,
    })),

  closeFile: () => set({ ...EMPTY_FILE_STATE }),

  reset: () => set({ tree: [], treeError: null, ...EMPTY_FILE_STATE }),
}));

/**
 * Pure helper — return a tree with the file node at `path` re-flagged.
 * Used after save (override created) and revert (override dropped) so the
 * FileTree badge tracks reality without a tree refetch.
 */
export function markNodeOverridden(
  tree: FileNode[],
  path: string,
  isOverridden: boolean,
): FileNode[] {
  return tree.map((node) => {
    if (node.type === "file") {
      return node.path === path ? { ...node, isOverridden } : node;
    }
    if (!node.children || !path.startsWith(`${node.path}/`)) return node;
    return {
      ...node,
      children: markNodeOverridden(node.children, path, isOverridden),
    };
  });
}
