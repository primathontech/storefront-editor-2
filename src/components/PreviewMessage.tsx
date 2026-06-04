// Centered message that fills the preview area. Used for boot, error,
// and the over-iframe overlay during the iframe-ready handshake. Same
// look across both lanes.

interface Props {
  label: string;
  onRetry?: () => void;
}

export const PreviewMessage = ({ label, onRetry }: Props) => (
  <div className="absolute inset-0 flex items-center justify-center bg-editor-canvas">
    <div className="flex flex-col items-center gap-3">
      {!onRetry && (
        <div className="h-8 w-8 rounded-full border-2 border-editor-border border-t-blue-500 animate-spin" />
      )}
      <div className="text-sm text-editor-text-muted">{label}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-blue-600 underline"
        >
          Retry
        </button>
      )}
    </div>
  </div>
);
