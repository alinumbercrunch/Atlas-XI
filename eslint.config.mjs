import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";

// Flat config. Scrapers/ETL are CommonJS Node scripts; the Astro frontend under
// web/ is ESM (+ .astro). Some code runs inside a browser context (Playwright
// page.evaluate, Astro client scripts), so browser globals are allowed there.
export default [
  {
    ignores: [
      "node_modules/",
      "data/",
      "coverage/",
      ".husky/",
      "web/dist/",
      "web/.astro/",
      "**/*.min.js",
    ],
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
  {
    // Astro frontend source (web/) is ESM. queries.js/db.js use import/export.
    files: ["web/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    // Vitest tests: ESM, run through Vite; globals enabled in vitest.config.mjs.
    files: ["**/*.{test,spec}.{js,mjs}"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
  },
  ...eslintPluginAstro.configs.recommended,
  prettier,
];
