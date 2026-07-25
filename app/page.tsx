import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth/session";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/redirect";

/** The destination depends on who is asking, so this must never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * ASI OS has no marketing page. It is a private system, so the root either takes
 * you to your own records or asks who you are.
 */
export default async function RootPage() {
  const user = await getAuthedUser();
  redirect(user ? DEFAULT_SIGNED_IN_PATH : "/login");
}
