import { useMemo, useState } from "react";
import type { FileNode } from "../../services/api";
import { isEditablePath } from "../../../config/editable-paths";

// VS-Code-ish file tree for the code editor's left sidebar. The tree
// arrives pre-filtered from the BE; isEditablePath() re-filters on the
// display side (belt + suspenders) so a forbidden path never renders.

interface FileTreeProps {
  tree: FileNode[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

const EXT_BADGE: Record<string, { label: string; className: string }> = {
  tsx: { label: "TSX", className: "text-blue-600" },
  ts: { label: "TS", className: "text-blue-600" },
  json: { label: "{}", className: "text-amber-600" },
  css: { label: "#", className: "text-purple-600" },
};

const extOf = (name: string) =>
  name.slice(name.lastIndexOf(".") + 1).toLowerCase();

/** Drop non-editable files and dirs left empty by the filter. */
function filterTree(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (isEditablePath(node.path)) out.push(node);
      continue;
    }
    const children = filterTree(node.children ?? []);
    if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    className={`h-3 w-3 shrink-0 text-editor-text-muted transition-transform ${
      open ? "rotate-90" : ""
    }`}
    aria-hidden
  >
    <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const FileTree = ({ tree, activePath, onSelect }: FileTreeProps) => {
  const visibleTree = useMemo(() => filterTree(tree), [tree]);

  // Top-level dirs start expanded; everything deeper starts collapsed.
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        visibleTree.filter((n) => n.type === "dir").map((n) => n.path),
      ),
  );

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

  const renderNode = (node: FileNode, depth: number) => {
    const indent = { paddingLeft: `${8 + depth * 14}px` };

    if (node.type === "dir") {
      const isOpen = expanded.has(node.path);
      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => toggle(node.path)}
            style={indent}
            className="flex w-full cursor-pointer items-center gap-1.5 py-1 pr-2 text-left text-[12.5px] text-editor-text hover:bg-gray-50"
            aria-expanded={isOpen}
          >
            <Chevron open={isOpen} />
            <span className="truncate font-medium">{node.name}</span>
          </button>
          {isOpen && node.children && node.children.length > 0 && (
            <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
          )}
        </li>
      );
    }

    const isActive = node.path === activePath;
    const badge = EXT_BADGE[extOf(node.name)];
    return (
      <li key={node.path}>
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          style={indent}
          className={`flex w-full cursor-pointer items-center gap-1.5 py-1 pr-2 text-left font-mono text-[12.5px] ${
            isActive
              ? "bg-blue-50 text-blue-700"
              : "text-editor-text hover:bg-gray-50"
          }`}
          aria-current={isActive ? "true" : undefined}
        >
          <span
            className={`w-6 shrink-0 text-[9px] font-bold ${
              badge?.className ?? "text-editor-text-muted"
            }`}
            aria-hidden
          >
            {badge?.label ?? extOf(node.name).toUpperCase()}
          </span>
          <span className="truncate">{node.name}</span>
          {node.isOverridden && (
            <span
              className="ml-auto shrink-0 pl-2 text-[10px] font-bold text-amber-600"
              title="Modified — this file has a draft override"
            >
              M
            </span>
          )}
        </button>
      </li>
    );
  };

  if (visibleTree.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-editor-text-muted">
        No editable files found.
      </div>
    );
  }

  return (
    <nav aria-label="Source files" className="flex-1 overflow-y-auto py-2">
      <ul>{visibleTree.map((node) => renderNode(node, 0))}</ul>
    </nav>
  );
};
