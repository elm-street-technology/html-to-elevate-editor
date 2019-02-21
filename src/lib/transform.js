const utils = require("./utils");
const _ = require("lodash");

function getNodeStyles(node) {
  return _.reduce(
    node.styles,
    (out, value, attr) => {
      return `${out} ${attr}: ${value};`.trim();
    },
    ""
  );
}

function inlineStyles(nodes) {
  const allNodes = _.values(utils.getTreeNodes(nodes));
  let node;
  while ((node = allNodes.shift())) {
    // reset node
    node = utils.getNodeById(nodes, node.id);
    if (_.isEmpty(node.innerHTML)) {
      continue;
    }
    const style = getNodeStyles(node);
    const attrs = _.assign({}, node.attrs, {
      style: style.replace(/"/g, '\\"')
    });
    const inlineAttrs = _.reduce(
      attrs,
      (out, value, attr) => {
        return `${out} ${attr}="${value}"`;
      },
      ""
    );
    const replace = `${node.nodeName.toLowerCase()}${inlineAttrs}`;

    const newNode = _.assign({}, node, {
      outerHTML: node.outerHTML.replace(/^(<)([^>].*?)(\/?>)/, `$1${replace}$3`)
    });
    nodes = utils.updateTree(nodes, newNode, node.outerHTML, newNode.outerHTML);
  }
  return nodes;
}

function wrapGeneralStyles(nodes) {
  const allTextNodes = _.filter(_.values(utils.getTreeNodes(nodes)), {
    isComponent: false
  });
  let node;
  while ((node = allTextNodes.shift())) {
    // reset node
    node = utils.getNodeById(nodes, node.id);
    const tags = [];
    if (_.isEmpty(node.innerHTML) || !node.isComponent) {
      continue;
    }
    if (
      ["center", "right", "left"].includes(
        (node.camStyles.textAlign || "").toLowerCase()
      )
    ) {
      tags.push([
        `<span style="text-align:${node.camStyles.textAlign};">`,
        "</span>"
      ]);
    }
    if (tags.length) {
      const newInner = _.reduce(
        tags,
        (out, tag) => {
          return `${tag[0]}${out}${tag[1]}`;
        },
        node.innerHTML
      );
      const newNode = _.assign({}, node, {
        innerHTML: newInner,
        outerHTML: node.outerHTML.replace(node.innerHTML, newInner)
      });
      nodes = utils.updateTree(
        nodes,
        newNode,
        node.outerHTML,
        newNode.outerHTML
      );
    }
  }
  return nodes;
}

module.exports = nodes => {
  return inlineStyles(wrapGeneralStyles(nodes));
};
