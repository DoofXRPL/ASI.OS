import { describe, expect, it } from "vitest";
import { DEFAULT_SIGNED_IN_PATH, safeRedirectPath } from "@/lib/auth/redirect";

/**
 * An unvalidated `redirect` parameter on a sign-in page is a phishing primitive:
 * the victim authenticates on a page they trust and is handed to a page they do
 * not. Every one of these cases is an attack that must fail closed.
 */
describe("safeRedirectPath", () => {
  it("keeps a same-origin absolute path", () => {
    expect(safeRedirectPath("/activity")).toBe("/activity");
  });

  it("preserves query and fragment on an accepted path", () => {
    expect(safeRedirectPath("/settings?section=identity#name")).toBe(
      "/settings?section=identity#name",
    );
  });

  it.each([
    ["an absolute external URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
    ["a backslash escape", "/\\evil.example"],
    ["a mixed-slash escape", "/\\/evil.example"],
    ["a relative path", "activity"],
    ["a parent traversal", "../etc/passwd"],
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a tab-obfuscated scheme", "java\tscript:alert(1)"],
    ["a newline injection", "/activity\nLocation: https://evil.example"],
    ["a null byte", "/activity\u0000"],
  ])("rejects %s", (_label, candidate) => {
    expect(safeRedirectPath(candidate)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it.each([[null], [undefined], [123], [{}], [[]]])(
    "rejects the non-string value %s",
    (candidate) => {
      // Values arriving from a query string or form are untyped at runtime.
      expect(safeRedirectPath(candidate as unknown as string)).toBe(
        DEFAULT_SIGNED_IN_PATH,
      );
    },
  );

  it("honours an explicit fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/settings")).toBe("/settings");
  });

  it("defaults to Today, the home of the loop", () => {
    expect(DEFAULT_SIGNED_IN_PATH).toBe("/today");
  });
});
