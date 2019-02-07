const _ = require("lodash");
const Puppeteer = require("puppeteer");
const fs = require("fs");
const cheerio = require("cheerio");

function evaldateElements(target) {
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
  console.log(this);
  return parseElement(target);
  // return parseElement(document.querySelector(".rl-custompage > div"));
}

function getTargetParent(checks) {
  for (i = 0; i < checks.length; i++) {
    const item = checks[i];
    console.log(item);
    const elements = document.querySelectorAll(item.tag);
    console.log(elements);
    for (let s = 0; s < elements.length; s++) {
      const element = elements[s];
      console.log(element, item);
      if (element.innerText === item.text) {
        return element.parentElement;
      }
    }
  }
  return null;
}

async function getTargetPaths(page, html) {
  const matchElements = ["h1", "h2", "h3", "h4", "h5", "h6", "div", "p"];
  try {
    const $ = cheerio.load(`<root>${html}</root>`, {
      normalizeWhitespace: true,
      xmlMode: true
    });
    const items = [];
    const rootItems = $("root > *");
    for (let i = 0; i < rootItems.length; i++) {
      const item = rootItems.eq(i);
      const element = rootItems[i];
      if (element.type === "tag" && matchElements.includes(element.name)) {
        items.push({
          tag: element.name,
          text: item.text()
        });
      }
    }

    const element = await page.evaluateHandle(getTargetParent, items);
    return element ? element : null;
  } catch (e) {
    console.log(e);
  }
}

(async data => {
  const url = data.url;
  const html = data.html;
  const headless = false;
  const browser = await Puppeteer.launch({ headless, devtools: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1056, isMobile: true });
  // await page.setContent(html, { waitUntil: "networkidle0" });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(
    '$("#rls1a > div.modal-backdrop.fade.in, .rl-apology").remove(); $("body").removeClass("modal-open")'
  );
  let structure = {};
  try {
    const target = await getTargetPaths(page, html);
    // console.log(
    //   await page.evaluateHandle(el => console.log("element", el), target)
    // );
    structure = await page.evaluate(evaldateElements, target);
  } catch (e) {
    console.error(e);
  }
  fs.writeFileSync(
    `./out/${_.snakeCase(url)}.json`,
    JSON.stringify(structure, null, 2)
  );
  await browser.close();
})(require("../examples/pat.json"));
