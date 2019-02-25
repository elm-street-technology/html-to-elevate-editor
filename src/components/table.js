const _ = require("lodash");
const { buildContainer } = require("./div");

function calculateWidth(node, parent) {
  const pWidth = parent.widths.inner;
  const nWidth = node.widths.container;
  return `${(nWidth / pWidth) * 100}%`;
}

function processTable(node, content = [], parent, maxWidth) {
  return buildContainer(content, {
    width: calculateWidth(node, parent),
    direction: "horizontal",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    allowChildren: false
  });
}

function processTableCell(node, content = [], parent, maxWidth) {
  return buildContainer(content, {
    width: calculateWidth(node, parent),
    direction: "vertical",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    allowChildren: false
  });
}

function processTableRow(node, content = [], parent, maxWidth) {
  return buildContainer(content, {
    width: calculateWidth(node, parent),
    direction: "horizontal",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    allowChildren: false
  });
}
module.exports = {
  processTable,
  processTableRow,
  processTableCell
};
