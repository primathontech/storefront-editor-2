import * as React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of shimmer rows. */
  rows?: number;
  /** Tailwind height util per row, e.g. "h-7". */
  rowHeight?: string;
  /** Tailwind gap util between rows. */
  gap?: string;
}

// Generic list shimmer: `rows` uniform pulse bars. Match rowHeight/gap to the
// real rows so layout doesn't jump. aria-hidden (decorative); extra props (e.g.
// className for padding) pass through to the wrapper.
export const Skeleton = ({
  rows = 4,
  rowHeight = "h-10",
  gap = "gap-2",
  className,
  ...rest
}: SkeletonProps) => (
  <div
    aria-hidden
    className={["flex flex-col", gap, className].filter(Boolean).join(" ")}
    {...rest}
  >
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className={`${rowHeight} rounded bg-slate-100 animate-pulse`}
      />
    ))}
  </div>
);
