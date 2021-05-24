#!/usr/bin/env node --trace-warnings

var t1script = new Date().getTime();

// parse CLI args
var args = process.argv.slice(2);
const showDebug = args.includes('--debug');
const showTime = showDebug || args.includes('--time');
args = args.filter(a => a.startsWith('-') == false);
const sourceLang = args[0] || 'en'; // TODO how to auto-detect sourceLang?
const targetLang = args[1] || 'de';
if (showDebug) console.dir({ sourceLang, targetLang });

var t1 = new Date().getTime();
const jsdom = require('jsdom');
if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to require jsdom`)

const fs = require('fs');
const path = require('path');

var t1 = new Date().getTime();
const { default: getPath } = require('platform-folders');
if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to require getPath`)

const cacheDir = getPath('cache') + '/deepl-client-jsdom';
const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36";

const setDataUrl = true;

const targetTextSelector = '.lmt__target_textarea';
const sourceTextSelector = '.lmt__source_textarea';
// static.deepl.com/js/translator_late.min.$2878b2.js
// sourceTextField: e.querySelector(".lmt__source_textarea"),

// TODO split large inputs in chunks under 5000 chars
// TODO support google translate, to compare translations
// TODO support xml for google translate (and for deepl which breaks xml in rare cases)
// TODO run as daemon -> reduce latency?
// TODO use original interface to fix translations?

function showHelp() {
  const scriptPath = path.relative(process.cwd(), process.argv[1]);
  console.log(`usage:\necho INPUT | node ${scriptPath} [--debug] [SOURCE_LANG] [TARGET_LANG]`);
  console.log(`\nsample:\necho "hello world" | node ${scriptPath} en de`);
  process.exit(1);
}

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

// TODO refactor?
function makeRequest(url, body, headers) {
  const req = {
    href: url,
    response: { headers },
    getHeader: () => undefined, // jsdom: req.getHeader("referer"),
    then: callback => callback(body),
  };
  return req;
}

// TODO refactor?
class MockFirstRequest {
  constructor(url, cachePath) {
    this.href = url;
    this.cachePath = cachePath;
    this.response = { headers: {} };
  }
  getHeader(key) { return this.response.headers[key]; } // jsdom: req.getHeader("referer"),
  then(callback) {
    let req;
    var res = Promise.resolve();
    res = res.then(() => (req = jsdom.ResourceLoader.prototype.fetch(this.href, options)));
    res = res.then(buffer => buffer.toString());
    res = res.then(body => {
      this.response.headers = req.response.headers;
      if (showDebug) console.dir({ firstRequest: { url: this.href, headers: req.response.headers } });
      const cachePathHead = this.cachePath + '.head.json';
      if (showDebug) console.dir({ cachePathHead });
      fs.writeFileSync(this.cachePath, body, 'utf8');
      fs.writeFileSync(cachePathHead, JSON.stringify(req.response.headers), 'utf8');
      return callback(body);
    });
    return res;
  }
}

class CustomResourceLoader extends jsdom.ResourceLoader {

  // cache and patch requests
  // a simple version of https://github.com/alltherooms/cached-request

  isFirstRequest = true;

