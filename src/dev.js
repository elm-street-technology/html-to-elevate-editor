const fs = require("fs");
const _ = require("lodash");
const exportHtml = require("elevate-editor/dist/utils/export").default;
const example = require("../examples/pat.json");
const { Components } = require("elevate-editor");
const { Convert, LoadStructure } = require("./");

async function process(data) {
  const { url, html } = data;
  // get the data structure
  const structure = await LoadStructure({
    url,
    // html,
    target: ".rl-custompage",
    cache: `./out/${_.snakeCase(url)}-v2.json`,
    // headless: true,
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
    "./out/editorConfig.json",
    JSON.stringify(EditorConfig, null, 2)
  );
  (async () => {
    fs.writeFileSync(
      "./out/preview.html",
      await exportHtml({
        content: EditorConfig,
        components: _.values(Components)
      })
    );
  })();
}

process(example);
