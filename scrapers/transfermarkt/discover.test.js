import { readFileSync } from "fs";
import { join } from "path";
import { parseList, parseLastPage, discoverByNation } from "./discover.js";

const fx = (name) =>
  readFileSync(join(process.cwd(), "scrapers", "transfermarkt", "__fixtures__", name), "utf8");

describe("parseList", () => {
  const stubs = parseList(fx("list-morocco.html"));

  it("parses 25 player stubs from a page", () => {
    expect(stubs).toHaveLength(25);
  });

  it("extracts name, tmId, position, club, citizenships, market value", () => {
    const hakimi = stubs[0];
    expect(hakimi.name).toBe("Achraf Hakimi");
    expect(hakimi.tmId).toMatch(/^\d+$/);
    expect(hakimi.position).toBe("FB");
    expect(hakimi.citizenships.map((c) => c.toLowerCase())).toContain("morocco");
    expect(hakimi.clubName).toBeTruthy();
    expect(hakimi.marketValue).toBeGreaterThan(0);
  });

  it("captures dual-nationals (most of page 1)", () => {
    const dual = stubs.filter((s) => s.citizenships.length > 1);
    expect(dual.length).toBeGreaterThan(10);
  });
});

describe("parseLastPage", () => {
  it("reads the highest page number from pagination", () => {
    expect(parseLastPage(fx("list-morocco.html"))).toBe(20);
  });
});

describe("discoverByNation", () => {
  it("paginates and de-duplicates across pages", async () => {
    // Fake client: same fixture for every page, but capped at 3 pages.
    const client = {
      listMostValuable: async () => fx("list-morocco.html"),
    };
    const seenPages = [];
    const stubs = await discoverByNation(client, {
      maxPages: 3,
      onProgress: (p) => seenPages.push(p),
    });
    // Same fixture each page => dedupe by tmId collapses to 25 unique players.
    expect(stubs).toHaveLength(25);
    expect(seenPages).toEqual([1, 2, 3]);
  });
});