  fetch(url, options) {

    // ignore styles
    // workaround for a bug in jsdom https://github.com/dperini/nwsapi/issues/46
    if (url.endsWith('.css')) {
      if (showDebug) console.log(`fetch: ignore ${url}`);
      return Promise.resolve(Buffer.from(''));
    }

    const cachePath = cacheDir + '/' + url.replace(/:/g, '/').replace(/\/{2,}/g, '/');
    //if (showDebug) console.log(`fetch: cachePath = ${JSON.stringify(cachePath)}`);

    // read from cache
    if (fs.existsSync(cachePath)) {
      if (showDebug) console.log(`fetch: use cached ${cachePath}`);
      let body = fs.readFileSync(cachePath, 'utf8');
      // handle first request
      // needs http headers: content-type, set-cookie
      if (showDebug && url.endsWith('.js')) {
        body = body.replace(/dbg ?= ?!1,/g, 'dbg=true,');
      }
      if (this.isFirstRequest) {
        const cachePathHead = cachePath + '.head.json';
        if (showDebug) console.dir({ cachePathHead });
        const headers = JSON.parse(fs.readFileSync(cachePathHead, 'utf8'));
        if (showDebug) console.dir({ firstRequest: { url, headers } });
        this.isFirstRequest = false;
        return makeRequest(url, body, headers);
      }
      return Promise.resolve(Buffer.from(body));
    }

    // write to cache
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    if (showDebug) console.log(`fetch: download ${JSON.stringify(url)}`);

    // handle first request
    // needs content-type http header
    if (this.isFirstRequest) {
      this.isFirstRequest = false;
      const req = new MockFirstRequest(url, cachePath);
      return req;
    }

    var res = Promise.resolve();
    res = res.then(() => super.fetch(url, options));
    res = res.then(buffer => buffer.toString());
    res = res.then(body => {
      if (url.endsWith('.js')) {
        // workaround for a bug in deepl
        // https://static.deepl.com/js/ext/all3.min.$16b60e.js
        // deepl will test String(document.querySelectorAll)
        // browser: "function querySelectorAll() { [native code] }"
        // jsdom: "function querySelectorAll(...) { ... JS code ... }"
        // patch persistent (write to cache)
        body = body.replace(
          String.raw`Q=/^[^{]+\{\s*\[native \w/,`,
          `Q = { test: f => typeof f == 'function' },`
        );
      }
      fs.writeFileSync(cachePath, body, 'utf8');
      // patch dynamic (only in debug mode)
      if (url.endsWith('.js') && showDebug) {
        body = body.replace(/dbg ?= ?!1,/g, 'dbg=true,');
      }
      //return body;
      return Buffer.from(body);
    });
    return res;
  }
}

const resourceLoader = new CustomResourceLoader({
  strictSSL: false,
  userAgent,
});

const virtualConsole = new jsdom.VirtualConsole();

if (showDebug) virtualConsole.sendTo({
  ...console,
  log: (...args) => {
    if (args[0] == '[FeatureManager]') return; // make deepl debug less verbose
    console.log(...args);
  }
});

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
// TODO escape more? pipe is sentence delimiter
/* static.deepl.com/js/translator_late.min.$2878b2.js
                  var r = decodeURIComponent(n)
                      .replace(/[\\]./g, function (e) {
                        return "\\\\" === e ? "{_BACKSLASH_}" : e;
                      })
                      .replace(/([^\\])[/]/g, "$1{_DELIM_PART_}")
                      .replace(/([^\\])[|]/g, "$1{_DELIM_SENTENCE_}")
                      .replace(/\\([/|])/g, "$1")
                      .replace(/{_BACKSLASH_}/g, "\\"),
*/
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

async function waitFor(parentNode, selector, timeoutMs) {
  const stepMs = 100;
  if (!timeoutMs) timeoutMs = 100 * stepMs;
  for (let round = 0; round < Math.ceil(timeoutMs/stepMs); round++) {
    const e = parentNode.querySelector(selector);
    if (e) return e;
    if (showDebug) console.log('waiting for ' + selector);
    await sleep(stepMs);
  }
  if (showDebug) console.log('error: timeout waiting for ' + selector);
  return null; // timeout
}

async function clickElement(selector, sleepMs) {
  if (showDebug) console.log(`clickElement: selector ${selector}`);
  var elem = await waitFor(dom.window.document, selector);
  var event = new dom.window.Event('click', { bubbles: true, cancelable: true });
  elem.dispatchEvent(event);
  if (sleepMs) await sleep(sleepMs);
}

