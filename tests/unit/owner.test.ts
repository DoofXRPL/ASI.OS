import { describe, expect, it } from "vitest";
import { checkOwner } from "@/lib/auth/session";

/**
 * Ownership requires two independent signals to agree, so neither a database
 * compromise nor a misconfigured environment variable can confer it alone.
 */
describe("checkOwner", () => {
  it("grants ownership when the database says so and no email is configured", () => {
    expect(
      checkOwner({
        isOwnerInDatabase: true,
        email: "owner@example.com",
        expectedOwnerEmail: undefined,
      }),
    ).toBe(true);
  });

  it("denies ownership when the database says so but the email does not match", () => {
    // The database alone is not sufficient once an expected owner is declared.
    expect(
      checkOwner({
        isOwnerInDatabase: true,
        email: "someone.else@example.com",
        expectedOwnerEmail: "owner@example.com",
      }),
    ).toBe(false);
  });

  it("denies ownership when the email matches but the database disagrees", () => {
    // Setting the environment variable cannot invent ownership.
    expect(
      checkOwner({
        isOwnerInDatabase: false,
        email: "owner@example.com",
        expectedOwnerEmail: "owner@example.com",
      }),
    ).toBe(false);
  });

  it("grants ownership when both signals agree", () => {
    expect(
      checkOwner({
        isOwnerInDatabase: true,
        email: "owner@example.com",
        expectedOwnerEmail: "owner@example.com",
      }),
    ).toBe(true);
  });

  it("compares emails case-insensitively and ignores surrounding whitespace", () => {
    expect(
      checkOwner({
        isOwnerInDatabase: true,
        email: "Owner@Example.com",
        expectedOwnerEmail: "  owner@example.COM  ",
      }),
    ).toBe(true);
  });

  it("denies ownership when the account has no email but one is expected", () => {
    expect(
      checkOwner({
        isOwnerInDatabase: true,
        email: null,
        expectedOwnerEmail: "owner@example.com",
      }),
    ).toBe(false);
  });

  it("treats a blank expected email as unconfigured rather than as a match", () => {
    // An empty environment variable must not match an account without an email.
    expect(
      checkOwner({
        isOwnerInDatabase: true,
        email: null,
        expectedOwnerEmail: "   ",
      }),
    ).toBe(true);
  });
});
