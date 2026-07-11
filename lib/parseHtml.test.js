import { parseHtml } from "./parseHtml.js";

describe("parseHtml", () => {
  it("loads HTML and exposes a cheerio query function", () => {
    const $ = parseHtml("<html><head><title>Atlas XI</title></head><body></body></html>");
    expect(typeof $).toBe("function");
    expect($("title").text()).toBe("Atlas XI");
  });

  it("handles empty input without throwing", () => {
    const $ = parseHtml("");
    expect($("title").text()).toBe("");
  });
});
