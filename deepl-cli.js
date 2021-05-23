#!/usr/bin/env node

const jsdom = require('jsdom');
const fs = require('fs');
const path = require('path');

const cacheDir = 'cache';
const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36";
const targetTextSelector = '#target-dummydiv';

// TODO run as daemon -> reduce latency?

function showHelp() {
  const scriptPath = path.relative(process.cwd(), process.argv[1]);
  console.log(`usage:\necho INPUT | node ${scriptPath} [--debug] [SOURCE_LANG] [TARGET_LANG]`);
  console.log(`\nsample:\necho "hello world" | node ${scriptPath} en de`);
  process.exit(1);
}

// parse CLI args
var args = process.argv.slice(2);
const isDebug = args.includes('--debug');
args = args.filter(a => a.startsWith('-') == false);
const sourceLang = args[0] || 'en'; // TODO how to auto-detect sourceLang?
const targetLang = args[1] || 'de';
if (isDebug) console.dir({ sourceLang, targetLang });

// https://github.com/sindresorhus/get-stdin/blob/main/index.js
const { stdin } = process;
async function getStdin() {
  let result = '';
  if (stdin.isTTY) {
    return result;
  }
  stdin.setEncoding('utf8');
  for await (const chunk of stdin) {
    result += chunk;
  }
  return result;
}

class CustomResourceLoader extends jsdom.ResourceLoader {

  fetch(url, options) {

    // ignore styles
    // workaround for a bug in jsdom https://github.com/dperini/nwsapi/issues/46
    if (url.endsWith('.css')) {
      if (isDebug) console.log(`fetch: ignore ${url}`);
      return Promise.resolve(Buffer.from(''));
    }

    // bypass cache
    // FIXME also cache the entry html file
    // -> mock response object for node_modules/jsdom/lib/api.js
    // const req = resourceLoaderForInitialRequest.fetch
    if (url.endsWith('.js') == false) {
      if (isDebug) console.log(`fetch: download ${url}`);
      return super.fetch(url, options);
    }

    const cachePath = cacheDir + url.replace(/^https?:\//, '');
    //if (isDebug) console.log(`fetch: cachePath = ${JSON.stringify(cachePath)}`);

    // read from cache
    if (fs.existsSync(cachePath)) {
      if (isDebug) console.log(`fetch: use cached ${url}`);
      var str = fs.readFileSync(cachePath, 'utf8');
      return Promise.resolve(Buffer.from(str));
    }

    // write to cache
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    if (isDebug) console.log(`fetch: download ${JSON.stringify(url)}`);
    
    var res = Promise.resolve();
    res = res.then(() => super.fetch(url, options));
    res = res.then(buffer => buffer.toString());
    res = res.then(str => {
      if (url.endsWith('.js')) {
        // workaround for a bug in deepl
        // https://static.deepl.com/js/ext/all3.min.$16b60e.js
        // deepl will test String(document.querySelectorAll)
        // browser: "function querySelectorAll() { [native code] }"
        // jsdom: "function querySelectorAll(...) { ... JS code ... }"
        str = str.replace(
          String.raw`Q=/^[^{]+\{\s*\[native \w/,`,
          `Q = { test: f => typeof f == 'function' },`
        );
      }
      fs.writeFileSync(cachePath, str, 'utf8');
      return Buffer.from(str);
    });
    return res;
  }
}

const resourceLoader = new CustomResourceLoader({
  strictSSL: false,
  userAgent,
});

const virtualConsole = new jsdom.VirtualConsole();

if (isDebug) virtualConsole.sendTo(console);

const options = {
  resources: resourceLoader,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
  cookieJar: new jsdom.CookieJar(),
  beforeParse: (window) => {
    // mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => false, // Deprecated
        removeListener: () => false, // Deprecated
        addEventListener: () => false,
        removeEventListener: () => false,
        dispatchEvent: () => false,
      }),
    });
  },
};

// https://github.com/jsdom/jsdom/issues/2577
const cookieRoundSeconds = 60 * 60 * 24; // round down to start of the day
function setCookieDone(error, cookie) {
  if (error) console.log(`set cookie error: ${error}`);
}
options.cookieJar.setCookie(`privacySettings=${encodeURIComponent(JSON.stringify({
  v: '1',
  t: Math.floor(new Date().getTime() / 1000 / cookieRoundSeconds) * cookieRoundSeconds,
  m: 'STRICT',
  consent: [ 'NECESSARY', 'PERFORMANCE', 'COMFORT' ]
}))}`, '.deepl.com', setCookieDone);

// https://github.com/iansan5653/unraw/issues/29
// deepl.com:
//   / -> \/
//   \ -> \\
function deeplBackslashEncode(str) {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const char16bit = str[i];
    const code = char16bit.charCodeAt(0);
    res += (
      (code == 47) ? '\\/' : // forward slash
      (code == 92) ? '\\\\' : // backslash
      char16bit
    );
  }
  return res;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {

  const sourceText = await getStdin();
  if (sourceText.trim().length == 0) showHelp();
  if (isDebug) console.log(`stdin = ${JSON.stringify(sourceText)}`);
  if (isDebug) console.log(`stdin.length = ${sourceText.length}`);

  const url = `https://www.deepl.com/translator#${sourceLang}/${targetLang}/${encodeURIComponent(deeplBackslashEncode(sourceText))}`;
  if (isDebug) console.dir({ url });

  if (isDebug) console.log(`fetch: cacheDir = ${cacheDir}`);

  const dom = await jsdom.JSDOM.fromURL(url, options);

  if (isDebug) console.log(dom.window.document.cookie.split('; ').map(c => `received cookie: ${c}`).join('\n'));

  if (isDebug) console.log('load deepl');
  await sleep(1000);

  for (let round = 0; round < 10; round++) {

    const targetTextElement = dom.window.document.querySelector(targetTextSelector);
    if (targetTextElement) {
      const targetText = targetTextElement.innerHTML.endsWith('\r\n')
        ? targetTextElement.innerHTML.slice(0, -2)
        : targetTextElement.innerHTML
      ;
      if (isDebug) console.dir({ targetText });
      if (targetText.trim().length > 0) {
        console.log(targetText);
        break; // found
      }
    }
    else {
      if (isDebug) console.log('waiting for ' + targetTextSelector);
    }
    await sleep(100);
  }

  process.exit(0); // quickfix. otherwise jsdom keeps running
}

main();
