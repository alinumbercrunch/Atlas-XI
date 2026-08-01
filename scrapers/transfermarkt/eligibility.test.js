import { readFileSync } from "fs";
import { join } from "path";
import { classifyEligibility } from "./eligibility.js";
import { parseProfile } from "./parse.js";

const fx = (name) =>
  readFileSync(join(process.cwd(), "scrapers", "transfermarkt", "__fixtures__", name), "utf8");

describe("classifyEligibility", () => {
  it("Moroccan + 0 senior caps => eligible", () => {
    const r = classifyEligibility({ citizenships: ["Morocco", "France"], seniorCaps: 0 });
    expect(r.status).toBe("eligible");
    expect(r.reason).toBe("uncapped");
  });

  it("Moroccan + senior caps for another country => review (friendlies don't cap-tie)", () => {
    const r = classifyEligibility({
      citizenships: ["Morocco"],
      seniorCaps: 3,
      nationalTeam: { country: "France", isYouth: false },
    });
    expect(r.status).toBe("review");
  });

  it("Moroccan + senior Morocco caps => excluded (already secured)", () => {
    const r = classifyEligibility({
      citizenships: ["Morocco"],
      seniorCaps: 40,
      nationalTeam: { country: "Morocco", isYouth: false },
    });
    expect(r.status).toBe("excluded");
    expect(r.reason).toBe("already-morocco-senior");
  });

  it("not Moroccan => excluded", () => {
    const r = classifyEligibility({ citizenships: ["France", "Senegal"], seniorCaps: 0 });
    expect(r.status).toBe("excluded");
    expect(r.reason).toBe("not-moroccan");
  });

  it("youth caps for another country do not cap-tie => eligible", () => {
    const r = classifyEligibility({
      citizenships: ["Morocco"],
      seniorCaps: 0,
      nationalTeam: { country: "France", isYouth: true },
    });
    expect(r.status).toBe("eligible");
  });

  it("override include forces eligible even without Moroccan citizenship", () => {
    const r = classifyEligibility({ citizenships: ["France"], override: { action: "include" } });
    expect(r.status).toBe("eligible");
    expect(r.reason).toBe("override-include");
  });

  it("override exclude forces excluded", () => {
    const r = classifyEligibility({
      citizenships: ["Morocco"],
      seniorCaps: 0,
      override: { action: "exclude" },
    });
    expect(r.status).toBe("excluded");
    expect(r.reason).toBe("override-exclude");
  });
});

describe("parse + classify integration (real fixtures)", () => {
  const cases = [
    ["profile-eligible.html", "eligible"],
    ["profile-ziyech.html", "excluded"], // already Morocco senior
    ["profile-mazraoui.html", "excluded"], // already Morocco senior
    ["profile-bouabre.html", "excluded"], // not Moroccan
  ];
  it.each(cases)("%s => %s", (file, expected) => {
    const p = parseProfile(fx(file));
    expect(classifyEligibility(p).status).toBe(expected);
  });
});
