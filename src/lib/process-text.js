const _ = require("lodash");
const cheerio = require("cheerio");
const { COMPONENT_NODE_NAMES } = require("../constants");
const utils = require("./utils");

function cleanTextNodes(nodes) {
  let treeValues = _.keys(utils.getTreeNodes(nodes));
  while ((path = treeValues.shift())) {
    const node = utils.getPath(nodes, path.split("."));
    if (node) {
      const hasText = utils.hasText(node);
      const hasComponents = utils.hasComponents(node);
      const isContainer = ["DIV"].includes(node.nodeName);
      const parent = utils.getParentNode(nodes, node);

      // Convert Components To Text
      if (parent && node.isComponent && !hasComponents && isContainer) {
        if (hasText) {
          const outer = node.outerHTML
            .replace(node.innerHTML, "{-- inner --}")
            .replace(/<(\/)?(div)/g, "<$1p")
            .replace("{-- inner --}", node.innerHTML);
          const newNode = _.assign({}, node, {
            isComponent: false,
            outerHTML: outer,
            nodeName: "P"
          });
          nodes = utils.updateTree(
            nodes,
            newNode,
            node.outerHTML,
            newNode.outerHTML
          );
        } else {
          // convert div spacers to p spacers
          const newNode = _.assign({}, node, {
            isComponent: false,
            innerHTML: "",
            outerHTML: "<br />",
            nodeName: "BR",
            children: []
          });
          nodes = utils.updateTree(
            nodes,
            newNode,
            node.outerHTML,
            newNode.outerHTML
          );
        }
      }
    }
  }
  return nodes;
}

module.exports = {
  cleanTextNodes
};
