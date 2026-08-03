const { chromium } = require("playwright");

const API = "https://api.sofascore.com/api/v1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SofaScore is Cloudflare-protected: plain fetch/axios => 403. The working access
// is to drive headless Chromium straight at the JSON API and read the body. One
// browser context is reused across calls; requests are throttled to stay polite.
class SofascoreClient {
  constructor(opts = {}) {
    this.base = opts.base || API;
    this.delay = opts.delay ?? 700;
    this.timeout = opts.timeout ?? 30000;
    this._browser = null;
    this._page = null;
    this._nextAt = 0;
  }

  async open() {
    if (this._browser) return;
    this._browser = await chromium.launch({ headless: true });
    const context = await this._browser.newContext({ userAgent: UA, locale: "en-US" });
    this._page = await context.newPage();
  }

  async close() {
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
      this._page = null;
    }
  }

  _throttle() {
    const now = Date.now();
    const wait = Math.max(0, this._nextAt - now);
    this._nextAt = Math.max(now, this._nextAt) + this.delay;
    return wait > 0 ? sleep(wait) : Promise.resolve();
  }

  // GET a JSON API path. Returns parsed JSON. A 404 (e.g. player didn't feature in
  // a match) resolves to its error body; 403/5xx throw loudly (Cloudflare / outage).
  async getJson(path) {
    await this.open();
    await this._throttle();
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const resp = await this._page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.timeout,
    });
    const status = resp?.status();
    const body = await this._page.evaluate(() => document.body.innerText);
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {
      /* non-JSON body */
    }
    if (status === 403 || status >= 500) {
      throw new Error(`SofaScore ${status} for ${url} (Cloudflare or outage?)`);
    }
    return json;
  }

  searchAll(query) {
    return this.getJson(`/search/all?q=${encodeURIComponent(query)}`);
  }

  playerEvents(playerId, page = 0) {
    return this.getJson(`/player/${playerId}/events/last/${page}`);
  }

  matchStats(eventId, playerId) {
    return this.getJson(`/event/${eventId}/player/${playerId}/statistics`);
  }

  // Fetch a binary asset (e.g. a player photo) as a Buffer; null on 404.
  async getImageBytes(path) {
    await this.open();
    await this._throttle();
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const resp = await this._page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.timeout,
    });
    const status = resp?.status();
    if (status === 403 || status >= 500) throw new Error(`SofaScore ${status} for ${url}`);
    if (status === 404) return null;
    return resp.body();
  }

  playerImage(id) {
    return this.getImageBytes(`/player/${id}/image`);
  }

  // Tournaments + seasons a player has statistics for.
  playerSeasons(id) {
    return this.getJson(`/player/${id}/statistics/seasons`);
  }

  // Aggregate stats for a player in one tournament + season (incl. average rating).
  playerSeasonOverall(id, utId, seasonId) {
    return this.getJson(
      `/player/${id}/unique-tournament/${utId}/season/${seasonId}/statistics/overall`,
    );
  }
}

module.exports = { SofascoreClient, API };
