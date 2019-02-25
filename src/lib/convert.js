const _ = require("lodash");
const cheerio = require("cheerio");
const uuidV4 = require("uuid/v4");

const { COMPONENT_NODE_NAMES } = require("../constants");
const toEditorConfig = require("./editor-format");
const utils = require("./utils");
const ProcessText = require("./process-text");
const Transform = require("./transform");

function getStyleNumber(node, style) {
  let value = _.get(node, `styles['${style}']`, "0px").replace(/[^\d]/g, "");
  if (_.isEmpty(value)) {
    return 0;
  }
  return Number(value);
}

function calculateInnerWidth(node) {
  const width = _.get(node, "boundingClientRect.width", 0);
  const paddingRight = getStyleNumber(node, "padding-right");
  const paddingLeft = getStyleNumber(node, "padding-left");
  const marginRight = getStyleNumber(node, "margin-left");
  const marginLeft = getStyleNumber(node, "margin-left");
  return {
    inner: width - paddingRight - paddingLeft - marginLeft - marginRight,
    container: width - marginLeft - marginRight,
    outer: width
  };
}

function annonateData(data) {
  let index = 1;
  const loop = (structure, isParentComponent = true, extra = {}) => {
    if (_.isArray(structure)) {
      return _.map(structure, node => loop(node, isParentComponent, extra));
    }
    if (structure) {
      const isComponent = COMPONENT_NODE_NAMES.includes(structure.nodeName);

      const nextra = _.assign({}, extra, {
        alignment: getAlignment(structure, _.get(extra, "alignment", null))
      });
      if (structure.nodeName === "A") {
        nextra.url = structure.attrs.href;
      }

      return _.assign({}, structure, {
        id: index++,
        attrs: _.assign({}, structure.attrs || {}, nextra),
        camStyles: utils.toCamelCase(structure.styles),
        isComponent: isComponent,
        widths: calculateInnerWidth(structure),
        needsToShift: isComponent && !isParentComponent,
        children: structure.children.length
          ? loop(structure.children, isComponent, nextra)
          : []
      });
    }
  };
  return loop(data);
}

function shiftComponent(structure, node, components, index, search, replace) {
  const parent = utils.getParentNode(structure, node);
  const ids = _.map(components, "id");
  let children = parent.children;
  children.splice(index, 1, components);
  children = _.flatten(_.compact(children));
  const newParent = _.assign({}, parent, {
    children,
    innerHTML: parent.innerHTML.replace(search, replace),
    outerHTML: parent.outerHTML.replace(search, replace)
  });
  structure = utils.updateTree(
    structure,
    newParent,
    parent.outerHTML,
    newParent.outerHTML
  );
  return structure;
}

function shiftNodeInTree(nodes, node) {
  const parent = utils.getParentNode(nodes, node);
  if (!parent || parent.isComponent) {
    return nodes;
  }

  const components = [];
  const index = _.last(utils.findPath(nodes, parent.id).split("."));
  const split = parent.innerHTML.split(node.outerHTML);
  const first = split.shift();
  const last = split.join(node.outerHTML);

  if (_.isEmpty(first.trim())) {
    // move up
    const newParent = _.assign({}, parent, {
      children: parent.children.filter(({ id }) => id !== node.id),
      innerHTML: parent.innerHTML.replace(node.outerHTML, ""),
      outerHTML: parent.outerHTML.replace(node.outerHTML, "")
    });

    components.push(node);
    components.push(newParent);
  } else if (_.isEmpty(last.trim())) {
    // move down
    const newParent = _.assign({}, parent, {
      children: parent.children.filter(({ id }) => id !== node.id),
      innerHTML: parent.innerHTML.replace(node.outerHTML, ""),
      outerHTML: parent.outerHTML.replace(node.outerHTML, "")
    });

    components.push(newParent);
    components.push(node);
  } else {
    // shift between
    let childIndex = _.findIndex(parent.children, { id: node.id });
    const newParentTop = _.assign({}, parent, {
      children: parent.children.slice(0, childIndex),
      innerHTML: parent.innerHTML.replace(parent.innerHTML, first),
      outerHTML: parent.outerHTML.replace(parent.innerHTML, first)
    });
    const newParentBottom = _.assign({}, parent, {
      id: uuidV4(),
      children: parent.children.slice(childIndex + 1),
      innerHTML: parent.innerHTML.replace(parent.innerHTML, last),
      outerHTML: parent.outerHTML.replace(parent.innerHTML, last)
    });
    components.push(newParentTop);
    components.push(node);
    components.push(newParentBottom);
  }

  const search = parent.outerHTML;
  const replace = _.map(components, "outerHTML").join("\n");

  // move & restructure parent node
  nodes = shiftComponent(nodes, parent, components, index, search, replace);

  if (!parent.isComponent) {
    return shiftNodeInTree(nodes, utils.getNodeById(nodes, node.id));
  }
  return nodes;
}

