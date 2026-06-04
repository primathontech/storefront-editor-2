// One generic full-screen message used for all pre-Editor states:
// auth loading, missing/invalid token, retryable errors, theme load,
// theme error. Variants are driven by props alone — no per-state files.

interface Props {
  title: string;
  subtitle?: string;
  onRetry?: () => void;
  spinner?: boolean;
}

export const FullPageMessage = ({
  title,
  subtitle,
  onRetry,
  spinner,
}: Props) => (
  <div className="h-screen flex items-center justify-center bg-editor-canvas px-6">
    <div className="max-w-md text-center flex flex-col items-center gap-3">
      {spinner && (
        <div className="h-8 w-8 rounded-full border-2 border-editor-border border-t-blue-500 animate-spin" />
      )}
      <h1 className="text-base font-semibold text-editor-text">{title}</h1>
      {subtitle && (
        <p className="text-sm text-editor-text-muted">{subtitle}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Try again
        </button>
      )}
    </div>
  </div>
);
