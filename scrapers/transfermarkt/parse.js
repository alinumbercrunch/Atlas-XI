const { parseHtml } = require("../../lib/parseHtml");

// A youth national-team level appears inside the team name, e.g. "France U21".
const YOUTH_RE = /\bU-?\s?\d{1,2}\b|youth/i;

// "€2.20m" -> 2200000 ; "€900k"/"€500Th." -> 900000/500000 ; "-"/"" -> null.
function parseMarketValue(text) {
  if (!text) return null;
  const m = text.replace(/\s+/g, "").match(/€([\d.,]+)(bn|m|k|th)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  const mult = { bn: 1e9, m: 1e6, k: 1e3, th: 1e3 }[(m[2] || "").toLowerCase()] || 1;
  return Math.round(num * mult);
}

// Map a raw Transfermarkt position string to our taxonomy: GK/CB/FB/DM/CM/AM/W/ST.
// Ordered from most specific to most general; returns null for anything unrecognized.
function mapPosition(raw) {
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (p.includes("goalkeeper")) return "GK";
  if (p.includes("centre-back") || p.includes("center-back") || p.includes("centre back"))
    return "CB";
  if (p.includes("back")) return "FB"; // left/right/full/wing back (centre-back already handled)
  if (p.includes("defensive midfield")) return "DM";
  if (p.includes("attacking midfield")) return "AM";
  if (p.includes("left midfield") || p.includes("right midfield")) return "W";
  if (p.includes("midfield")) return "CM";
  if (p.includes("winger") || p.includes("wing")) return "W";
  if (p.includes("forward") || p.includes("striker")) return "ST";
  return null;
}

// Parse a Transfermarkt quick-search results page into player stubs.
function parseSearch(html) {
  const $ = parseHtml(html);
  const seen = new Set();
  const out = [];
  $('a[href*="/profil/spieler/"]').each((i, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/\/([^/]+)\/profil\/spieler\/(\d+)/);
    const name = $(el).text().replace(/\s+/g, " ").trim();
    if (!m || !name || seen.has(m[2])) return;
    seen.add(m[2]);
    out.push({ name, slug: m[1], tmId: m[2], href });
  });
  return out;
}

// Parse a Transfermarkt player profile page. Pure: takes HTML, returns a plain object.
function parseProfile(html) {
  const $ = parseHtml(html);

  const name = $("h1.data-header__headline-wrapper")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#\d+\s*/, "") // drop shirt-number prefix, e.g. "#7 "
    .trim();

  const marketValue = parseMarketValue($(".data-header__market-value-wrapper").text());

  // info-table: a "regular" label span followed by a "bold" value span.
  const valueFor = (labelRe) =>
    $(".info-table__content--regular")
      .filter((i, el) => labelRe.test($(el).text()))
      .first()
      .next(".info-table__content--bold");

  const citizenshipCell = valueFor(/Citizenship/i);
  let citizenships = citizenshipCell
    .find("img")
    .map((i, el) => $(el).attr("title"))
    .get()
    .filter(Boolean);
  if (!citizenships.length) {
    const t = citizenshipCell.text().replace(/\s+/g, " ").trim();
    if (t) citizenships = [t];
  }

  const positionRaw =
    valueFor(/Position/i)
      .text()
      .replace(/\s+/g, " ")
      .trim() || null;
  const birthplace =
    valueFor(/Place of birth/i)
      .text()
      .replace(/\s+/g, " ")
      .trim() || null;

  // National-team info lives in the header block.
  let ntContent = "";
  let caps = 0;
  $(".data-header__label").each((i, el) => {
    const own = $(el).clone().children().remove().end().text().replace(/\s+/g, " ").trim();
    if (/caps\/goals/i.test(own)) {
      const m = $(el).text().match(/(\d+)/);
      if (m) caps = Number(m[1]);
    } else if (/international|national player/i.test(own)) {
      ntContent = $(el).find(".data-header__content").text().replace(/\s+/g, " ").trim();
    }
  });

  let nationalTeam = null;
  let seniorCaps = 0;
  if (ntContent) {
    const isYouth = YOUTH_RE.test(ntContent);
    const levelMatch = ntContent.match(YOUTH_RE);
    const country = ntContent
      .replace(YOUTH_RE, "")
      .replace(/[-\s]+$/, "")
      .trim();
    nationalTeam = { country, level: isYouth && levelMatch ? levelMatch[0] : null, isYouth };
    seniorCaps = isYouth ? 0 : caps; // youth caps do NOT cap-tie
  }

  return {
    name,
    citizenships,
    birthplace,
    positionRaw,
    position: mapPosition(positionRaw),
    marketValue,
    nationalTeam,
    seniorCaps,
  };
}

module.exports = { parseSearch, parseProfile, parseMarketValue, mapPosition };
