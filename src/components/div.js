const _ = require("lodash");
const uuidV4 = require("uuid/v4");

function toNumber(value) {
  const val = parseInt(`${value}`.replace(/[^\d]/g, ""));
  if (_.isNaN(val)) {
    return 0;
  }
  return val;
}

function toDim(value, dim) {
  return `${value}`.includes(dim) ? value : `${value}${dim}`;
}

function getAttrs(node, type) {
  const rect = node.boundingClientRect;
  const styles = node.camStyles;
  const base = {};
  switch (type) {
    case "inner":
      return _.assign({}, base, {
        width: "100%",
        direction: "verticle",
        paddingTop: toNumber(styles.paddingTop || 0),
        paddingRight: toNumber(styles.paddingRight || 0),
        paddingBottom: toNumber(styles.paddingBottom || 0),
        paddingLeft: toNumber(styles.paddingLeft || 0),
        allowChildren: true
      });
    case "outer":
      return _.assign({}, base, {
        width: toDim(node.boundingClientRect.width, "px"),
        direction: "horizontal",
        paddingTop: toNumber(styles.marginTop || 0),
        paddingRight: toNumber(styles.marginRight || 0),
        paddingBottom: toNumber(styles.marginBottom || 0),
        paddingLeft: toNumber(styles.marginLeft || 0),
        allowChildren: false
      });
  }
}

function getWrapper(content) {
  return buildContainer([content], {
    width: "100%",
    direction: "horizontal",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    alignment: "center",
    allowChildren: false
  });
}

function buildContainer(content, attrs = {}) {
  return {
    id: uuidV4(),
    type: "Row",
    attrs,
    content: _.isArray(content) ? content : _.compact([content])
  };
}

function processDiv(node, content = [], parent, maxWidth) {
  const outer = getAttrs(node, "margin");
  const inner = getAttrs(node, "padding");
  const element = buildContainer(buildContainer(content, inner), outer);
  if (!parent) {
    return getWrapper(element);
  }
  return element;
}

module.exports = {
  processDiv,
  buildContainer,
  getAttrs
};
