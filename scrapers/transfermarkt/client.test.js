import { readFileSync } from "fs";
import { join } from "path";
import { TransfermarktClient } from "./client.js";

const fx = (name) =>
  readFileSync(join(process.cwd(), "scrapers", "transfermarkt", "__fixtures__", name), "utf8");

// A fake fetch that serves fixtures by URL shape and records the calls it received.
function fakeFetch(mapping) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    for (const [needle, file] of Object.entries(mapping)) {
      if (url.includes(needle)) return fx(file);
    }
    throw new Error("unexpected url: " + url);
  };
  return { impl, calls };
}

function client(fetchImpl) {
  return new TransfermarktClient({ fetchImpl, delay: 0, backoff: 0 });
}

describe("TransfermarktClient", () => {
  it("search() builds the schnellsuche URL and parses results", async () => {
    const { impl, calls } = fakeFetch({ schnellsuche: "search-ziyech.html" });
    const results = await client(impl).search("Ziyech");
    expect(calls[0]).toContain("/schnellsuche/ergebnis/schnellsuche?query=Ziyech");
    expect(results.find((r) => r.tmId === "217111")).toBeTruthy();
  });

  it("fetchProfile() builds the profile URL and returns parsed data + tmId", async () => {
    const { impl, calls } = fakeFetch({ "/profil/spieler/": "profile-ziyech.html" });
    const p = await client(impl).fetchProfile("hakim-ziyech", "217111");
    expect(calls[0]).toBe("https://www.transfermarkt.com/hakim-ziyech/profil/spieler/217111");
    expect(p.name).toBe("Hakim Ziyech");
    expect(p.tmId).toBe("217111");
  });

  it("findPlayer() chains search then profile", async () => {
    const { impl, calls } = fakeFetch({
      schnellsuche: "search-ziyech.html",
      "/profil/spieler/": "profile-ziyech.html",
    });
    const p = await client(impl).findPlayer("Ziyech");
    expect(p.name).toBe("Hakim Ziyech");
    expect(calls).toHaveLength(2); // one search, one profile
  });

  it("search() rejects an empty query", async () => {
    await expect(client(async () => "").search("  ")).rejects.toThrow(/non-empty/);
  });

  it("retries transient failures then succeeds", async () => {
    let n = 0;
    const impl = async () => {
      n += 1;
      if (n < 3) throw new Error("boom");
      return fx("search-ziyech.html");
    };
    const results = await client(impl).search("Ziyech");
    expect(n).toBe(3);
    expect(results.length).toBeGreaterThan(0);
  });

  it("throws a helpful error after exhausting retries", async () => {
    const impl = async () => {
      throw new Error("network down");
    };
    await expect(client(impl).search("Ziyech")).rejects.toThrow(/failed after 3 attempts/);
  });
});
