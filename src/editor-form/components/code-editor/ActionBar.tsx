import { Button } from "../ui/design-system";
import { StatusPill, type PillStatus } from "./StatusPill";
import type { SaveErrorInfo } from "../../../machines/codeEditorSession";

// Bottom strip of the code workspace. Pure render — every enable /
// disable decision is computed in CodeEditor.tsx from machine tags +
// store dirty state and handed in as props.

interface ActionBarProps {
  status: PillStatus;
  saving: boolean;
  reverting: boolean;
  buildInFlight: boolean;
  canSave: boolean;
  canRevert: boolean;
  /** Set when a build reached ready/published — enables Open Preview. */
  openUrl: string | null;
  openUrlLabel: string;
  saveError: SaveErrorInfo | null;
  buildError: string | null;
  onSave: () => void;
  onRevert: () => void;
  onBuildPreview: () => void;
  onPublish: () => void;
  onDismissError: () => void;
}

export const ActionBar = ({
  status,
  saving,
  reverting,
  buildInFlight,
  canSave,
  canRevert,
  openUrl,
  openUrlLabel,
  saveError,
  buildError,
  onSave,
  onRevert,
  onBuildPreview,
  onPublish,
  onDismissError,
}: ActionBarProps) => {
  const hasError = !!saveError || !!buildError;

  return (
    <div className="shrink-0 border-t-[0.5px] border-editor-border bg-white">
      {hasError && (
        <div className="flex items-start gap-2 px-4 pt-2 text-xs text-red-600">
          <div className="min-w-0 flex-1">
            {buildError && <p>{buildError}</p>}
            {saveError && (
              <>
                <p>{saveError.message}</p>
                {saveError.issues.length > 0 && (
                  <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-4 font-mono">
                    {saveError.issues.map((issue, i) => (
                      <li key={i}>
                        {issue.line != null
                          ? `L${issue.line}${
                              issue.column != null ? `:${issue.column}` : ""
                            } — `
                          : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 cursor-pointer text-editor-text-muted hover:text-editor-text"
            aria-label="Dismiss error"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-2">
        <StatusPill status={status} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRevert}
            disabled={!canRevert}
            loading={reverting}
            title="Drop this file's override — next build uses base code"
          >
            Revert
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onSave}
            disabled={!canSave}
            loading={saving}
            title={canSave ? "Save draft (⌘S)" : "No changes to save"}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onBuildPreview}
            disabled={buildInFlight}
            title="Build a preview deploy of the current draft"
          >
            Build Preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onPublish}
            disabled={buildInFlight}
            title="Promote the previewed draft to production"
          >
            Publish
          </Button>
          {openUrl && (
            <Button
              variant="success"
              size="sm"
              onClick={() => window.open(openUrl, "_blank", "noopener")}
            >
              {openUrlLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
