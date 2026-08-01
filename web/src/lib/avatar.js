import { existsSync } from "node:fs";
import path from "node:path";

// Return the public URL for a locally-downloaded player photo, or null if we
// don't have it (so the page can fall back to an initials avatar).
export function playerImage(sofascoreId) {
  if (!sofascoreId) return null;
  const file = path.join(process.cwd(), "web", "public", "players", `${sofascoreId}.webp`);
  return existsSync(file) ? `/players/${sofascoreId}.webp` : null;
}

export function initials(name) {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
