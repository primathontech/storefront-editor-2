import { useMemo } from "react";
import { useMachine } from "@xstate/react";
import { fromCallback, fromPromise, type AnyEventObject } from "xstate";
import { Editor } from "../../Editor";
import { PreviewMessage } from "../../components/PreviewMessage";
import { SidebarSkeleton } from "../../components/SidebarSkeleton";
import EditorHeader from "../components/ui/EditorHeader";
import { ActionBar } from "../components/code-editor/ActionBar";
import { FileTree } from "../components/code-editor/FileTree";
import { MonacoCodePanel } from "../components/code-editor/MonacoCodePanel";
import type { PillStatus } from "../components/code-editor/StatusPill";
import { useAuthStore } from "../../stores/authStore";
import {
  markNodeOverridden,
  useCodeEditorStore,
} from "../../stores/codeEditorStore";
import { useEditorUiStore } from "../../stores/editorUiStore";
import { codeEditorSessionMachine } from "../../machines/codeEditorSession";
import { EditorAPI, SourceApiError } from "../services/api";
import type { ThemeStructureTemplate } from "../services/api";

// Code-mode surface (plan §6.3). Same `Editor` 4-area shell + same
// EditorHeader as Visual mode — header's device / mode / save controls
// hide themselves when view === "code"; Code mode owns its own ActionBar.

interface CodeEditorProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

const requireThemeId = (): string => {
  const themeId = useAuthStore.getState().merchant?.themeId;
  if (!themeId) throw new Error("Missing themeId — merchant not authenticated");
  return themeId;
};

const describeBuildError = (err: unknown): string => {
  if (err instanceof SourceApiError) return err.message;
  return err instanceof Error ? err.message : "Build failed.";
};

/**
 * Build-runner callback actor: POST the trigger, then poll
 * GET /builds/{id} every 2000ms until a terminal kind. All outcomes —
 * including trigger failures like 409 preview_required — are reported
 * via BUILD_* events; the actor itself never throws.
 */
const makeBuildRunner = (trigger: "preview" | "publish") =>
  fromCallback<AnyEventObject>(({ sendBack }) => {
    let stopped = false;
    let timer: number | undefined;

    const fail = (error: string) => sendBack({ type: "BUILD_FAILED", error });

    const poll = async (themeId: string, buildId: string, lastKind: string) => {
      if (stopped) return;
      try {
        const status = await EditorAPI.getSourceBuildStatus(themeId, buildId);
        if (stopped) return;
        switch (status.kind) {
          case "queued":
          case "building":
            if (status.kind !== lastKind) {
              sendBack({ type: "BUILD_PROGRESS", kind: status.kind });
            }
            timer = window.setTimeout(
              () => void poll(themeId, buildId, status.kind),
              2000,
            );
            return;
          case "ready":
            sendBack({ type: "BUILD_READY", previewUrl: status.previewUrl });
            return;
          case "published":
            sendBack({ type: "BUILD_PUBLISHED", prodUrl: status.prodUrl });
            return;
          case "failed":
            fail(status.error || "Build failed.");
            return;
        }
      } catch (err) {
        if (!stopped) fail(describeBuildError(err));
      }
    };

    void (async () => {
      try {
        const themeId = requireThemeId();
        const { buildId } =
          trigger === "preview"
            ? await EditorAPI.buildSourcePreview(themeId)
            : await EditorAPI.publishSource(themeId);
        if (stopped) return;
        timer = window.setTimeout(
          () => void poll(themeId, buildId, "queued"),
          2000,
        );
      } catch (err) {
        if (!stopped) fail(describeBuildError(err));
      }
    })();

    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  });

