import type { Metadata } from "next";
import Link from "next/link";
import { NorthstarMark } from "@/components/brand/northstar";
import { NotConfigured } from "@/components/os/states";
import { getSupabaseEnvStatus } from "@/lib/supabase/env";
import { safeRedirectPath, DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/redirect";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const envStatus = getSupabaseEnvStatus();

  const redirectTo = params.redirect
    ? safeRedirectPath(params.redirect)
    : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <NorthstarMark className="size-9" />
        <h1 className="text-lg font-medium text-ink">ASI OS</h1>
        <p className="text-sm text-ink-muted">
          Adaptive Systems Interface. Access is by invitation only — there is no
          public sign-up.
        </p>
      </header>

      {envStatus.configured ? (
        <>
          {params.error ? (
            <p role="alert" className="text-sm text-danger">
              {params.error}
            </p>
          ) : null}
          <SignInForm
            {...(redirectTo && redirectTo !== DEFAULT_SIGNED_IN_PATH
              ? { redirectTo }
              : {})}
          />
        </>
      ) : (
        <NotConfigured
          missing={envStatus.missing}
          detail="Sign-in cannot work until these environment variables are set. Nothing is reachable in the meantime, which is intentional."
        />
      )}

      <footer className="space-y-3 text-xs text-ink-faint">
        <p>
          Every record in ASI OS is isolated at the database level. Read
          <code className="mx-1 font-mono">docs/DATA-MODEL.md</code>
          for how that is enforced and proven.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md text-ink-muted transition-colors duration-150 hover:text-ink"
        >
          What this is
        </Link>
      </footer>
    </main>
  );
}
