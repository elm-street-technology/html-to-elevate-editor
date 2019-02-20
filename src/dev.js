const fs = require("fs");
const _ = require("lodash");
const exportHtml = require("elevate-editor/dist/utils/export").default;
const axios = require("axios");
const cheerio = require("cheerio");
var express = require("express");
const { Components } = require("elevate-editor");
const { Convert, LoadStructure } = require("./");
const Tests = require("../test-files/test-config");
var app = express();

app.get("/tests", async function(req, res) {
  res.send(
    Tests.map(
      ({ site, page }) =>
        `<a href="http://localhost:3030/${site}/${page}" target="_blank">Preview</a> | <a href="https://admin.rlsplatform.com/etl/default/custompage?url=${site}&secret=elevate&page=${page}" target="_blank">${page}</a>`
    ).join("<br />")
  );
});

app.get("/:site", async function(req, res) {
  const site = req.params.site;
  try {
    const content = await axios.get(
      `https://admin.rlsplatform.com/etl/default/custompage?url=${site}&secret=elevate`
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
        `<a href="http://localhost:3030/${site}/${page}" target="_blank">Preview</a> | <a href="https://admin.rlsplatform.com/etl/default/custompage?url=${site}&secret=elevate&page=${page}" target="_blank">${page}</a>`
      );
    }
    res.send(links.join("<br />"));
  } catch (e) {
    res.sendStatus(500);
  }
});
app.get("/:site/:page/:type?", async function(req, res) {
  try {
    const { config, structure, preview } = await process({
      site: req.params.site,
      page: req.params.page
    });
    switch (req.params.type) {
      case "structure":
        return res.send(structure);
      case "config":
        return res.send(config);
      default:
        return res.send(preview);
    }
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});
app.listen(3030);

async function process({ site, page }) {
  // get the data structure
  const structure = await LoadStructure({
    url: `https://admin.rlsplatform.com/etl/default/custompage?url=${site}&secret=elevate&page=${page}`,
    target: ".rl-custompage",
    // cache: `${dir}/structure.json`,
    // headless: false,
    cache: `./out/${site}-${page}-structure.json`
    // customJsCommands: [
    //   '$("#rls1a > div.modal-backdrop.fade.in, .rl-apology").remove()',
    //   '$("body").removeClass("modal-open")'
    // ]
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
