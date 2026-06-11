import MonacoEditor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useRef } from "react";
import { inferLanguage } from "../../../config/editable-paths";

// Monaco wrapper for the code editor surface. Mirrors HtmlEditor.tsx
// conventions (theme "vs", minimap off, wordWrap on) and adds:
//   - Cmd/Ctrl+S → onSaveRequested (machine SAVE_REQUESTED)
//   - TS configured for react-jsx so widget TSX parses, with
//     module-resolution diagnostics suppressed — merchant files import
//     @shopkit/* packages Monaco can't resolve in-browser; red-squiggling
//     every import would make the editor look broken.

interface MonacoCodePanelProps {
  path: string | null;
  value: string;
  onChange: (next: string) => void;
  onSaveRequested: () => void;
  loading?: boolean;
}

// Diagnostics that only fire because Monaco has no module graph:
// 2307/2792 cannot-find-module, 2305/2614 missing export on an
// unresolvable module, 7016 implicit-any from untyped import,
// 7026/7031 implicit-any JSX/props fallout of the above.
const SUPPRESSED_TS_DIAGNOSTICS = [2307, 2792, 2305, 2614, 7016, 7026, 7031];

export const MonacoCodePanel = ({
  path,
  value,
  onChange,
  onSaveRequested,
  loading = false,
}: MonacoCodePanelProps) => {
  // addCommand closes over mount-time scope; ref keeps the latest
  // handler reachable without re-mounting the editor.
  const onSaveRef = useRef(onSaveRequested);
  useEffect(() => {
    onSaveRef.current = onSaveRequested;
  }, [onSaveRequested]);

  const handleMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorInstance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => onSaveRef.current(),
      );

      const tsDefaults = monaco.languages.typescript.typescriptDefaults;
      tsDefaults.setCompilerOptions({
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        skipLibCheck: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      });
      tsDefaults.setDiagnosticsOptions({
        diagnosticCodesToIgnore: SUPPRESSED_TS_DIAGNOSTICS,
      });
    },
    [],
  );

  if (!path) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="font-mono text-sm text-editor-text-muted">
          Select a file to edit
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 bg-white">
      <MonacoEditor
        path={path}
        language={inferLanguage(path)}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        onMount={handleMount}
        theme="vs"
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          lineNumbers: "on",
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 8 },
        }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <p className="font-mono text-sm text-editor-text-muted">
            Loading file…
          </p>
        </div>
      )}
    </div>
  );
};
