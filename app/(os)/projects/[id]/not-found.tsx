import Link from "next/link";
import { PageHeader } from "@/components/os/page-header";
import { NothingYet } from "@/components/os/states";

/**
 * Shown both when a project does not exist and when it belongs to someone else,
 * deliberately worded the same way. Row Level Security already makes another
 * account's rows unreachable; wording the two cases differently would leak the
 * one thing that remains — whether an identifier exists at all.
 */
export default function ProjectNotFound() {
  return (
    <>
      <PageHeader
        title="Not found"
        stage="Understand"
        purpose="This page describes a project that is not in your records."
      />
      <NothingYet
        headline="No such project in your records."
        detail="The link may be out of date, or the project may never have existed here."
        action={
          <Link href="/projects" className="text-sm text-accent hover:underline">
            All projects
          </Link>
        }
      />
    </>
  );
}
