# deepl client jsdom

javascript client for the deepl online translator at [deepl.com/translator](https://www.deepl.com/translator)

## local install

```
git clone https://github.com/milahu/deepl-client-jsdom.git
cd deepl-client-jsdom
npm install

echo "hello world" | node deepl-cli.js en de
Hallo Welt
```

## global install

```
npm install -g https://github.com/milahu/deepl-client-jsdom.git

echo "hello world" | deepl en de
Hallo Welt
```

## similar projects

* [github.com/fkirc/attranslate](https://github.com/fkirc/attranslate)
  * heavyweight from many features, dependencies, typescript
  * only google translate, using official google api client
  * input formats: xml, json, yaml
* [github.com/KevCui/translate-cli](https://github.com/KevCui/translate-cli)
  * heavyweight from puppeteer dependency
* [github.com/milahu/deepl-client-filesystem](https://github.com/milahu/deepl-client-filesystem)
  * use the original deepl.com interface in connection with a local backend server to load and store text files
  * abandoned
* [github.com/vsetka/deepl-translator-cli](https://github.com/vsetka/deepl-translator-cli)
  * old and broken
