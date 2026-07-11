import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

// Flat config. Scrapers/ETL are CommonJS Node scripts today; some run code inside
// Playwright's browser context (page.evaluate), so we allow browser globals too.
// NOTE (Phase 6): when the Astro frontend lands under web/, add eslint-plugin-astro
// and a dedicated config block for *.astro / ESM files.
export default [
  {
    ignores: ["node_modules/", "data/", ".husky/", "**/*.min.js"],
  },
  js.configs.recommended,
  {
    // CommonJS Node scripts (scrapers, lib, ETL). page.evaluate callbacks run in the
    // browser, so browser globals are allowed alongside node globals.
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Empty catch is used deliberately (e.g. JSON.parse fallbacks leave a value null).
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // ESM config/tooling files (this config, future Astro/ESM code).
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  prettier,
];
