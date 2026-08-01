// The fair rating (PLAN.md §3). Pure functions — no DB, fully unit-testable.
//
// Fix SofaScore's two blind spots:
//   1. minutes — weight each match rating by minutes played
//   2. league strength — multiply by a (minutes-weighted) league coefficient
// and shrink small samples toward a baseline so a hot 10-minute cameo can't
// outrank a solid season.

const BASELINE = 6.7; // prior rating a player regresses toward until they earn minutes
const K = 500; // prior "minutes" — larger K => more skeptical of small samples

// Compute a player's fair season score from their LEAGUE match stat lines.
// Each match: { rating, minutes, coefficient }. The caller passes league matches only
// (cup/other competitions are excluded). Null ratings or non-positive minutes are ignored.
function computePlayerScore(matches, { baseline = BASELINE, k = K } = {}) {
  const valid = matches.filter(
    (m) => m.rating != null && m.minutes != null && m.minutes > 0 && m.coefficient != null,
  );
  const minutes = valid.reduce((s, m) => s + m.minutes, 0);
  if (minutes === 0) {
    return { matchesCount: 0, minutes: 0, wavg: null, shrunk: null, coefficient: null, score: 0 };
  }
  const wavg = valid.reduce((s, m) => s + m.rating * m.minutes, 0) / minutes;
  const shrunk = (wavg * minutes + baseline * k) / (minutes + k);
  // Minutes-weighted average coefficient handles mid-season transfers between leagues.
  const coefficient = valid.reduce((s, m) => s + m.coefficient * m.minutes, 0) / minutes;
  return {
    matchesCount: valid.length,
    minutes,
    wavg,
    shrunk,
    coefficient,
    score: shrunk * coefficient,
  };
}

// Best XI — squad shape and how raw positions fill it.
const FORMATION_433 = { GK: 1, CB: 2, FB: 2, MID: 3, W: 2, ST: 1 };
const POSITION_BUCKET = {
  GK: "GK",
  CB: "CB",
  FB: "FB",
  DM: "MID",
  CM: "MID",
  AM: "MID",
  W: "W",
  ST: "ST",
};

function playerBuckets(player) {
  const positions = player.positions?.length ? player.positions : [player.position];
  return [...new Set(positions.map((p) => POSITION_BUCKET[p]).filter(Boolean))];
}

// Pick the optimal Best XI: a max-weight assignment of players to formation slots.
// Feasibility of a chosen player set is a transversal matroid, so adding players in
// descending score (keeping a valid matching via augmenting paths) yields the optimum —
// strictly better than naive top-per-slot when players cover multiple positions.
function selectBestXI(players, formation = FORMATION_433) {
  const slots = [];
  for (const [bucket, count] of Object.entries(formation)) {
    for (let i = 0; i < count; i++) slots.push(bucket);
  }

  const cands = players
    .filter((p) => p.score > 0)
    .map((p) => ({ ...p, buckets: playerBuckets(p) }))
    .filter((p) => p.buckets.length)
    .sort((a, b) => b.score - a.score);

  const slotOf = new Array(slots.length).fill(null); // slot index -> cand index
  const augment = (pi, visited) => {
    for (let s = 0; s < slots.length; s++) {
      if (visited[s] || !cands[pi].buckets.includes(slots[s])) continue;
      visited[s] = true;
      if (slotOf[s] === null || augment(slotOf[s], visited)) {
        slotOf[s] = pi;
        return true;
      }
    }
    return false;
  };

  for (let pi = 0; pi < cands.length; pi++) {
    augment(pi, new Array(slots.length).fill(false));
  }

  const xi = slots.map((bucket, s) => ({
    slot: bucket,
    player: slotOf[s] != null ? cands[slotOf[s]] : null,
  }));
  return {
    xi,
    filled: xi.filter((x) => x.player).length,
    totalScore: xi.reduce((sum, x) => sum + (x.player ? x.player.score : 0), 0),
  };
}

module.exports = { computePlayerScore, selectBestXI, BASELINE, K, FORMATION_433, POSITION_BUCKET };
