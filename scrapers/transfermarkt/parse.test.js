import { readFileSync } from "fs";
import { join } from "path";
import { parseSearch, parseProfile, parseMarketValue, mapPosition } from "./parse.js";

const fx = (name) =>
  readFileSync(join(process.cwd(), "scrapers", "transfermarkt", "__fixtures__", name), "utf8");

describe("parseMarketValue", () => {
  it("parses millions, thousands, and blanks", () => {
    expect(parseMarketValue("€2.20m Last update: x")).toBe(2_200_000);
    expect(parseMarketValue("€900k")).toBe(900_000);
    expect(parseMarketValue("€500Th.")).toBe(500_000);
    expect(parseMarketValue("€1.5bn")).toBe(1_500_000_000);
    expect(parseMarketValue("-")).toBeNull();
    expect(parseMarketValue("")).toBeNull();
  });
});

describe("mapPosition", () => {
  it("maps raw positions to the taxonomy", () => {
    expect(mapPosition("Goalkeeper")).toBe("GK");
    expect(mapPosition("Defender - Centre-Back")).toBe("CB");
    expect(mapPosition("Right-Back")).toBe("FB");
    expect(mapPosition("Defensive Midfield")).toBe("DM");
    expect(mapPosition("Central Midfield")).toBe("CM");
    expect(mapPosition("Attacking Midfield")).toBe("AM");
    expect(mapPosition("Attack - Right Winger")).toBe("W");
    expect(mapPosition("Centre-Forward")).toBe("ST");
    expect(mapPosition("Something odd")).toBeNull();
    expect(mapPosition(null)).toBeNull();
  });
});

describe("parseSearch", () => {
  it("extracts unique player stubs with tm ids", () => {
    const results = parseSearch(fx("search-ziyech.html"));
    expect(results.length).toBeGreaterThan(0);
    const ziyech = results.find((r) => r.name.includes("Ziyech"));
    expect(ziyech).toBeTruthy();
    expect(ziyech.tmId).toBe("217111");
    expect(ziyech.slug).toBeTruthy();
  });
});

describe("parseProfile", () => {
  it("eligible target (Bilal Nadir): Moroccan + 0 senior caps", () => {
    const p = parseProfile(fx("profile-eligible.html"));
    expect(p.name).toBe("Bilal Nadir");
    expect(p.citizenships.map((c) => c.toLowerCase())).toContain("morocco");
    expect(p.seniorCaps).toBe(0);
  });

  it("dual national with senior Morocco caps (Ziyech)", () => {
    const p = parseProfile(fx("profile-ziyech.html"));
    expect(p.name).toBe("Hakim Ziyech");
    const cz = p.citizenships.map((c) => c.toLowerCase());
    expect(cz).toContain("morocco");
    expect(cz).toContain("netherlands");
    expect(p.position).toBe("W");
    expect(p.marketValue).toBeGreaterThan(0);
    expect(p.nationalTeam.country).toBe("Morocco");
    expect(p.nationalTeam.isYouth).toBe(false);
    expect(p.seniorCaps).toBeGreaterThan(0);
  });

  it("full-back with senior Morocco caps (Mazraoui)", () => {
    const p = parseProfile(fx("profile-mazraoui.html"));
    expect(p.position).toBe("FB");
    expect(p.seniorCaps).toBeGreaterThan(0);
    expect(p.nationalTeam.country).toBe("Morocco");
  });

  it("youth international, not Moroccan (Bouabré): youth caps do not count", () => {
    const p = parseProfile(fx("profile-bouabre.html"));
    expect(p.citizenships.map((c) => c.toLowerCase())).not.toContain("morocco");
    expect(p.nationalTeam.isYouth).toBe(true);
    expect(p.nationalTeam.country).toBe("France");
    expect(p.seniorCaps).toBe(0);
  });
});
