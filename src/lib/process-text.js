const _ = require("lodash");
const cheerio = require("cheerio");
const { COMPONENT_NODE_NAMES } = require("../constants");
const utils = require("./utils");

function updateTree(structure, node, search, replace) {
  const path = utils.findPath(structure, node.id);
  const parentPath = path.split(".");

  structure = utils.updatePath(structure, path.split("."), node);

  while (parentPath.length) {
    parentPath.pop();
    const parent = utils.getPath(structure, parentPath);

    if (parent) {
      const innerHTML = parent.innerHTML.replace(search, replace);
      const outerHTML = parent.outerHTML.replace(search, replace);
      search = parent.outerHTML;
      replace = outerHTML;
      structure = utils.updatePath(structure, parentPath, {
        innerHTML,
        outerHTML
      });
    }
  }

  return structure;
}

function cleanTextNodes(nodes) {
  let treeValues = _.keys(utils.getTreeNodes(nodes));
  while ((path = treeValues.shift())) {
    const node = utils.getPath(nodes, path.split("."));
    if (node) {
      const hasText = utils.hasText(node);
      const hasComponents = utils.hasComponents(node);
      const isContainer = ["DIV"].includes(node.nodeName);

      // remove uneeded nodes
      if (
        /h\d|blockquote/i.test(node.nodeName) &&
        /<(\/)?(p)[^>]*>/gi.test(node.innerHTML)
      ) {
        let innerHTML = node.innerHTML.replace(/<(\/)?(p)[^>]*>/gi, "");
        let outerHTML = node.outerHTML.replace(node.innerHTML, innerHTML);
        const newNode = _.assign({}, node, {
          innerHTML,
          outerHTML,
          children: node.children.filter(
            child => !["P"].includes(child.nodeName)
          )
        });
        nodes = updateTree(nodes, newNode, node.outerHTML, newNode.outerHTML);
      }

      // Convert Components To Text
      if (node.isComponent && !hasComponents && isContainer) {
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
          nodes = updateTree(nodes, newNode, node.outerHTML, newNode.outerHTML);
        } else {
          // convert div spacers to p spacers
          const newNode = _.assign({}, node, {
            isComponent: false,
            innerHTML: "",
            outerHTML: "<br />",
            nodeName: "BR"
          });
          nodes = updateTree(nodes, newNode, node.outerHTML, newNode.outerHTML);
        }
      }
    }
  }
  return nodes;
}

module.exports = {
  cleanTextNodes
};
