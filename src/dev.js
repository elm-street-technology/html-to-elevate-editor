const fs = require("fs");
const _ = require("lodash");
const exportHtml = require("elevate-editor/dist/utils/export").default;

const uri = "415554.rlsplatform.com";
const page = "chinese-speaking-florida-agent";
const preview = `${uri}-${page}-preview.html`;
const example = {
  url: `https://admin.rlsplatform.com/etl/default/custompage?url=${uri}&secret=elevate&page=${page}`,
  target: ".rl-custompage",
  dir: "./test-files/test-003"
};
const { Components } = require("elevate-editor");
const { Convert, LoadStructure } = require("./");
console.log(
  `https://admin.rlsplatform.com/etl/default/custompage?url=${uri}&secret=elevate`
);
console.log(
  `file:///Users/timothydedecker/projects/html-to-elevate-editor/out/${preview}`
);

console.log("arguments", process.argv);
console.log(example.url);
const cache = `${uri}-${page}`;
async function process({ url, target, dir }) {
  // get the data structure
  const structure = await LoadStructure({
    url,
    target,
    // cache: `${dir}/structure.json`,
    cache: `./out/${cache}-structure.json`,
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
  (async () => {
    fs.writeFileSync(
      `./out/${preview}`,
      await exportHtml({
        content: EditorConfig,
        components: _.values(Components)
      })
    );
  })();
}

process(example);
