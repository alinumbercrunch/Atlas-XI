import { readFileSync } from "fs";
import { join } from "path";
import { parseSearchPlayers, parseEvents, parseMatchStats, filterSeason } from "./parse.js";
import { pickBestMatch, norm } from "./match.js";

const fx = (name) =>
  JSON.parse(
    readFileSync(join(process.cwd(), "scrapers", "sofascore", "__fixtures__", name), "utf8"),
  );

describe("parseSearchPlayers", () => {
  it("extracts player id/name/team", () => {
    const players = parseSearchPlayers(fx("search-ziyech.json"));
    const z = players.find((p) => p.id === 249437);
    expect(z).toBeTruthy();
    expect(z.name).toMatch(/Ziyech/);
    expect(z.team).toBeTruthy();
  });

  it("returns [] on empty/garbage", () => {
    expect(parseSearchPlayers(null)).toEqual([]);
    expect(parseSearchPlayers({ results: [] })).toEqual([]);
  });
});

describe("parseEvents", () => {
  const events = parseEvents(fx("events-ziyech.json"));
  it("parses events with date, teams, tournament, season", () => {
    expect(events.length).toBeGreaterThan(0);
    const e = events[0];
    expect(e.id).toBeTruthy();
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.tournamentName).toBeTruthy();
    expect(e.uniqueTournamentId).toBeTruthy();
    expect(e.seasonYear).toBeTruthy();
  });

  it("filterSeason keeps only the requested season", () => {
    const year = events[0].seasonYear;
    const filtered = filterSeason(events, year);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((e) => e.seasonYear === year)).toBe(true);
  });
});

describe("parseMatchStats", () => {
  it("extracts rating, minutes, goals, assists", () => {
    const s = parseMatchStats(fx("matchstats-ziyech.json"));
    expect(s.rating).toBe(8.5);
    expect(s.minutes).toBe(90);
    expect(s.goals).toBe(1);
    expect(s.assists).toBe(0);
  });

  it("returns null when the player has no stat line", () => {
    expect(parseMatchStats({})).toBeNull();
    expect(parseMatchStats(null)).toBeNull();
  });
});

describe("pickBestMatch", () => {
  const results = [
    { id: 1, name: "Hakim Ziyech", team: "Al Duhail SC" },
    { id: 249437, name: "Hakim Ziyech", team: "Wydad Casablanca" },
    { id: 3, name: "Hakim Other", team: "X" },
  ];

  it("prefers the exact name + matching club", () => {
    const m = pickBestMatch(results, { name: "Hakim Ziyech", clubName: "Wydad Casablanca" });
    expect(m.id).toBe(249437);
  });

  it("normalizes accents when comparing names", () => {
    const m = pickBestMatch([{ id: 9, name: "Sofyan Amrabat", team: "Fenerbahce" }], {
      name: "Sofyán Amrabât",
      clubName: "Fenerbahçe",
    });
    expect(m.id).toBe(9);
  });

  it("returns null when nothing matches confidently", () => {
    expect(pickBestMatch([], { name: "x" })).toBeNull();
    expect(
      pickBestMatch([{ id: 1, name: "Someone Else", team: "Y" }], {
        name: "Target Name",
        clubName: "Z",
      }),
    ).toBeNull();
  });

  it("norm strips accents and punctuation", () => {
    expect(norm("Fenerbahçe S.K.")).toBe("fenerbahce sk");
  });
});
