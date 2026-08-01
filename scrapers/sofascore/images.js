// Download player photos from SofaScore (WebP) into web/public/players/<id>.webp,
// served locally by the frontend. Incremental: skips files already present.
const fs = require("node:fs");
const path = require("node:path");
const { SofascoreClient } = require("./client");
const { getDb, initSchema } = require("../../db");

const OUT_DIR = path.join(__dirname, "..", "..", "web", "public", "players");

// SofaScore ids of players worth an image: those with a positive score
// (covers both the Best XI and the Browse table).
function playersNeedingImages(db) {
  return db
    .prepare(
      `SELECT DISTINCT p.sofascore_id AS id
       FROM players p JOIN player_scores ps ON ps.player_id = p.id
       WHERE p.sofascore_id IS NOT NULL AND ps.score > 0`,
    )
    .all()
    .map((r) => r.id);
}

async function downloadImages(ids, { client, force = false, onProgress } = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ownClient = !client;
  client = client || new SofascoreClient();
  const counts = { saved: 0, skipped: 0, missing: 0 };
  let i = 0;
  try {
    for (const id of ids) {
      const file = path.join(OUT_DIR, `${id}.webp`);
      if (!force && fs.existsSync(file)) {
        counts.skipped++;
      } else {
        try {
          const buf = await client.playerImage(id);
          if (buf && buf.length > 1000) {
            fs.writeFileSync(file, buf);
            counts.saved++;
          } else {
            counts.missing++;
          }
        } catch {
          counts.missing++;
        }
      }
      if (onProgress && ++i % 25 === 0) onProgress(i, ids.length, counts);
    }
  } finally {
    if (ownClient) await client.close();
  }
  return counts;
}

async function run() {
  const db = initSchema(getDb());
  const ids = playersNeedingImages(db);
  console.log(`[img] downloading images for ${ids.length} players…`);
  const counts = await downloadImages(ids, {
    onProgress: (i, n, c) =>
      console.log(
        `[img]   ${i}/${n} (saved ${c.saved}, skipped ${c.skipped}, missing ${c.missing})`,
      ),
  });
  console.log("[img] done:", JSON.stringify(counts));
  db.close();
  return counts;
}

module.exports = { downloadImages, playersNeedingImages, OUT_DIR };

if (require.main === module) {
  run().catch((e) => {
    console.error("[img] fatal:", e);
    process.exit(1);
  });
}
