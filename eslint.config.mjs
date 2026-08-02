import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      eqeqeq: ["error", "smart"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "prefer-const": "error",
    },
  },
  {
    // Node-side scripts and tests are allowed to talk to stdout and to reach
    // for the service role, which application code may never do.
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    /*
     * The one module in the application whose purpose is to write a line to
     * stdout. `no-console` exists so that logging is a decision rather than a
     * habit, and this is where that decision is recorded: an accepted submission
     * belongs on stdout, not on stderr beside the failures.
     */
    files: ["lib/early-access/log.ts"],
    rules: {
      "no-console": "off",
    },
  },
];

export default config;
