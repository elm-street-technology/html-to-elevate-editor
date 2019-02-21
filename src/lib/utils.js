const _ = require("lodash");
const cheerio = require("cheerio");

function toCamelCase(payload) {
  if (Array.isArray(payload)) {
    return _.map(payload, item => {
      return _.mapKeys(item, (value, key) => {
        return _.camelCase(key);
      });
    });
  }

  return _.mapKeys(payload, (value, key) => {
    return _.camelCase(key);
  });
}

function toSelector(path) {
  let pathString = `[${path[0]}]`;
  const add = _.map(path.slice(1), d => `children[${d}]`).join(".");
  if (!_.isEmpty(add)) {
    pathString += `.${add}`;
  }
  return pathString;
}

function getPath(nodes, path) {
  return _.get(nodes, toSelector(path));
}

function findPath(nodes, id) {
  const tree = getTreePath(nodes);
  return tree[id];
}

function getParentNode(nodes, node) {
  const path = findPath(nodes, node.id);
  return getPath(nodes, path.split(".").slice(0, -1));
}

function getNodeById(nodes, id) {
  const path = findPath(nodes, id);
  return getPath(nodes, path.split("."));
}

function makePath(path, index) {
  return _.compact(_.flatten([path, index.toString()]));
}

function updatePath(nodes, path, update = {}) {
  const node = getPath(nodes, path);
  const select = toSelector(path);
  _.set(nodes, select, _.assign({}, node, update));
  return nodes;
}

function updateTree(structure, node, search, replace) {
  const path = findPath(structure, node.id);
  const parentPath = path.split(".");

  structure = updatePath(structure, path.split("."), node);

  while (parentPath.length) {
    parentPath.pop();
    const parent = getPath(structure, parentPath);

    if (parent) {
      const innerHTML = parent.innerHTML.replace(search, replace);
      const outerHTML = parent.outerHTML.replace(search, replace);
      search = parent.outerHTML;
      replace = outerHTML;
      structure = updatePath(structure, parentPath, {
        innerHTML,
        outerHTML
      });
    }
  }

  return structure;
}

function removeNode(nodes, node) {
  const parent = getParentNode(nodes, node);
  const newParent = _.assign({}, parent, {
    innerHTML: parent.innerHTML.replace(node.outerHTML, ""),
    outerHTML: parent.outerHTML.replace(node.outerHTML, ""),
    children: _.filter(parent.children, ({ id }) => id !== node.id)
  });
  return updateTree(nodes, newParent, parent.outerHTML, newParent.outerHTML);
}

function getTreePath(nodes, path) {
  const tree = getTreeNodes(nodes);
  return _.transform(
    tree,
    (out, v, k) => {
      out[v.id] = k;
    },
    {}
  );
}

function getTreeNodes(nodes, path = [], tree = {}) {
  return _.reduce(
    nodes,
    (_tree, node, index) => {
      const nodePath = makePath(path, index);
      _tree[nodePath.join(".")] = node;
      if (node.children && node.children.length) {
        return getTreeNodes(node.children, nodePath, _tree);
      }
      return _tree;
    },
    tree
  );
}

function hasComponents(node) {
  const allNodes = Object.values(getTreeNodes(node.children));
  return _.some(allNodes, { isComponent: true });
}

function nodeHasText(node) {
  const childIsText = _.some(
    _.filter(node.children, { isComponent: false }),
    ({ outerHTML }) => hasText(outerHTML)
  );

  const html = _.reduce(
    node.children,
    (out, child) => {
      return out.replace(child.outerHTML, "");
    },
    node.innerHTML
  );
  return childIsText || hasText(`<div>${html}</div>`);
}

function hasText(nodeHTML) {
  const html = _.isObject(nodeHTML) ? nodeHTML.outerHTML : nodeHTML;
  const $base = cheerio.load(html, {
    normalizeWhitespace: true,
    xmlMode: true
  });
  return !_.isEmpty(
    $base
      .root()
      .text()
      .replace(/&nbsp;/g, "")
      .trim()
  );
}

module.exports = {
  toCamelCase,
  toSelector,
  getPath,
  getNodeById,
  findPath,
  makePath,
  updatePath,
  removeNode,
  updateTree,
  getParentNode,
  getTreePath,
  getTreeNodes,
  hasText,
  nodeHasText,
  hasComponents
};
