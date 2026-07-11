const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
};

async function fetchWithHeaders(url, options = {}) {
  const { returnJson, headers: optHeaders, ...rawFetchOptions } = options;

  const response = await fetch(url, {
    ...rawFetchOptions,
    headers: {
      ...DEFAULT_HEADERS,
      ...(optHeaders || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Request failed (${response.status} ${response.statusText}) for ${url}\n${body.slice(0, 300)}`,
    );
  }

  if (returnJson) {
    return response.json();
  }

  return response.text();
}

module.exports = {
  fetchWithHeaders,
  DEFAULT_HEADERS,
};
