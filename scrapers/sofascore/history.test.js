import { parseSeasonsToFetch, parseOverall, seasonSortKey } from "./history.js";

describe("seasonSortKey", () => {
  it("parses season-year to a sortable start year", () => {
    expect(seasonSortKey("24/25")).toBe(2024);
    expect(seasonSortKey("2025")).toBe(2025);
    expect(seasonSortKey("")).toBe(0);
  });
});

describe("parseSeasonsToFetch", () => {
  const json = {
    uniqueTournamentSeasons: [
      {
        uniqueTournament: { id: 17, name: "Premier League" }, // eng-1
        seasons: [
          { id: 1, year: "25/26" },
          { id: 2, year: "24/25" },
          { id: 3, year: "20/21" },
        ],
      },
      {
        uniqueTournament: { id: 999999, name: "Some Cup" }, // not one of our leagues
        seasons: [{ id: 9, year: "25/26" }],
      },
    ],
  };

  it("keeps only our leagues and the most recent seasons", () => {
    const out = parseSeasonsToFetch(json, undefined, { maxBack: 2 });
    expect(out.map((r) => r.year).sort()).toEqual(["24/25", "25/26"]);
    expect(out.every((r) => r.leagueId === "eng-1")).toBe(true);
    expect(out.some((r) => r.utId === 999999)).toBe(false);
  });
});

describe("parseOverall", () => {
  it("extracts rating and counting stats", () => {
    expect(
      parseOverall({
        statistics: { rating: 7.5, minutesPlayed: 1800, appearances: 20, goals: 5, assists: 3 },
      }),
    ).toEqual({ rating: 7.5, minutes: 1800, appearances: 20, goals: 5, assists: 3 });
  });
  it("returns null without a rating", () => {
    expect(parseOverall({ statistics: {} })).toBeNull();
    expect(parseOverall(null)).toBeNull();
  });
});
