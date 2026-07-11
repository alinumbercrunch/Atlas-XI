const cheerio = require("cheerio");

function parseHtml(html) {
  return cheerio.load(html);
}

module.exports = {
  parseHtml,
};
