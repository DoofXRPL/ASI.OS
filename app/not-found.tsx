import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-base font-medium text-ink">Nothing here</h1>
      <p className="text-sm text-ink-muted">
        This address does not correspond to anything in ASI OS. Surfaces appear in
        the navigation only once they do real work, so there are no hidden pages to
        find.
      </p>
      <Link href="/today" className="text-sm text-accent hover:underline">
        Go to Today
      </Link>
    </main>
  );
}
