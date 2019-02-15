const _ = require("lodash");
const { processDiv } = require("../components/div");
const { processImg } = require("../components/img");
const { processRow } = require("../components/row");
const { processColumn } = require("../components/column");
const { processText } = require("../components/text");

function toEditorConfig(nodes, parent, maxWidth = 0) {
  // get restructured tree
  return _.reduce(
    nodes,
    (out, node) => {
      if (!node) {
        return out;
      }
      const children = toEditorConfig(node.children, node, maxWidth);
      switch (node.nodeName.toLowerCase()) {
        case "row":
          out.push(processRow(node, children, parent, maxWidth));
          break;
        case "column":
          out.push(processColumn(node, children, parent, maxWidth));
          break;
        case "div":
          out.push(processDiv(node, children, parent, maxWidth));
          break;
        case "img":
          out.push(processImg(node, children, parent, maxWidth));
          break;
        case "text":
          out.push(processText(node, children, parent, maxWidth));
          break;
      }
      return out;
    },
    []
  );
}
module.exports = toEditorConfig;
