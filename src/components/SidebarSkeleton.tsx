import { Skeleton } from "./Skeleton";

// Booting/error placeholder for the left sidebar — row height matches real
// sidebar rows so the layout doesn't jump.
export const SidebarSkeleton = () => <Skeleton rows={4} className="p-3" />;
