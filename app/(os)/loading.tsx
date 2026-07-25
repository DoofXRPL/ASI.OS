import { Skeleton } from "@/components/os/states";

/**
 * Loading state for private surfaces.
 *
 * Shapes that match the content they will become — never a zero, a dash, or an
 * example value, each of which could be misread as real information.
 */
export default function OsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2 border-b border-line pb-5">
        <Skeleton className="h-5 w-40" label="Loading page title" />
        <Skeleton className="h-4 w-full max-w-md" label="Loading page purpose" />
      </div>
      <Skeleton className="h-24 w-full" label="Loading content" />
      <Skeleton className="h-40 w-full" label="Loading content" />
    </div>
  );
}
