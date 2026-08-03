import { computePlayerScore, selectBestXI } from "./score.js";

const m = (rating, minutes, coefficient = 1) => ({ rating, minutes, coefficient });

describe("computePlayerScore", () => {
  it("solves the cameo problem (PLAN.md worked example)", () => {
    // Sub: 8.0 over 50 min; Starter: 7.0 over 2700 min. baseline 6.2, K 500, coeff 1.
    const sub = computePlayerScore([m(8.0, 50)]);
    const starter = computePlayerScore([m(7.0, 2700)]);
    expect(sub.score).toBeCloseTo(6.36, 2);
    expect(starter.score).toBeCloseTo(6.875, 3);
    expect(starter.score).toBeGreaterThan(sub.score); // solid starter beats flashy cameo
  });

  it("weights the coefficient by minutes across leagues (transfers)", () => {
    // Half a season at coeff 1.0, half at 0.5, same rating 7 => coeff ~0.75.
    const r = computePlayerScore([m(7, 900, 1.0), m(7, 900, 0.5)]);
    expect(r.coefficient).toBeCloseTo(0.75, 5);
    expect(r.score).toBeCloseTo(r.shrunk * 0.75, 5);
  });

  it("ignores null ratings and non-positive minutes", () => {
    const r = computePlayerScore([m(null, 90), m(7, 0), m(8, 90)]);
    expect(r.matchesCount).toBe(1);
    expect(r.minutes).toBe(90);
  });

  it("returns score 0 when there are no valid league matches", () => {
    expect(computePlayerScore([]).score).toBe(0);
    expect(computePlayerScore([m(null, 90)]).matchesCount).toBe(0);
  });

  it("a stronger league lifts an equal rating", () => {
    const pl = computePlayerScore([m(7, 2000, 1.0)]);
    const botola = computePlayerScore([m(7, 2000, 0.5)]);
    expect(pl.score).toBeGreaterThan(botola.score);
  });
});

describe("selectBestXI", () => {
  const p = (id, position, score) => ({
    id,
    name: `p${id}`,
    position,
    score,
    positions: [position],
  });

  it("fills a 4-3-3 and maximizes total score", () => {
    const players = [
      p(1, "GK", 8),
      p(2, "GK", 6),
      p(3, "CB", 8),
      p(4, "CB", 7),
      p(5, "CB", 6),
      p(6, "FB", 7),
      p(7, "FB", 7),
      p(8, "CM", 8),
      p(9, "DM", 7),
      p(10, "AM", 7),
      p(11, "W", 8),
      p(12, "W", 7),
      p(13, "ST", 9),
    ];
    const { xi, filled, totalScore } = selectBestXI(players);
    expect(filled).toBe(11);
    // 1 GK, 2 CB, 2 FB, 3 MID, 2 W, 1 ST = 11
    expect(xi.filter((x) => x.slot === "GK")).toHaveLength(1);
    expect(xi.filter((x) => x.slot === "MID")).toHaveLength(3);
    // The best GK (8) is chosen over the weaker one (6).
    expect(xi.find((x) => x.slot === "GK").player.id).toBe(1);
    // Excluded: weakest CB (id 5, score 6) since only 2 CB slots.
    expect(xi.some((x) => x.player?.id === 5)).toBe(false);
    expect(totalScore).toBeGreaterThan(0);
  });

  it("uses a versatile player in whichever slot maximizes the team", () => {
    // Only one defender, but he can play CB or FB; leaves other slots empty.
    const players = [{ id: 1, position: "CB", positions: ["CB", "FB"], score: 9, name: "flex" }];
    const { filled } = selectBestXI(players);
    expect(filled).toBe(1);
  });

  it("skips players with zero score", () => {
    const players = [{ id: 1, position: "ST", positions: ["ST"], score: 0, name: "x" }];
    expect(selectBestXI(players).filled).toBe(0);
  });
});
