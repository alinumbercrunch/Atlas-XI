const { fetchWithHeaders } = require("../../lib/fetchWithHeaders");
const { parseSearch, parseProfile } = require("./parse");

const BASE = "https://www.transfermarkt.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polite, resilient Transfermarkt client: throttles requests, retries transient
// failures with backoff, and returns parsed data. The HTTP layer is injectable
// (opts.fetchImpl) so it can be unit-tested against fixtures without live network.
class TransfermarktClient {
  constructor(opts = {}) {
    this.base = opts.base || BASE;
    this.delay = opts.delay ?? 1200; // ms between requests (be polite)
    this.jitter = opts.jitter ?? Math.round(this.delay * 0.5); // random extra wait, 0..jitter
    this.retries = opts.retries ?? 3;
    this.backoff = opts.backoff ?? 800; // ms, multiplied by attempt number
    this.timeout = opts.timeout ?? 20000; // ms per request
    this.fetchImpl = opts.fetchImpl || fetchWithHeaders;
    this._nextAt = 0; // earliest timestamp the next request may start
  }

  // Space out requests by `delay`, correctly serializing concurrent callers.
  _throttle() {
    const now = Date.now();
    const jitter = this.jitter ? Math.floor(Math.random() * this.jitter) : 0;
    const wait = Math.max(0, this._nextAt - now) + jitter;
    this._nextAt = Math.max(now, this._nextAt) + this.delay + jitter;
    return wait > 0 ? sleep(wait) : Promise.resolve();
  }

  async _get(url) {
    await this._throttle();
    let lastErr;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const signal = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
        return await this.fetchImpl(url, { signal });
      } catch (err) {
        lastErr = err;
        if (attempt < this.retries) await sleep(this.backoff * attempt);
      }
    }
    throw new Error(
      `Transfermarkt GET failed after ${this.retries} attempts: ${url}\n${lastErr?.message}`,
    );
  }

  // Quick-search by name -> array of { name, slug, tmId, href }.
  async search(query) {
    if (!query || !String(query).trim()) {
      throw new Error("search requires a non-empty query");
    }
    const url = `${this.base}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`;
    return parseSearch(await this._get(url));
  }

  // Fetch + parse a player profile. slug is cosmetic in the URL; tmId is required.
  async fetchProfile(slug, tmId) {
    if (!tmId) throw new Error("fetchProfile requires a tmId");
    const url = `${this.base}/${slug || "player"}/profil/spieler/${tmId}`;
    const profile = parseProfile(await this._get(url));
    return { ...profile, tmId: String(tmId), slug: slug || null };
  }

  // Fetch one page of the "most valuable players" list for a nationality (raw HTML).
  async listMostValuable(landId, page = 1) {
    if (!landId) throw new Error("listMostValuable requires a landId");
    const url = `${this.base}/spieler-statistik/wertvollstespieler/marktwertetop?land_id=${landId}&page=${page}`;
    return this._get(url);
  }

  // Convenience: search by name and enrich the top result. Returns null if none.
  async findPlayer(name) {
    const results = await this.search(name);
    if (!results.length) return null;
    const top = results[0];
    return this.fetchProfile(top.slug, top.tmId);
  }
}

module.exports = { TransfermarktClient, BASE };
