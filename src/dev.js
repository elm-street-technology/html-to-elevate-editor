const fs = require("fs");
const _ = require("lodash");
const exportHtml = require("elevate-editor/dist/utils/export").default;
const axios = require("axios");
const cheerio = require("cheerio");
var express = require("express");
const { Components } = require("elevate-editor");
const { Convert, LoadStructure } = require("./");

var app = express();

// respond with "hello world" when a GET request is made to the homepage
app.get("/:site", async function(req, res) {
  const content = await axios.get(
    `https://admin.rlsplatform.com/etl/default/custompage?url=${
      req.params.site
    }&secret=elevate`
  );
  const $base = cheerio.load(content.data, {
    normalizeWhitespace: true,
    xmlMode: true
  });
  const items = $base("div.row");
  const links = [];
  for (i = 0; i < items.length; i++) {
    const page = items
      .children()
      .eq(i)
      .text()
      .replace("Page Name:", "")
      .trim();
    links.push(
      `<a href="http://localhost:3030/${
        req.params.site
      }/${page}" target="_blank">${page}</a>`
    );
  }
  res.send(links.join("<br />"));
});
app.get("/:site/:page", async function(req, res) {
  const { config, structure, preview } = await process({
    site: req.params.site,
    page: req.params.page
  });
  res.send(preview);
});
app.listen(3030);

async function process({ site, page }) {
  // get the data structure
  const structure = await LoadStructure({
    url: `https://admin.rlsplatform.com/etl/default/custompage?url=${site}&secret=elevate&page=${page}`,
    target: ".rl-custompage",
    // cache: `${dir}/structure.json`,
    cache: `./out/${site}-${page}-structure.json`,
    // headless: false,
    customJsCommands: [
      '$("#rls1a > div.modal-backdrop.fade.in, .rl-apology").remove()',
      '$("body").removeClass("modal-open")'
    ]
  });

  // Pre Process the data
  const EditorConfig = await Convert(structure);

  // convert to editor format
  // const editorConfig = await EditorFormat(cleaned);
  fs.writeFileSync(
    `./out/editor-config.json`,
    JSON.stringify(EditorConfig, null, 2)
  );
  return {
    preview: await exportHtml({
      content: EditorConfig,
      components: _.values(Components)
    }),
    config: EditorConfig,
    structure
  };
}
