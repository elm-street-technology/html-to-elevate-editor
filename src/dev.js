const fs = require("fs");
const _ = require("lodash");
const exportHtml = require("elevate-editor/dist/utils/export").default;
const example = {
  url:
    "https://admin.rlsplatform.com/etl/default/custompage?url=bluewaterpi.com&secret=elevate&page=bob-davis",
  target: ".rl-custompage",
  dir: "./test-files/test-002"
};
const { Components } = require("elevate-editor");
const { Convert, LoadStructure } = require("./");

async function process({ url, target, dir }) {
  // get the data structure
  const structure = await LoadStructure({
    url,
    target,
    cache: `${dir}/structure.json`,
    headless: false,
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
    `${dir}/editor-config.json`,
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
