> Convert HTML To Elevate Editor Content

## 💾 Install

```sh
yarn add html-to-elevate-editor
```

## 🔨 Usage

### Convert HTML To JSON Structure

```
const { LoadStructure } = require('html-to-elevate-editor');

const structure = await LoadStructure({
  url,
  target: ".rl-custompage",
  customJsCommands: [
    '$("#rls1a > div.modal-backdrop.fade.in, .rl-apology").remove()',
    '$("body").removeClass("modal-open")'
  ]
});
```

### Structure TO Editor Config

```
const { Convert } = require('html-to-elevate-editor');

const editorConfig = Convert(structure);
```
