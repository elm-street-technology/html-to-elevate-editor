const _ = require("lodash");
const uuidV4 = require("uuid/v4");
const htmlToDraft = require("@michaelkramer/npmhtml-to-draftjs").default;

function stateFromHTML(html) {
  const blocksFromHTML = htmlToDraft(html);
  const blocks = _.map(blocksFromHTML.contentBlocks, contentBlock => {
    return _.assign(
      {},
      {
        entityRanges: [],
        characterList: [],
        inlineStyleRanges: []
      },
      contentBlock.toJSON()
    );
  });
  const entityMap = blocksFromHTML.entityMap.toJSON();
  _.each(blocks, block => {
    block.entityRanges = createEntityRange(block, entityMap);
    const inlineStyleRanges = createInlineStyleRanges(block);
    block.inlineStyleRanges = inlineStyleRanges;
  });

  return {
    blocks,
    entityMap
  };
}

function createEntityRange(block, entityMap) {
  const entityRanges = [];
  for (var k in entityMap) {
    if (entityMap.hasOwnProperty(k)) {
      const characterList = block.characterList;
      const indexoffirst = _.findIndex(characterList, { entity: k });
      const indexoflast = _.findLastIndex(characterList, { entity: k });
      if (indexoffirst !== -1) {
        entityRanges.push({
          offset: indexoffirst,
          length: indexoflast - indexoffirst + 1,
          key: k
        });
      }
    }
  }
  return entityRanges;
}

function createInlineStyleRanges(block) {
  const inlineStyleRanges = [];

  const characterList = block.characterList;
  const styleList = _.uniq(
    _.flattenDeep(
      _.map(characterList, list => {
        return list.style;
      })
    )
  );
  styleList.forEach(elm => {
    const indexList = _.keys(
      _.pickBy(characterList, list => {
        return list.style.includes(elm);
      })
    );
    const consList = _consecutive(indexList);
    consList.forEach(num => {
      inlineStyleRanges.push({
        offset: parseInt(num[0]),
        length: num.length,
        style: elm
      });
    });
  });
  return inlineStyleRanges;
}

function _consecutive(numbers) {
  let chunks = [];
  let prev = 0;
  numbers.forEach(current => {
    if (current - prev != 1) {
      chunks.push([]);
    }
    const chunkIndex = chunks.length !== 0 ? chunks.length - 1 : 0;
    if (chunks[chunkIndex]) {
      chunks[chunkIndex].push(current);
    }
    prev = current;
  });
  chunks.sort((a, b) => b.length - a.length);
  return chunks;
}

module.exports = {
  processText: (node, content = [], parent, maxWidth) => {
    return {
      id: uuidV4(),
      type: "Text",
      attrs: {
        html: node.text,
        value: stateFromHTML(node.text),
        color: ""
      },
      content: []
    };
  }
};
