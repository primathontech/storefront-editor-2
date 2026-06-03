// Placeholder sidebar content shown while a lane is booting or in error.
// Matches the look of real sidebar rows so the layout doesn't jump.

export const SidebarSkeleton = () => (
  <div className="p-3 space-y-2" aria-hidden>
    <div className="h-10 bg-slate-100 rounded animate-pulse" />
    <div className="h-10 bg-slate-100 rounded animate-pulse" />
    <div className="h-10 bg-slate-100 rounded animate-pulse" />
    <div className="h-10 bg-slate-100 rounded animate-pulse" />
  </div>
);
