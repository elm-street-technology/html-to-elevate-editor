const _ = require("lodash");
const uuidV4 = require("uuid/v4");
const { buildContainer } = require("./div");

function buildRow(content, attrs = {}) {
  return {
    id: uuidV4(),
    type: "Row",
    attrs,
    content: content || []
  };
}

function processRow(node, content = [], parent, maxWidth) {
  return buildRow(content, {
    width: "",
    direction: "horizontal",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    allowChildren: false
  });
}

module.exports = {
  processRow
};
