// Session status pill for the code editor's ActionBar. One flat status
// domain derived (in CodeEditor.tsx) from the machine's state tags.

export type PillStatus =
  | "idle"
  | "saving"
  | "saved"
  | "queued"
  | "building"
  | "ready"
  | "published"
  | "failed";

const PILL: Record<PillStatus, { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-gray-100 text-gray-500" },
  saving: { label: "Saving…", className: "bg-blue-50 text-blue-700" },
  saved: { label: "Saved", className: "bg-green-50 text-green-700" },
  queued: { label: "Build queued", className: "bg-amber-50 text-amber-700" },
  building: { label: "Building…", className: "bg-blue-50 text-blue-700" },
  ready: { label: "Preview ready", className: "bg-green-50 text-green-700" },
  published: { label: "Published", className: "bg-green-50 text-green-700" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700" },
};

const IN_FLIGHT: ReadonlySet<PillStatus> = new Set([
  "saving",
  "queued",
  "building",
]);

export const StatusPill = ({ status }: { status: PillStatus }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${PILL[status].className}`}
  >
    {IN_FLIGHT.has(status) && (
      <span
        className="h-1.5 w-1.5 rounded-full bg-current animate-pulse"
        aria-hidden
      />
    )}
    {PILL[status].label}
  </span>
);
