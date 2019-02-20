import test from "ava";
import fs from "fs";
import _ from "lodash";
import { Convert, LoadStructure } from "./src";

import tests from "./test-files/test-config";

const cleanText = text => {
  return _.assign({}, text, {
    blocks: _.map(text.blocks, data => {
      return _.omit(data, ["key"]);
    })
  });
};

const cleanContent = nodes => {
  return _.map(nodes, node =>
    _.omit(
      _.assign({}, node, {
        content: cleanContent(node.content || []),
        attrs:
          node.type === "Text"
            ? _.assign({}, node.attrs, {
                value: cleanText(node.attrs.value)
              })
            : node.attrs
      }),
      ["id"]
    )
  );
};

async function performTest({ site, page, target, dir }, t) {
  const structure = await LoadStructure({
    url: `https://admin.rlsplatform.com/etl/default/custompage?url=${site}&secret=elevate&page=${page}`,
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
  test(`${item.dir} - ${item.site} - ${item.page}`, t => {
    return performTest(item, t);
  });
});
