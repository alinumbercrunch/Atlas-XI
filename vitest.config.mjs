import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Manual proof scripts and config are not unit-tested logic.
      exclude: [
        "**/*.config.*",
        "**/*.test.*",
        "node_modules/**",
        "coverage/**",
        "scrapers/sofascore/verify.js",
      ],
    },
  },
});
