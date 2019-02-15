import test from "ava";
import fs from "fs";
import _ from "lodash";
import { Convert, LoadStructure } from "./src";

const tests = [
  {
    url: "http://414317.rlsplatform.com/patbishop/",
    target: ".rl-custompage",
    dir: "./test-files/test-001"
  }
];

const cleanContent = nodes => {
  return _.map(nodes, node =>
    _.omit(
      _.assign({}, node, {
        content: cleanContent(node.content || []),
        attrs: node.type === "Text" ? _.omit(node.attrs, ["value"]) : node.attrs
      }),
      ["id"]
    )
  );
};

async function performTest({ url, target, dir }, t) {
  const structure = await LoadStructure({
    url,
    target,
    cache: `${dir}/structure.json`,
    customJsCommands: [
      '$("#rls1a > div.modal-backdrop.fade.in, .rl-apology").remove()',
      '$("body").removeClass("modal-open")'
    ]
  });

  // Pre Process the data
  const editorConfig = await Convert(structure);
  if (!fs.existsSync(`${dir}/editor-config.json`)) {
    fs.writeFileSync(
      `${dir}/editor-config.json`,
      JSON.stringify(editorConfig, null, 2)
    );
    return t.fail();
  }

  const baseConfig = cleanContent(
    JSON.parse(
      fs.readFileSync(`${dir}/editor-config.json`, {
        encoding: "UTF-8"
      })
    )
  );
  t.deepEqual(baseConfig, cleanContent(editorConfig));
}

tests.map(item => {
  test(item.dir, t => {
    return performTest(item, t);
  });
});
