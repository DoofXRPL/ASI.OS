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
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
