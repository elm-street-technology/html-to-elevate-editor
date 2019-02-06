const _ = require("lodash");
const Puppeteer = require("puppeteer");
const fs = require("fs");

function evaldateElements() {
  function getAttrs(element) {
    const attrs = {};
    const names = element.getAttributeNames() || [];
    names.map(name => {
      attrs[name] = element.getAttribute(name);
    });
    return attrs;
  }
  function getStyles(element) {
    var styles = {};
    var o = getComputedStyle(element);
    for (var i = 0; i < o.length; i++) {
      styles[o[i]] = o.getPropertyValue(o[i]);
    }
    return styles;
  }
  function loopItems(elements) {
    const children = [];
    for (let i = 0; i < elements.length; i++) {
      children.push(parseElement(elements.item(i)));
    }
    return children;
  }
  function parseElement(element) {
    return {
      nodeName: element.nodeName,
      attrs: getAttrs(element),
      styles: getStyles(element),
      boundingClientRect: element.getBoundingClientRect().toJSON(),
      children: loopItems(element.children)
    };
  }
  return parseElement(document.querySelector(".rl-custompage > div"));
}

(async data => {
  const url = data.url;
  const headless = true;
  const browser = await Puppeteer.launch({ headless, devtools: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1056, isMobile: true });
  // await page.setContent(html, { waitUntil: "networkidle0" });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(
    '$("#rls1a > div.modal-backdrop.fade.in, .rl-apology").remove(); $("body").removeClass("modal-open")'
  );
  const structure = await page.evaluate(evaldateElements);
  fs.writeFileSync(
    `./out/${_.snakeCase(url)}.json`,
    JSON.stringify(structure, null, 2)
  );
  await browser.close();
})(require("../examples/pat.json"));
