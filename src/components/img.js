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

function getParentWidth(parent) {
  const width = _.get(parent, "width");
  const inner = _.get(parent, "widths.inner");
  return _.isNil(width) ? inner : width;
}

function getAttrs(node, type, parent) {
  const rect = node.boundingClientRect;
  const styles = node.camStyles;
  const attrs = node.attrs;
  const width = node.widths.outer;
  const base = {
    src: attrs.src,
    url: attrs.url || ""
  };
  switch (type) {
    case "img":
      return _.assign({}, base, {
        width: `${width}px`
      });

    case "cell-img":
      return _.assign({}, base, {
        width: getParentWidth(parent) > width ? `${width}px` : "100%"
      });
    case "container":
      return {
        // width: getParentWid th(parent) > width ? `${width}px` : "100%",
        direction: "vertical",
        paddingTop: toNumber(styles.marginTop || 0),
        paddingRight: toNumber(styles.marginRight || 0),
        paddingBottom: toNumber(styles.marginBottom || 0),
        paddingLeft: toNumber(styles.marginLeft || 0),
        allowChildren: false,
        alignment: attrs.alignment || ""
      };
  }
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
  const outer = getAttrs(node, "container", parent);
  const inner = getAttrs(
    node,
    _.get(parent, "nodeName") === "COLUMN" ? "cell-img" : "img",
    parent
  );
  return buildContainer(buildImage(content, inner), outer);
}

module.exports = {
  processImg
};
