const _ = require("lodash");
const uuidV4 = require("uuid/v4");
const { buildContainer } = require("./div");

function buildColumn(content, attrs = {}) {
  return {
    id: uuidV4(),
    type: "Row",
    attrs,
    content: content || []
  };
}

function processColumn(node, content = [], parent, maxWidth) {
  return buildColumn(content, {
    width: `${(node.width / parent.width) * 100}%`,
    direction: "verticle",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    allowChildren: true
  });
}

module.exports = {
  processColumn
};
