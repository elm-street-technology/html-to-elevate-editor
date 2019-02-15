const _ = require("lodash");
const uuidV4 = require("uuid/v4");
const { buildContainer } = require("./div");

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
  const attrs = node.attrs;
  const base = {
    src: attrs.src
  };
  switch (type) {
    case "img":
      return _.assign({}, base, {
        width: `${rect.width}px`
      });

    case "cell-img":
      return _.assign({}, base, {});
    case "container":
      return {
        width: "100%",
        direction: "verticle",
        paddingTop: toNumber(styles.marginTop || 0),
        paddingRight: toNumber(styles.marginRight || 0),
        paddingBottom: toNumber(styles.marginBottom || 0),
        paddingLeft: toNumber(styles.marginLeft || 0),
        allowChildren: false
      };
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

function buildImage(content, attrs = {}) {
  return {
    id: uuidV4(),
    type: "Image",
    attrs,
    content: content || []
  };
}

function processImg(node, content = [], parent, maxWidth) {
  const outer = getAttrs(node, "container");
  const inner = getAttrs(
    node,
    _.get(parent, "nodeName") === "COLUMN" ? "cell-img" : "img"
  );
  return buildContainer(buildImage(content, inner), outer);
}

module.exports = {
  processImg
};