function shiftAndFilterContent(structure) {
  let node;

  let tree = utils.getTreeNodes(structure);

  // find any comment and remove
  const commentRegex = /(?=<!--)([\s\S]*?)-->/g;
  const commentsToFilter = _.filter(Object.values(tree), ({ innerHTML }) =>
    commentRegex.test(innerHTML)
  );

  if (commentsToFilter.length) {
    while ((node = commentsToFilter.pop())) {
      if (commentRegex.test(node.innerHTML)) {
        const newNode = _.assign({}, node, {
          innerHTML: node.innerHTML.replace(commentRegex, ""),
          outerHTML: node.outerHTML.replace(commentRegex, "")
        });
        structure = utils.updateTree(
          structure,
          newNode,
          node.outerHTML,
          newNode.outerHTML
        );
      }
    }
  }

  // rebuild tree for next pass
  tree = utils.getTreeNodes(structure);

  // removed any unsupported nodes
  const nodesToRemove = _.filter(Object.values(tree), ({ nodeName }) =>
    ["SCRIPT", "STYLE"].includes(nodeName)
  );
  if (nodesToRemove.length) {
    while ((node = nodesToRemove.shift())) {
      structure = utils.removeNode(structure, node);
    }
  }

  // rebuild tree for next pass
  tree = utils.getTreeNodes(structure);

  // shift nodes up the tree
  const nodesToShift = _.filter(Object.values(tree), "needsToShift");
  if (nodesToShift.length) {
    while ((node = nodesToShift.shift())) {
      structure = shiftNodeInTree(structure, node);
    }
  }
  return structure;
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
  if (utils.hasText(baseContent)) {
    children.push({
      nodeName: "TEXT",
      text: baseContent
    });
  }
  // push left over text;
  return children;
}

function getAlignment(node, lastAlignment = null) {
  const align = _.get(node, "styles['text-align']", "").toLowerCase();
  if (["left", "right", "center"].includes(align)) {
    return align;
  }

  return lastAlignment;
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
  let parentGrid;
  if ((parentGrid = getParentGrid(node))) {
    const rows = _.transform(
      parentGrid,
      (_rows, row) => {
        _rows.push({
          id: uuidV4(),
          nodeName: "ROW",
          width: node.widths.inner,
          children: row.map(child => {
            return {
              id: uuidV4(),
              nodeName: "COLUMN",
              width: child.widths.inner,
              children: buildStructure([child])
            };
          })
        });
      },
      []
    );
    return _.assign({}, node, {
      children: rows
    });
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
        let elIndex = _.findIndex(elements, el => {
          return ["left", "right"].includes(getFloat(el));
        });
        elIndex = elIndex >= 0 ? elIndex : elements.length;
        const column = items.splice(0, elIndex);

        if (float === "left") {
          newChildren.push({
            id: uuidV4(),
            nodeName: "ROW",
            width: node.widths.inner,
            children: [
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                width: childNode.widths.outer,
                children: [childNode]
              },
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                width: node.widths.inner - childNode.widths.outer,
                children: column
              }
            ]
          });
        }
        if (float === "right") {
          newChildren.push({
            id: uuidV4(),
            nodeName: "ROW",
            width: node.widths.inner,
            children: [
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                width: node.widths.inner - childNode.widths.outer,
                children: column
              },
              {
                id: uuidV4(),
                nodeName: "COLUMN",
                width: childNode.widths.outer,
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

function getParentGrid(parent) {
  const components = _.filter(parent.children, { isComponent: true });
  if (components.length < parent.children.length) {
    return false;
  }
  if (components.length <= 1) {
    return false;
  }
  if (_.some(components, node => ["TD", "TR"].includes(node.nodeName))) {
    return false;
  }
  const rows = _.values(_.groupBy(components, "boundingClientRect.top"));
  if (_.some(rows, row => row.length > 1)) {
    return rows;
  }
  return false;
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
  const cleaned = ProcessText.cleanTextNodes(annotated);
  const formatted = shiftAndFilterContent(cleaned, cleaned);
  const transformed = Transform(formatted);
  const structured = buildStructure(transformed);
  const config = toEditorConfig(structured, null, getMaxWidth(structured));
  return config;
};
