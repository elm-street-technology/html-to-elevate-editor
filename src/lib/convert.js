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
  const isFloated = ["right", "left"].includes(getFloat(node));
  if (_.isEmpty(first.trim())) {
    // move up
    const newParent = _.assign({}, parent, {
      boundingClientRect: _.assign({}, parent.boundingClientRect, {
        top:
          parent.boundingClientRect.top +
          (isFloated ? 0 : node.boundingClientRect.height)
      }),
      children: parent.children.filter(({ id }) => id !== node.id),
      innerHTML: parent.innerHTML.replace(node.outerHTML, ""),
      outerHTML: parent.outerHTML.replace(node.outerHTML, "")
    });

    components.push(node);
    components.push(newParent);
  } else if (_.isEmpty(last.trim())) {
    // move down
    const newParent = _.assign({}, parent, {
      boundingClientRect: _.assign({}, parent.boundingClientRect, {
        bottom:
          parent.boundingClientRect.bottom -
          (isFloated ? 0 : node.boundingClientRect.height)
      }),
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
      boundingClientRect: _.assign({}, parent.boundingClientRect, {
        bottom: node.boundingClientRect.top
      }),
      children: parent.children.slice(0, childIndex),
      innerHTML: parent.innerHTML.replace(parent.innerHTML, first),
      outerHTML: parent.outerHTML.replace(parent.innerHTML, first)
    });
    const newParentBottom = _.assign({}, parent, {
      id: uuidV4(),
      boundingClientRect: _.assign({}, parent.boundingClientRect, {
        top: isFloated
          ? node.boundingClientRect.top
          : node.boundingClientRect.bottom
      }),
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
  const badImages = _.filter(
    Object.values(tree),
    ({ nodeName, attrs }) =>
      nodeName === "IMG" && /^$|^file:\/\//i.test(attrs.src)
  );
  if (badImages.length) {
    while ((node = badImages.shift())) {
      structure = utils.removeNode(structure, node);
    }
  }
  tree = utils.getTreeNodes(structure);

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

function getOverlappingElements(node, parent) {
  const p1 = node.boundingClientRect;
  return _.filter(parent.children, child => {
    if (child.id === node.id) {
      return false;
    }
    const p2 = child.boundingClientRect;
    if (!p2) {
      return false;
    }
    if (
      utils.isBetween(p2.top, p1.top, p1.bottom, false) ||
      utils.isBetween(p1.top, p2.top, p2.bottom, false) ||
      utils.isBetween(p2.bottom, p1.top, p1.bottom, true) ||
      utils.isBetween(p1.bottom, p2.top, p2.bottom, true)
    ) {
      return true;
    }
    return false;
  });
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

function gridColumns(rows, parentInner) {
  let html = parentInner;
  const gridRows = _.transform(
    rows,
    (newRow, row, index) => {
      const last = [];
      const nextComp = _.first(rows[index + 1] || []);
      let prevNode = null;
      newRow[index] = [];
      let column = -1;
      let left = 0;
      _.each(row, node => {
        if (node.nodeName === "TEXT") {
          return node;
        }
        if (!node.isComponent) {
          return;
        }
        if (node.boundingClientRect.left > left) {
          left = node.boundingClientRect.left;
          column++;
        }
        if (!Array.isArray(newRow[index][column])) {
          newRow[index][column] = [];
        }
        const outer = node.outerHTML;
        const split = html.split(outer);
        const first = split.shift();
        html = split.join(outer);

        // text add to current Column
        if (utils.hasText(first)) {
          const textColumn = column > 0 ? column - 1 : 0;
          newRow[index][textColumn].push({
            nodeName: "TEXT",
            text: first
          });
        }
        newRow[index][column].push(node);
      });
      const nextNode = _.first(rows[index + 1]);
      let first = "";
      if (nextNode) {
        const split = html.split(nextNode.outerHTML);
        first = split.shift();
        html = nextNode.outerHTML + split.join(nextNode.outerHTML);
      } else {
        first = html;
        html = "";
      }
      if (utils.hasText(first)) {
        const columnIndex = newRow[index].length;
        if (!Array.isArray(newRow[index][columnIndex])) {
          newRow[index][columnIndex] = [];
        }
        newRow[index][columnIndex].push({
          nodeName: "TEXT",
          text: first
        });
        if (column === 0) {
          column++;
        }
      }
    },
    []
  );
  return _.map(gridRows, row => {
    return _.sortBy(row, n => getFloat(n[0]) === "right");
  });
}

function calculateColumnWidth(index, row, parentWidth) {
  if (row.length < 2) {
    return parentWidth;
  }
  const columnWidths = _.map(row, column => {
    return _.reduce(
      column,
      (out, node) => {
        if (node.isComponent && node.widths.container > out) {
          return node.widths.inner;
        }
        return out;
      },
      0
    );
  });
  if (columnWidths[index] > 0) {
    return columnWidths[index];
  }
  const used = _.sum(columnWidths);
  const zeroedColumns = _.filter(columnWidths, v => v === 0).length;
  return (parentWidth - used) / zeroedColumns;
}

function buildStructure(node) {
  if (_.isArray(node)) {
    return _.compact(_.map(node, n => buildStructure(n)));
  }
  if (["TEXT"].includes(node.nodeName)) {
    return node;
  }
  if (!node.isComponent) {
    return null;
  }
  let parentGrid;
  if ((parentGrid = getParentGrid(node.children))) {
    const grid = gridColumns(parentGrid, node.innerHTML);
    const rows = _.transform(
      grid,
      (_rows, row) => {
        _rows.push({
          id: uuidV4(),
          nodeName: "ROW",
          width: node.widths.inner,
          children: row.map((column, index) => {
            return {
              id: uuidV4(),
              nodeName: "COLUMN",
              width: calculateColumnWidth(index, row, node.widths.inner),
              children: buildStructure(column)
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
  // const floatItems = _.filter(
  //   children,
  //   n => n.isComponent && ["left", "right"].includes(getFloat(n))
  // );

  // if (floatItems.length) {
  //   const items = _.clone(children);
  //   const newChildren = [];
  //   while ((childNode = items.shift())) {
  //     const float = getFloat(childNode);
  //     const isFloated = ["left", "right"].includes(float);
  //     if (isFloated) {
  //       const elements = _.transform(
  //         items,
  //         (o, el) => {
  //           if (o.isComponent) {
  //             return false;
  //           }
  //           o.push(el);
  //         },
  //         []
  //       );
  //       let elIndex = _.findIndex(elements, el => {
  //         return ["left", "right"].includes(getFloat(el));
  //       });
  //       elIndex = elIndex >= 0 ? elIndex : elements.length;
  //       const column = items.splice(0, elIndex);

  //       if (float === "left") {
  //         newChildren.push({
  //           id: uuidV4(),
  //           nodeName: "ROW",
  //           width: node.widths.inner,
  //           children: [
  //             {
  //               id: uuidV4(),
  //               nodeName: "COLUMN",
  //               width: childNode.widths.outer,
  //               children: [childNode]
  //             },
  //             {
  //               id: uuidV4(),
  //               nodeName: "COLUMN",
  //               width: node.widths.inner - childNode.widths.outer,
  //               children: column
  //             }
  //           ]
  //         });
  //       }
  //       if (float === "right") {
  //         newChildren.push({
  //           id: uuidV4(),
  //           nodeName: "ROW",
  //           width: node.widths.inner,
  //           children: [
  //             {
  //               id: uuidV4(),
  //               nodeName: "COLUMN",
  //               width: node.widths.inner - childNode.widths.outer,
  //               children: column
  //             },
  //             {
  //               id: uuidV4(),
  //               nodeName: "COLUMN",
  //               width: childNode.widths.outer,
  //               children: [childNode]
  //             }
  //           ]
  //         });
  //       }
  //     } else {
  //       newChildren.push(childNode);
  //     }
  //   }
  //   children = newChildren;
  // }

  return _.assign({}, node, {
    children
  });
}

function isNodeBetweenGroup(p1, group) {
  return _.some(group, p2 => {
    return (
      (p1.boundingClientRect.top === p2.boundingClientRect.top &&
        p1.boundingClientRect.bottom === p2.boundingClientRect.bottom) ||
      utils.isBetween(
        p1.boundingClientRect.top,
        p2.boundingClientRect.top,
        p2.boundingClientRect.bottom,
        false
      ) ||
      utils.isBetween(
        p1.boundingClientRect.bottom,
        p2.boundingClientRect.top,
        p2.boundingClientRect.bottom,
        true
      ) ||
      utils.isBetween(
        p2.boundingClientRect.top,
        p1.boundingClientRect.top,
        p1.boundingClientRect.bottom,
        false
      ) ||
      utils.isBetween(
        p2.boundingClientRect.bottom,
        p1.boundingClientRect.top,
        p1.boundingClientRect.bottom,
        true
      )
    );
  });
}

function groupNearNodes(nodes) {
  return _.transform(
    nodes,
    (rows, node) => {
      if (!rows.length) {
        rows.push([node]);
        return;
      }
      let isPushed = false;
      _.each(rows, (row, i) => {
        if (isNodeBetweenGroup(node, row)) {
          rows[i].push(node);
          isPushed = true;
          return false;
        }
      });
      if (!isPushed) {
        rows.push([node]);
      }
    },
    []
  );
}

function getParentGrid(children) {
  if (children.length <= 1) {
    return false;
  }
  if (_.some(children, node => ["TD", "TR"].includes(node.nodeName))) {
    return false;
  }
  const rows = groupNearNodes(children);
  // const rows = _.values(_.groupBy(children, "boundingClientRect.top"));
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
