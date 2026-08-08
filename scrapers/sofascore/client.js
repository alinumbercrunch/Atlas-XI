const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const API = "https://api.sofascore.com/api/v1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SESSION_PATH = path.join(__dirname, "..", "..", "data", "sofa-session.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SofaScore is Cloudflare-protected: plain fetch/axios => 403. The working access
// is to drive headless Chromium straight at the JSON API and read the body. One
// browser context is reused across calls. To stay under the radar we: throttle with
// random jitter, persist the browser session (cookies) between runs so we reuse one
// Cloudflare clearance, and back off hard on 429 (rate limit).
class SofascoreClient {
  constructor(opts = {}) {
    this.base = opts.base || API;
    this.delay = opts.delay ?? 700;
    this.jitter = opts.jitter ?? Math.round(this.delay * 0.5); // random extra wait, 0..jitter
    this.timeout = opts.timeout ?? 30000;
    this.retries = opts.retries ?? 3;
    this.backoff = opts.backoff ?? 1500; // ms, × attempt, for transient errors
    this.cooldown = opts.cooldown ?? 20000; // ms, longer pause when rate-limited (429)
    this.sessionPath = opts.sessionPath === undefined ? SESSION_PATH : opts.sessionPath;
    this._browser = null;
    this._context = null;
    this._page = null;
    this._nextAt = 0;
  }

  async open() {
    if (this._browser) return;
    this._browser = await chromium.launch({ headless: true });
    const ctxOpts = { userAgent: UA, locale: "en-US" };
    if (this.sessionPath && fs.existsSync(this.sessionPath)) {
      ctxOpts.storageState = this.sessionPath; // reuse prior Cloudflare clearance
    }
    this._context = await this._browser.newContext(ctxOpts);
    this._page = await this._context.newPage();
  }

  async close() {
    if (!this._browser) return;
    try {
      if (this.sessionPath && this._context) {
        fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
        await this._context.storageState({ path: this.sessionPath });
      }
    } catch {
      /* best-effort session save */
    }
    await this._browser.close();
    this._browser = null;
    this._context = null;
    this._page = null;
  }

  _throttle() {
    const now = Date.now();
    const jitter = this.jitter ? Math.floor(Math.random() * this.jitter) : 0;
    const wait = Math.max(0, this._nextAt - now) + jitter;
    this._nextAt = Math.max(now, this._nextAt) + this.delay + jitter;
    return wait > 0 ? sleep(wait) : Promise.resolve();
  }

  // GET a JSON API path. Returns parsed JSON. A 404 (e.g. player didn't feature in
  // a match) resolves to its error body. Retries transient errors; on 429 waits a
  // long cooldown; gives up on persistent 403/5xx (Cloudflare / outage).
  async getJson(path) {
    await this.open();
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    let lastErr;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      await this._throttle();
      try {
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
        if (status === 429 || status === 403 || status >= 500) {
          lastErr = new Error(`SofaScore ${status} for ${url}`);
          if (attempt < this.retries) {
            await sleep(status === 429 ? this.cooldown : this.backoff * attempt);
            continue;
          }
          throw lastErr;
        }
        return json;
      } catch (err) {
        lastErr = err;
        if (attempt < this.retries) {
          await sleep(this.backoff * attempt);
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr;
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
