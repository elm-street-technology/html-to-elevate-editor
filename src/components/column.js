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

function getMaxWidth(nodes, w = 0) {
  return _.reduce(
    nodes,
    (_w, node) => {
      const width = _.get(node, "boundingClientRect.width", 0);
      _w = width > _w ? width : _w;
      return node.children && node.children.length
        ? getMaxWidth(node.children, _w)
        : _w;
    },
    w
  );
}

function calculateColumnWidths(columns, node, maxWidth) {
  let myMax = getMaxWidth(node.children);
  const columnW = _.sortBy(
    columns.map((n, index) => ({
      id: n.id,
      width: getMaxWidth(n.children)
    })),
    ["width"]
  );
  let remWidth = maxWidth;
  const columnWidths = _.map(columnW, ({ id, width }, index) => {
    if (remWidth < width) {
      width = remWidth;
    }
    remWidth = remWidth - width;
    return {
      id,
      width: `${(width / maxWidth) * 100}%`
    };
  });
  const zeroedValues = _.filter(columnWidths, { width: "0%" });
  if (zeroedValues.length && remWidth > 0) {
    const split = remWidth / zeroedValues.length;
    if (_.get(_.find(columnWidths, { id: node.id }), "width", "0%") === "0%") {
      return `${(split / maxWidth) * 100}%`;
    }
  }

  return _.get(_.find(columnWidths, { id: node.id }), "width", 0);
}

function processColumn(node, content = [], parent, maxWidth) {
  return buildColumn(content, {
    width: calculateColumnWidths(parent.children, node, maxWidth),
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
