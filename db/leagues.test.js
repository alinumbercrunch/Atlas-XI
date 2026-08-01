import { LEAGUES } from "./leagues.js";

describe("LEAGUES data integrity", () => {
  it("has exactly 16 divisions", () => {
    expect(LEAGUES).toHaveLength(16);
  });

  it("has unique ids", () => {
    const ids = LEAGUES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has valid, complete fields for every league", () => {
    for (const l of LEAGUES) {
      expect(l.id).toMatch(/^[a-z]{3}-[12]$/);
      expect(l.name).toBeTruthy();
      expect(l.country).toBeTruthy();
      expect(l.countryCode).toMatch(/^[A-Z]{3}$/);
      expect([1, 2]).toContain(l.tier);
      expect(l.coefficient).toBeGreaterThan(0);
      expect(l.coefficient).toBeLessThanOrEqual(1);
    }
  });

  it("anchors known coefficients (PL top, Botola baseline)", () => {
    const byId = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));
    expect(byId["eng-1"].coefficient).toBe(1.0);
    expect(byId["mar-1"].coefficient).toBe(0.5);
  });

  it("covers all 10 countries", () => {
    const countries = new Set(LEAGUES.map((l) => l.country));
    expect(countries.size).toBe(10);
  });
});
