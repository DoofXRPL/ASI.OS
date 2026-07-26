import { Skeleton } from "@/components/os/states";

/**
 * Shaped like a project page rather than a generic block, so the layout does
 * not move under the reader when the real content arrives. Never a zero, a dash
 * or an example sentence, each of which could be misread as a real record.
 */
export default function ProjectLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-2 border-b border-line pb-5">
        <Skeleton className="h-5 w-56" label="Loading project name" />
        <Skeleton className="h-4 w-full max-w-md" label="Loading outcome" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" label="Loading section title" />
        <Skeleton className="h-7 w-full max-w-lg" label="Loading next action" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" label="Loading section title" />
        <Skeleton className="h-24 w-full" label="Loading captures" />
      </div>
    </div>
  );
}
