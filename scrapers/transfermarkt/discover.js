const { parseHtml } = require("../../lib/parseHtml");
const { parseMarketValue, mapPosition } = require("./parse");

// Transfermarkt's "most valuable players" list filtered by nationality is our
// targeted discovery source: it includes dual-nationals whose Moroccan citizenship
// is tagged, ranked by market value, paginated 25/page.
const MOROCCO_LAND_ID = 107;

// Parse one page of the most-valuable list into player stubs.
function parseList(html) {
  const $ = parseHtml(html);
  const out = [];
  $("table.items > tbody > tr").each((i, tr) => {
    const a = $(tr).find("table.inline-table td.hauptlink a").first();
    const name = a.text().trim();
    const m = (a.attr("href") || "").match(/\/([^/]+)\/profil\/spieler\/(\d+)/);
    if (!name || !m) return;
    const positionRaw = $(tr).find("table.inline-table tr").eq(1).find("td").text().trim() || null;
    const citizenships = $(tr)
      .find("img.flaggenrahmen")
      .map((k, el) => $(el).attr("title"))
      .get()
      .filter(Boolean);
    const clubName = $(tr).find("td.zentriert a img").attr("alt") || null;
    const marketValue = parseMarketValue($(tr).find("td.rechts").last().text());
    out.push({
      name,
      slug: m[1],
      tmId: m[2],
      positionRaw,
      position: mapPosition(positionRaw),
      citizenships,
      clubName,
      marketValue,
    });
  });
  return out;
}

// Highest page number referenced by the pagination controls (1 if none).
function parseLastPage(html) {
  const $ = parseHtml(html);
  let last = 1;
  $("a").each((i, el) => {
    const mm = ($(el).attr("href") || "").match(/[?&]page=(\d+)/);
    if (mm) last = Math.max(last, Number(mm[1]));
  });
  return last;
}

// Paginate the whole list for a nationality, returning de-duplicated stubs.
// `client` must expose listMostValuable(landId, page) -> html.
async function discoverByNation(
  client,
  { landId = MOROCCO_LAND_ID, maxPages = Infinity, onProgress } = {},
) {
  const firstHtml = await client.listMostValuable(landId, 1);
  const lastPage = Math.min(parseLastPage(firstHtml), maxPages);

  const byId = new Map();
  const add = (stubs) => stubs.forEach((s) => byId.set(s.tmId, s));
  add(parseList(firstHtml));
  if (onProgress) onProgress(1, lastPage, byId.size);

  for (let page = 2; page <= lastPage; page++) {
    add(parseList(await client.listMostValuable(landId, page)));
    if (onProgress) onProgress(page, lastPage, byId.size);
  }
  return [...byId.values()];
}

module.exports = { parseList, parseLastPage, discoverByNation, MOROCCO_LAND_ID };
