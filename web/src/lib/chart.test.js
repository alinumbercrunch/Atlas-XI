import { formSeries, rollingAverage, last5, buildFormChart, buildCareerChart } from "./chart.js";

const log = (rows) =>
  rows.map(([date, rating, minutes, league]) => ({
    date,
    rating,
    minutes,
    league: league ? "Ligue 1" : null,
    competition: league ? "Ligue 1" : "Cup",
  }));

describe("formSeries", () => {
  it("filters null ratings and sorts ascending by date", () => {
    const s = formSeries(
      log([
        ["2026-03-01", 7, 90, true],
        ["2026-01-01", null, 90, true],
        ["2026-02-01", 6, 45, false],
      ]),
    );
    expect(s.map((m) => m.date)).toEqual(["2026-02-01", "2026-03-01"]);
    expect(s[0].isLeague).toBe(false);
  });
});

describe("rollingAverage", () => {
  it("is a trailing mean", () => {
    const s = formSeries(
      log([
        ["2026-01-01", 6, 90, true],
        ["2026-01-08", 8, 90, true],
      ]),
    );
    const r = rollingAverage(s, 5);
    expect(r[0].avg).toBe(6);
    expect(r[1].avg).toBe(7);
  });
});

describe("last5", () => {
  it("takes the 5 most recent and tags tone", () => {
    const rows = [];
    for (let i = 1; i <= 7; i++) rows.push([`2026-01-0${i}`, 5 + i * 0.4, 80, true]);
    const p = last5(log(rows));
    expect(p).toHaveLength(5);
    expect(p[p.length - 1].date).toBe("2026-01-07");
    expect(last5(log([["2026-01-01", 7.5, 90, true]]))[0].tone).toBe("good");
    expect(last5(log([["2026-01-01", 5.4, 90, true]]))[0].tone).toBe("poor");
  });
});

describe("buildCareerChart", () => {
  it("needs >= 2 seasons", () => {
    expect(buildCareerChart([{ year: "25/26", score: 6 }]).hasEnough).toBe(false);
  });
  it("maps seasons to a line, first left, last right", () => {
    const c = buildCareerChart([
      { year: "23/24", score: 5.5, apps: 20 },
      { year: "24/25", score: 6.2, apps: 25 },
      { year: "25/26", score: 6.0, apps: 22 },
    ]);
    expect(c.hasEnough).toBe(true);
    expect(c.points).toHaveLength(3);
    expect(c.points[0].cx).toBeLessThan(c.points[2].cx);
    expect(c.linePath.startsWith("M")).toBe(true);
    expect(c.xLabels.map((l) => l.label)).toEqual(["23/24", "24/25", "25/26"]);
  });
});

describe("buildFormChart", () => {
  it("needs >= 6 league matches", () => {
    const few = buildFormChart(log([["2026-01-01", 7, 90, true]]));
    expect(few.hasEnough).toBe(false);
  });

  it("produces points, a trend path and reference lines in range", () => {
    const rows = [];
    for (let i = 1; i <= 8; i++) rows.push([`2026-0${i}-01`, 6 + (i % 3) * 0.5, 60 + i, true]);
    const c = buildFormChart(log(rows), { avg: 6.5 });
    expect(c.hasEnough).toBe(true);
    expect(c.points).toHaveLength(8);
    expect(c.trendPath.startsWith("M")).toBe(true);
    // avg line sits between the top and bottom of the plot
    expect(c.avgY).toBeGreaterThan(c.PADT);
    expect(c.avgY).toBeLessThan(c.height - c.PADB);
    // bigger minutes => bigger radius
    const small = c.points.find((p) => p.minutes === 61);
    const big = c.points.find((p) => p.minutes === 68);
    expect(big.r).toBeGreaterThan(small.r);
  });
});
