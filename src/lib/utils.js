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

function makePath(path, index) {
  return _.compact(_.flatten([path, index.toString()]));
}

function updatePath(nodes, path, update = {}) {
  const node = getPath(nodes, path);
  const select = toSelector(path);
  _.set(nodes, select, _.assign({}, node, update));
  return nodes;
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
      .trim()
  );
}

module.exports = {
  toCamelCase,
  toSelector,
  getPath,
  findPath,
  makePath,
  updatePath,
  getTreePath,
  getTreeNodes,
  hasText,
  hasComponents
};
