const _ = require("lodash");
const uuidV4 = require("uuid/v4");
const utils = require("../lib/utils");

const { convertToRaw, ContentState } = require("draft-js");
const { JSDOM } = require("jsdom");
const convertFromHTML = require("../html-to-draft");

function serverDOMBuilder(html) {
  const { document: jsdomDocument, HTMLElement, HTMLAnchorElement } = new JSDOM(
    `<!DOCTYPE html>`
  ).window;
  // HTMLElement and HTMLAnchorElement needed on global for convertFromHTML to work
  global.HTMLElement = HTMLElement;
  global.HTMLAnchorElement = HTMLAnchorElement;

  const doc = jsdomDocument.implementation.createHTMLDocument("foo");
  doc.documentElement.innerHTML = html;
  const body = doc.getElementsByTagName("body")[0];
  return body;
}

function convertAlignText(content) {
  const { blocks, entityMap } = content;

  return {
    blocks: _.map(blocks, block => {
      const data = {};
      const hasStyle = _.find(block.inlineStyleRanges, inline =>
        /^TEXTALIGN/.test(inline.style)
      );
      if (hasStyle) {
        data["text-align"] = hasStyle.style
          .replace(/^TEXTALIGN(.*?)$/, "$1")
          .toLowerCase();
      }
      return _.assign({}, block, {
        inlineStyleRanges: _.filter(
          block.inlineStyleRanges,
          inline => !/^TEXTALIGN/.test(inline.style)
        ),
        data: _.assign({}, block.data, data)
      });
    }),
    entityMap
  };
}

function stateFromHTML(html) {
  // if DOMBuilder is undefined convertFromHTML will use the browser dom,
  //  hence we set DOMBuilder to undefined when document exist
  let DOMBuilder =
    typeof document === "undefined" ? serverDOMBuilder : undefined;
  // const blocksFromHTML = convertFromHTML(html, DOMBuilder);
  const blocksFromHTML = convertFromHTML(html, DOMBuilder);
  const state = ContentState.createFromBlockArray(
    blocksFromHTML.contentBlocks,
    blocksFromHTML.entityMap
  );

  return convertAlignText(convertToRaw(state));
}

module.exports = {
  processText: (node, content = [], parent, maxWidth) => {
    return {
      id: uuidV4(),
      type: "Text",
      attrs: {
        value: utils.hasText(node.text) ? stateFromHTML(node.text) : {},
        color: ""
      },
      content: []
    };
  }
};
