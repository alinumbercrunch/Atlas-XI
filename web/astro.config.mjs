import { defineConfig } from "astro/config";

// Static site. Frontmatter reads the SQLite DB at build time via better-sqlite3
// (kept external so the native module isn't bundled). fs.allow lets us import the
// shared rating/ code and read ../data from the repo root.
export default defineConfig({
  vite: {
    ssr: { external: ["better-sqlite3"] },
    server: { fs: { allow: [".."] } },
  },
});