export default function CodeEditor({ onSwitchTemplate }: CodeEditorProps) {
  const device = useEditorUiStore((s) => s.device);
  const mode = useEditorUiStore((s) => s.mode);
  const setDevice = useEditorUiStore((s) => s.setDevice);
  const setMode = useEditorUiStore((s) => s.setMode);

  const tree = useCodeEditorStore((s) => s.tree);
  const openPath = useCodeEditorStore((s) => s.openPath);
  const openContent = useCodeEditorStore((s) => s.openContent);
  const openIsOverride = useCodeEditorStore((s) => s.openIsOverride);
  const isDirty = useCodeEditorStore((s) => s.isDirty);
  const setContent = useCodeEditorStore((s) => s.setContent);

  const providedMachine = useMemo(
    () =>
      codeEditorSessionMachine.provide({
        actors: {
          fetchTree: fromPromise(async () => {
            const themeId = requireThemeId();
            const store = useCodeEditorStore.getState();
            store.reset();
            try {
              const { tree: nodes } = await EditorAPI.getSourceTree(themeId);
              store.setTree(nodes);
            } catch (err) {
              store.setTreeError(
                err instanceof Error
                  ? err.message
                  : "Failed to load file tree",
              );
              throw err;
            }
          }),

          loadFile: fromPromise<void, { path: string }>(async ({ input }) => {
            const themeId = requireThemeId();
            const file = await EditorAPI.getSourceFile(themeId, input.path);
            useCodeEditorStore
              .getState()
              .openFile(input.path, file.content, file.version, file.isOverride);
          }),

          saveFile: fromPromise(async () => {
            const themeId = requireThemeId();
            const s = useCodeEditorStore.getState();
            if (!s.openPath) throw new Error("No file open");
            const path = s.openPath;
            const contentAtSave = s.openContent;
            const { version } = await EditorAPI.saveSourceFile(
              themeId,
              path,
              contentAtSave,
              s.openVersion,
            );
            // A successful save creates/refreshes the override. Keep
            // isDirty honest if the user kept typing mid-flight.
            useCodeEditorStore.setState((cur) => ({
              openVersion: version,
              openIsOverride: true,
              isDirty: cur.openContent !== contentAtSave,
              tree: markNodeOverridden(cur.tree, path, true),
            }));
          }),

          revertFile: fromPromise(async () => {
            const themeId = requireThemeId();
            const s = useCodeEditorStore.getState();
            if (!s.openPath) throw new Error("No file open");
            const path = s.openPath;
            await EditorAPI.revertSourceFile(themeId, path);
            // Reload base content so the panel reflects the revert.
            const file = await EditorAPI.getSourceFile(themeId, path);
            const store = useCodeEditorStore.getState();
            store.openFile(path, file.content, file.version, file.isOverride);
            store.setTree(
              markNodeOverridden(store.tree, path, file.isOverride),
            );
          }),

          runPreviewBuild: makeBuildRunner("preview"),
          runPublishBuild: makeBuildRunner("publish"),
        },
      }),
    [],
  );

  const [state, send] = useMachine(providedMachine);

  const isBooting = state.matches("bootingTree");
  const isLoadError = state.matches("loadError");

  const fileLoading = state.hasTag("fileLoading");
  const fileLoadFailed = state.hasTag("fileLoadFailed");
  const saving = state.hasTag("saveSaving");
  const reverting = state.hasTag("fileReverting");
  const saveFailed = state.hasTag("saveFailed");
  const buildInFlight =
    state.hasTag("buildQueued") || state.hasTag("buildBuilding");

  const pillStatus: PillStatus =
    saving || reverting
      ? "saving"
      : state.hasTag("saveSaved")
        ? "saved"
        : saveFailed || state.hasTag("buildFailed")
          ? "failed"
          : state.hasTag("buildQueued")
            ? "queued"
            : state.hasTag("buildBuilding")
              ? "building"
              : state.hasTag("buildReady")
                ? "ready"
                : state.hasTag("buildPublished")
                  ? "published"
                  : "idle";

  const openUrl = state.hasTag("buildReady")
    ? state.context.previewUrl
    : state.hasTag("buildPublished")
      ? state.context.prodUrl
      : null;
  const openUrlLabel = state.hasTag("buildPublished")
    ? "Open Site"
    : "Open Preview";

  const handleSelect = (path: string) => {
    if (path === openPath && !fileLoadFailed) return;
    if (
      useCodeEditorStore.getState().isDirty &&
      !window.confirm("Discard unsaved changes in the current file?")
    ) {
      return;
    }
    send({ type: "FILE_SELECTED", path });
  };

  return (
    <Editor
      header={
        <EditorHeader
          onSwitchTemplate={onSwitchTemplate}
          device={device}
          setDevice={setDevice}
          mode={mode}
          setMode={setMode}
          // Visual-mode save controls are hidden while view === "code";
          // the ActionBar below owns saving here.
          saveStatus="idle"
          saveDisabled
          onSave={() => {}}
        />
      }
      leftSidebar={
        isBooting || isLoadError ? (
          <SidebarSkeleton />
        ) : (
          <FileTree
            tree={tree}
            activePath={openPath}
            onSelect={handleSelect}
          />
        )
      }
      preview={
        isBooting ? (
          <PreviewMessage label="Loading files…" />
        ) : isLoadError ? (
          <PreviewMessage
            label="Failed to load file tree."
            onRetry={() => send({ type: "RETRY" })}
          />
        ) : (
          <div className="flex h-full flex-col">
            {fileLoadFailed ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white">
                <p className="font-mono text-sm text-red-600">
                  Couldn't load this file.
                </p>
                <button
                  type="button"
                  onClick={() => send({ type: "RETRY" })}
                  className="cursor-pointer text-sm text-blue-600 underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <MonacoCodePanel
                path={openPath}
                value={openContent}
                onChange={setContent}
                onSaveRequested={() => send({ type: "SAVE_REQUESTED" })}
                loading={fileLoading}
              />
            )}
            <ActionBar
              status={pillStatus}
              saving={saving}
              reverting={reverting}
              buildInFlight={buildInFlight}
              canSave={isDirty && !saving && !reverting && !!openPath}
              canRevert={
                !!openPath && openIsOverride && !saving && !reverting
              }
              openUrl={openUrl}
              openUrlLabel={openUrlLabel}
              saveError={state.context.saveError}
              buildError={state.context.buildError}
              onSave={() => send({ type: "SAVE_REQUESTED" })}
              onRevert={() => send({ type: "REVERT_REQUESTED" })}
              onBuildPreview={() => send({ type: "BUILD_REQUESTED" })}
              onPublish={() => send({ type: "PUBLISH_REQUESTED" })}
              onDismissError={() => send({ type: "DISMISS" })}
            />
          </div>
        )
      }
    />
  );
}