async function setTextarea(selector, text) {
  if (showDebug) console.log('setTextarea: selector ' + selector);
  const textarea = await waitFor(dom.window.document, selector);
  textarea.value = text;
  var event = new dom.window.Event('paste', { bubbles: true, cancelable: true });
  event.clipboardData = { getData: () => text };
  textarea.dispatchEvent(event);
}

async function main() {

  var t1 = new Date().getTime();
  const sourceText = await getStdin();
  if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to read stdin`)

  if (sourceText.trim().length == 0) showHelp();
  if (showDebug) console.log(`stdin = ${JSON.stringify(sourceText)}`);
  if (showDebug) console.log(`stdin.length = ${sourceText.length}`);

  // set sourceText via url
    //? `https://www.deepl.com/translator#${sourceLang}/${targetLang}/` // not working, languages are not set
  const url = setDataUrl
    ? `https://www.deepl.com/translator#${sourceLang}/${targetLang}/${encodeURIComponent(deeplBackslashEncode(sourceText))}`
    : `https://www.deepl.com/translator`
  ;
  if (showDebug) console.dir({ url });

  if (showDebug) console.log(`fetch: cacheDir = ${cacheDir}`);

  var t1 = new Date().getTime();
  const dom = await jsdom.JSDOM.fromURL(url, options);
  if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to load jsdom.fromURL`)

  if (!dom) {
    console.log('error: failed to load dom');
    return; // let jsdom run, TODO timeout 1 sec -> exit?
    process.exit(1);
  }

  if (showDebug) console.log(dom.window.document.cookie.split('; ').map(c => `received cookie: ${c}`).join('\n'));

  // https://gist.github.com/chad3814/5059671
  function waitForDocument() {
    return new Promise(resolve => {
      dom.window.addEventListener("load", () => resolve());
    });
  }
  var t1 = new Date().getTime();
  await waitForDocument();
  if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to load document`)

  if (setDataUrl == false) {
    // set languages via html
    if (showDebug) console.log(`set source language to ${sourceLang}`);
    await clickElement(`button[dl-test="translator-source-lang-btn"]`);
    await clickElement(`button[dl-test="translator-lang-option-${sourceLang}"]`);
    await sleep(500);

    if (showDebug) console.log(`set target language to ${targetLang}`);
    await clickElement(`button[dl-test="translator-target-lang-btn"]`);
    await clickElement(`button[dl-test="translator-lang-option-${targetLang}-${targetLang.toUpperCase()}"]`);
    await sleep(500);

    // set sourceText via html
    // TODO set earlier, as soon as sourceTextSelector is ready
    // trigger sendDictQueryWithHeaderUpdate
    if (showDebug) console.log(`set source text`);
    await setTextarea(sourceTextSelector, sourceText);
    await sleep(500);
  }

  var t1 = new Date().getTime();
  if (showDebug) console.log(`get target text`);
  const stepMs = 100;
  const timeoutMs = 100 * stepMs;
  const targetTextElement = await waitFor(dom.window.document, targetTextSelector);
  let targetText;
  for (let round = 0; round < Math.ceil(timeoutMs/stepMs); round++) {
    targetText = targetTextElement.value.endsWith('\r\n')
      ? targetTextElement.value.slice(0, -2)
      : targetTextElement.value
    ;
    if (showDebug) console.dir({ time: round * stepMs / 1000, targetText });
    if (targetText.trim().length > 0) {
      break; // found
    }
    await sleep(stepMs);
  }
  if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to get targetText`)
  if (showTime) console.log(`time sum: ${(new Date().getTime() - t1scriptRun) / 1000} sec to get targetText\n`)
  if (showTime) console.log(`time sum: ${(new Date().getTime() - t1script) / 1000} sec to parse script and get targetText\n`)

  console.log(targetText);

  process.exit(0); // quickfix. otherwise jsdom keeps running
}

if (showTime) console.log(`time sum: ${(new Date().getTime() - t1script) / 1000} sec to parse script\n`)
var t1scriptRun = new Date().getTime();
main();
