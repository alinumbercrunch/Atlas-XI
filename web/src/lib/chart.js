// Pure geometry for the per-player "season form" chart. No rendering, no DOM —
// takes a match log and returns SVG-ready coordinates so the .astro component
// stays dumb. Single series (one player's ratings over time); minutes are encoded
// as dot radius, league vs cup as fill.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000; // days since epoch
}
function monthLabel(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`;
}
function tone(rating) {
  return rating >= 7 ? "good" : rating >= 6 ? "ok" : "poor";
}

// Rated matches, ascending by date.
export function formSeries(matchLog) {
  return (matchLog || [])
    .filter((m) => m.rating != null && m.date)
    .map((m) => ({
      date: m.date,
      t: parseDay(m.date),
      rating: m.rating,
      minutes: m.minutes || 0,
      isLeague: !!m.league,
      competition: m.competition,
    }))
    .sort((a, b) => a.t - b.t);
}

// Trailing simple moving average of ratings.
export function rollingAverage(series, window = 5) {
  return series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1);
    return { t: series[i].t, avg: slice.reduce((s, x) => s + x.rating, 0) / slice.length };
  });
}

// The most recent up-to-5 rated matches, each tagged good/ok/poor.
export function last5(matchLog) {
  return formSeries(matchLog)
    .slice(-5)
    .map((m) => ({ ...m, tone: tone(m.rating) }));
}

// Multi-season career trajectory: a labeled line of fair score per season.
// Needs >= 2 seasons. `seasons` is the output of getPlayerSeasons (ascending).
export function buildCareerChart(seasons, { width = 520, height = 170 } = {}) {
  if (!seasons || seasons.length < 2) return { hasEnough: false };
  const PADL = 16,
    PADR = 16,
    PADT = 26,
    PADB = 22;
  const plotW = width - PADL - PADR;
  const plotH = height - PADT - PADB;
  const scores = seasons.map((s) => s.score);
  const lo = Math.min(...scores) - 0.4;
  const hi = Math.max(...scores) + 0.4;
  const n = seasons.length;
  const x = (i) => PADL + (i / (n - 1)) * plotW;
  const y = (v) => PADT + ((hi - v) / (hi - lo || 1)) * plotH;
  const points = seasons.map((s, i) => ({
    cx: +x(i).toFixed(1),
    cy: +y(s.score).toFixed(1),
    score: s.score,
    year: s.year,
    apps: s.apps,
    minutes: s.minutes,
    leagues: s.leagues,
  }));
  return {
    hasEnough: true,
    width,
    height,
    points,
    linePath: points.map((p, i) => `${i ? "L" : "M"}${p.cx},${p.cy}`).join(" "),
    xLabels: points.map((p) => ({ x: p.cx, label: p.year })),
  };
}

// Everything the SVG needs. Returns { hasEnough:false } when there aren't enough
// league matches to draw a meaningful trend.
export function buildFormChart(
  matchLog,
  { avg = null, baseline = 6.7, width = 680, height = 200 } = {},
) {
  const all = formSeries(matchLog);
  const league = all.filter((m) => m.isLeague);
  if (league.length < 6) return { hasEnough: false };

  const PADL = 26,
    PADR = 12,
    PADT = 12,
    PADB = 20;
  const plotW = width - PADL - PADR;
  const plotH = height - PADT - PADB;

  const ratings = all.map((m) => m.rating);
  const lo = Math.min(6.0, ...ratings) - 0.3;
  const hi = Math.max(7.5, ...ratings) + 0.3;
  const tmin = all[0].t;
  const tmax = all[all.length - 1].t;
  const span = tmax - tmin || 1;

  const x = (t) => PADL + ((t - tmin) / span) * plotW;
  const y = (r) => PADT + ((hi - r) / (hi - lo)) * plotH;
  const rad = (min) => Math.max(2.2, Math.min(6.8, 2.2 + (min / 90) * 4.6));

  const points = all.map((m) => ({
    cx: +x(m.t).toFixed(1),
    cy: +y(m.rating).toFixed(1),
    r: +rad(m.minutes).toFixed(1),
    isLeague: m.isLeague,
    rating: m.rating,
    minutes: m.minutes,
    date: m.date,
    competition: m.competition,
  }));

  const trendPath = rollingAverage(league, 5)
    .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.avg).toFixed(1)}`)
    .join(" ");

  const seasonAvg = avg != null ? avg : league.reduce((s, m) => s + m.rating, 0) / league.length;

  const yTicks = [];
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) yTicks.push({ v, y: +y(v).toFixed(1) });

  return {
    hasEnough: true,
    width,
    height,
    PADL,
    PADR,
    PADT,
    PADB,
    points,
    trendPath,
    baseline,
    baselineY: +y(baseline).toFixed(1),
    seasonAvg,
    avgY: +y(seasonAvg).toFixed(1),
    yTicks,
    xLabels: [
      { x: +x(tmin).toFixed(1), label: monthLabel(all[0].date), anchor: "start" },
      { x: +x(tmax).toFixed(1), label: monthLabel(all[all.length - 1].date), anchor: "end" },
    ],
  };
}
