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
      innerHTML: element.innerHTML,
      outerHTML: element.outerHTML,
      boundingClientRect: element.getBoundingClientRect().toJSON(),
      children: loopItems(element.children)
    };
  }
  return parseElement(target);
  // return parseElement(document.querySelector(".rl-custompage > div"));
}

function getTargetParent(checks) {
  for (i = 0; i < checks.length; i++) {
    const item = checks[i];
    const elements = document.querySelectorAll(item.tag);
    for (let s = 0; s < elements.length; s++) {
      const element = elements[s];
      if (element.innerText === item.text) {
        return element.parentElement;
      }
    }
  }
  return null;
}

async function getTargetPaths(page, html) {
  const matchElements = ["h1", "h2", "h3", "h4", "h5", "h6", "div", "p"];

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
}
function processStyles(styles) {
  return _.reduce(
    styles,
    (o, value, attr) => {
      if (
        /^(border|margin|padding|font|text-align|background|display|float)/.test(
          attr
        )
      ) {
        o[attr] = value;
      }
      return o;
    },
    {}
  );
}
function stripStyles(node) {
  return _.assign({}, node, {
    styles: processStyles(node.styles),
    children: _.map(node.children, stripStyles)
  });
}

// config = {| url: string, html?: string, target?:string, headless?: boolean |}
module.exports = async function getPageStructure(config) {
  const { url, html, target, cache, customJsCommands = [] } = config;
  const headless = _.has(config, "headless") ? config.headless : true;

  if (_.isEmpty(url)) {
    throw new Error("Url is required");
  }
  if (_.isEmpty(html) && _.isEmpty(target)) {
    throw new Error("Target or Html is required");
  }
  if (cache) {
    if (fs.existsSync(cache)) {
      return JSON.parse(fs.readFileSync(cache, { encoding: "utf-8" }));
    }
  }
  const browser = await Puppeteer.launch({ headless, devtools: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1500, height: 1056, isMobile: true });
  await page.goto(url, { waitUntil: "networkidle0" });

  let structure = {};
  let targetElement = null;
  if (!_.isEmpty(html)) {
    targetElement = await getTargetPaths(page, html);
  } else {
    targetElement = await page.$(target);
  }
  if (customJsCommands && customJsCommands.length) {
    while ((command = customJsCommands.shift())) {
      try {
        await page.evaluate(command);
      } catch (e) {
        // ignore execution errors
      }
    }
  }
  structure = stripStyles(await page.evaluate(evaldateElements, targetElement));
  if (cache) {
    fs.writeFileSync(cache, JSON.stringify(structure, null, 2));
  }
  await browser.close();
  return structure;
};
