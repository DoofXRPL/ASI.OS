import { describe, expect, it } from "vitest";
import { resolveDevSignIn } from "@/lib/auth/dev-sign-in";

/**
 * This is the only place in ASI OS where the sign-in screen can be skipped, so
 * the conditions are pinned down exhaustively. Every test here is really the
 * same question: can this shortcut switch itself on somewhere it should not?
 */

const CREDENTIALS = {
  email: "owner@asi.local",
  password: "correct-horse-battery-staple",
};

describe("in production", () => {
  it("refuses even when both credentials are set", () => {
    expect(
      resolveDevSignIn({ ...CREDENTIALS, nodeEnv: "production" }),
    ).toBeNull();
  });

  it("refuses regardless of how the credentials are shaped", () => {
    for (const email of ["owner@asi.local", " owner@asi.local ", "x"]) {
      expect(
        resolveDevSignIn({ email, password: "anything", nodeEnv: "production" }),
        `production must refuse "${email}"`,
      ).toBeNull();
    }
  });
});

describe("outside production", () => {
  it("resolves when both credentials are present", () => {
    expect(resolveDevSignIn({ ...CREDENTIALS, nodeEnv: "development" })).toEqual(
      CREDENTIALS,
    );
  });

  it("stays off unless it is switched on deliberately", () => {
    // Both halves are required, so a single stray variable cannot enable it.
    const off = [
      { email: undefined, password: undefined },
      { email: CREDENTIALS.email, password: undefined },
      { email: undefined, password: CREDENTIALS.password },
      { email: "", password: CREDENTIALS.password },
      { email: "   ", password: CREDENTIALS.password },
      { email: CREDENTIALS.email, password: "" },
    ];

    for (const env of off) {
      expect(
        resolveDevSignIn({ ...env, nodeEnv: "development" }),
        `must stay off for ${JSON.stringify(env)}`,
      ).toBeNull();
    }
  });

  it("trims the email but never the password", () => {
    const resolved = resolveDevSignIn({
      email: "  owner@asi.local  ",
      password: "  spaces matter  ",
      nodeEnv: "development",
    });

    expect(resolved?.email).toBe("owner@asi.local");
    expect(resolved?.password).toBe("  spaces matter  ");
  });

  it("works under the test environment too, where it is also harmless", () => {
    expect(resolveDevSignIn({ ...CREDENTIALS, nodeEnv: "test" })).toEqual(
      CREDENTIALS,
    );
  });

  it("resolves when the environment is unset, which is not production", () => {
    expect(resolveDevSignIn({ ...CREDENTIALS, nodeEnv: undefined })).toEqual(
      CREDENTIALS,
    );
  });
});
