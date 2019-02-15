const _ = require("lodash");
const cheerio = require("cheerio");
const uuidV4 = require("uuid/v4");

const { COMPONENT_NODE_NAMES } = require("../constants");
const toEditorConfig = require("./editor-format");

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

function annonateData(data) {
  let index = 1;
  const loop = (structure, isParentComponent = true) => {
    if (_.isArray(structure)) {
      return _.map(structure, node => loop(node, isParentComponent));
    }
    if (structure) {
      const isComponent = COMPONENT_NODE_NAMES.includes(structure.nodeName);
      return _.assign({}, structure, {
        id: index++,
        camStyles: toCamelCase(structure.styles),
        isComponent: isComponent,
        needsToShift: isComponent && !isParentComponent,
        children: structure.children.length
          ? loop(structure.children, isComponent)
          : []
      });
    }
  };
  return loop(data);
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

function shiftNodeInTree(structure, node) {
  const path = findPath(structure, node.id);
  const parentPath = path.split(".");
  let search = node.outerHTML;
  let replace = "";
  let components = [node];
  let lastIndex = _.last(parentPath);
  while (parentPath.length) {
    parentPath.pop();
    const parent = getPath(structure, parentPath);
    if (parent) {
      const innerHtml = parent.innerHTML;
      const split = innerHtml.split(search);
      const first = split.shift();
      const last = split.join(search);
      const pSearch = parent.outerHTML;
      const pOuter = pSearch.replace(search, replace);
      const pInner = pSearch.replace(search, replace);
      let children = parent.children;

      // add components to parent
      components = _.reduce(
        components,
        (out, child, index) => {
          if (child.isComponent && parent.isComponent) {
            // Add Componet type if parent is component
            children.splice(lastIndex, 0, child);
          } else if (!child.isComponent) {
            // add non componet types
            children.splice(lastIndex, 0, child);
          } else {
            // save for next shift
            out.push(child);
          }
          return out;
        },
        []
      );

      const nodeIds = _.map(components, "id");

      if (!parent.isComponent) {
        if (_.isEmpty(first.trim())) {
          // move up
          replace = _.filter(
            _.compact([_.isEmpty(replace) ? node.outerHTML : replace, pOuter]),
            a => !_.isEmpty(a)
          ).join("\n");
          search = pSearch;
          lastIndex = _.last(parentPath);
        } else if (_.isEmpty(last.trim())) {
          // move down
          replace = _.filter(
            _.compact([pOuter, _.isEmpty(replace) ? node.outerHTML : replace]),
            a => !_.isEmpty(a)
          ).join("\n");
          search = pSearch;
          lastIndex = _.last(parentPath) + 1;
        } else {
          lastIndex = _.last(parentPath) + 1;
          // split element into two
          // TODO: split parent into two
        }
      }
      structure = updatePath(structure, parentPath, {
        innerHTML: pInner,
        outerHTML: pOuter,
        children: _.filter(children, ({ id }) => !nodeIds.includes(id))
      });
    }
  }

  return structure;
}

function cleanTextNodes(structure, node, remove) {
  const path = findPath(structure, node.id);
  const parentPath = path.split(".");
  let search = node.outerHTML;
  let inner = node.innerHTML.replace(remove, "");
  let replace = node.outerHTML.replace(node.innerHTML, inner);
  structure = updatePath(structure, path.split("."), {
    innerHTML: inner,
    outerHTML: replace
  });

  while (parentPath.length) {
    parentPath.pop();
    const parent = getPath(structure, parentPath);
    if (parent) {
      structure = updatePath(structure, parentPath, {
        innerHTML: parent.innerHTML.replace(search, replace),
        outerHTML: parent.outerHTML.replace(search, replace)
      });
    }
  }

  return structure;
}

function shiftAndFilterContent(structure) {
  const tree = getTreeNodes(structure);
  const nodesToShift = _.filter(Object.values(tree), "needsToShift");
  const nodesToClean = _.filter(Object.values(tree), { isComponent: false });
  let node;
  if (nodesToShift.length) {
    while ((node = nodesToShift.shift())) {
      structure = shiftNodeInTree(structure, node);
    }
  }
  if (nodesToClean.length) {
    while ((node = nodesToClean.shift())) {
      // remove elements from node types
      if (node && /h\d|blockquote/i.test(node.nodeName)) {
        structure = cleanTextNodes(structure, node, /<(\/)?(p)[^>]*>/gi);
      }
    }
  }

  return structure;
}

function hasText(html) {
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

function processNodeText(node, components) {
  const children = [];
  let baseContent = node.innerHTML || "";
  _.each(components, (child, index) => {
    const split = baseContent.split(child.outerHTML).map(a => a.trim());
    const firstContent = split.shift();
    baseContent = split.join(child.outerHTML);
    if (!_.isEmpty(firstContent)) {
      // push text then element
      children.push({
        nodeName: "TEXT",
        text: firstContent
      });
    }
    children.push(child);
  });
  if (hasText(baseContent)) {
    children.push({
      nodeName: "TEXT",
      text: baseContent
    });
  }
  // push left over text;
  return children;
}

function getFloat(node) {
  if (!node.isComponent) {
    return "none";
  }

  const styleFloat = _.get(node, "styles.float", "").toLowerCase();
  if (["left", "right"].includes(styleFloat)) {
    return styleFloat;
  }

  const attrFloat = _.get(node, "attrs.align", "").toLowerCase();
  if (["left", "right"].includes(attrFloat)) {
    return attrFloat;
  }
  return "none";
}

function buildStructure(node) {
  if (_.isArray(node)) {
    return _.compact(_.map(node, n => buildStructure(n)));
  }
  if (!node.isComponent) {
    return null;
  }

  let children = processNodeText(node, buildStructure(node.children));

  const floatItems = _.filter(
    children,
    n => n.isComponent && ["left", "right"].includes(getFloat(n))
  );

  if (floatItems.length) {
    const items = _.clone(children);
    const newChildren = [];
    while ((childNode = items.shift())) {
      const float = getFloat(childNode);
      const isFloated = ["left", "right"].includes(float);
      if (isFloated) {
        const elements = _.transform(
          items,
          (o, el) => {
            if (o.isComponent) {
              return false;
            }
            o.push(el);
          },
          []
        );
        const column = items.splice(0, elements.length);

        if (float === "left") {
          newChildren.push({
            id: uuidV4(),
            nodeName: "ROW",
            children: [
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                children: [childNode]
              },
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                children: column
              }
            ]
          });
        }
        if (float === "right") {
          newChildren.push({
            id: uuidV4(),
            nodeName: "ROW",
            children: [
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                children: column
              },
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                children: [childNode]
              }
            ]
          });
        }
      } else {
        newChildren.push(childNode);
      }
    }
    children = newChildren;
  }

  return _.assign({}, node, {
    children
  });
}

function getMaxWidth(nodes, width = 0) {
  return _.reduce(
    nodes,
    (w, node) => {
      const _w = _.get(node, "boundingClientRect.width", 0);
      return _w > w ? _w : w;
    },
    width
  );
}

module.exports = async structure => {
  const annotated = annonateData([structure], 1);
  const formatted = shiftAndFilterContent(annotated, annotated);
  const structured = buildStructure(formatted);
  const config = toEditorConfig(structured, null, getMaxWidth(structured));
  return config;
};
