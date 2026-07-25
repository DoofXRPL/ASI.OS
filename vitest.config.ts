import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Two projects, deliberately separated:
 *
 * - `unit` runs pure logic with no I/O. Fast, always runnable.
 * - `rls`  runs against a real PostgreSQL database and proves that Row Level
 *          Security isolates users. It is a required CI gate, not an optional
 *          extra, because RLS is the only isolation boundary in this product.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
        },
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.test.ts"],
          globalSetup: ["tests/rls/global-setup.ts"],
          /**
           * Every RLS file runs against the same database, which is the point:
           * the policies under test are the real ones, applied once from
           * migrations. A single fork runs those files one at a time, so
           * concurrent transactions cannot make a genuine failure look like a
           * flake — or, worse, hide one.
           */
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
