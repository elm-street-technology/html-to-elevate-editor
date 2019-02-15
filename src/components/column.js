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

function processColumn(node, content = [], parent, maxWidth) {
  let myMax = getMaxWidth(node.children);
  if (myMax === 0) {
    const otherColumns = parent.children
      .filter(c => c.id !== node.id)
      .map(n => getMaxWidth(n.children));
    const remaining = _.filter(otherColumns, v => v === 0).length;
    const total = _.sum(otherColumns);
    const availWidth = maxWidth - total;
    myMax = remaining > 0 ? availWidth / remaining : availWidth;
  }
  const width = myMax > 0 ? `${(myMax / maxWidth) * 100}%` : "auto";
  return buildColumn(content, {
    width: width,
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
