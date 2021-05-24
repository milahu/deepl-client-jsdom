#!/usr/bin/env node --trace-warnings

var t1script = new Date().getTime();

// parse CLI args
var args = process.argv.slice(2);
const showDebug = args.includes('--debug');
const showTime = showDebug || args.includes('--time');
const useHacky = args.includes('--hacky');
args = args.filter(a => a.startsWith('-') == false);
const sourceLang = args[0] || 'en'; // TODO how to auto-detect sourceLang?
const targetLang = args[1] || 'de';
if (showDebug) console.dir({ sourceLang, targetLang });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



if (useHacky) {

  console.log('useHacky\n');
  console.log('warning: this can get your IP blocked with "Too many requests."\n');
  console.log('will continue in 1 sec ...\n');
  await sleep(1000);

  (async () => {

    const fs = await import("fs");

    var t1 = new Date().getTime();
    const getPath = (await import('platform-folders')).default.default;
    if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to require getPath`)

    var t1 = new Date().getTime();
    const {fetch: cookieFetch, CookieJar} = await import("node-fetch-cookies");
    if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to require node-fetch-cookies`);

    const cacheDir = getPath('cache') + '/deepl-client-jsdom';

    const cookiePath = cacheDir + '/cookies.json';
    const cookiePathExists = fs.existsSync(cookiePath);
    const cookieJar = cookiePathExists
      ? new CookieJar(cookiePath) // TODO better?
      : new CookieJar()
    ;
    if (cookiePathExists) await cookieJar.load();
    async function fetch(...args) {
      return await cookieFetch(cookieJar, ...args);
    }

    const defaultHeaders = {
      "accept": "*/*", // ; q=0.01
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "pragma": "no-cache",
    };

    const jsonHeaders = {
      ...defaultHeaders,
      "content-type": "application/json",
    };

    // TODO use original headers?
    //"referrer": "https://www.deepl.com/",
    //"referrerPolicy": "strict-origin-when-cross-origin",
    //"mode": "cors"

    // https://github.com/node-fetch/node-fetch
    async function showRes(res) {

      await sleep(1000); // sleep after every request (paranoid mode)

      console.dir({
        ok: res.ok,
        status: res.status,
        setCookie: res.headers.get('set-cookie'),
        contentType: res.headers.get('content-type'),
        size: res.size,
      });

      if ((res.headers.get('content-type') + '').startsWith('application/json')) {
        var data = await res.json();
        console.dir(data);
        if (!res.ok) {
          if (data?.error?.message) {
            console.log(`error: ${data.error.message}`)
            if (data.error.code == 1042912) {
              // original ip block message:
              console.log([
                'Access temporarily suspended',
                '',
                'It appears that your network is sending too many requests to our servers.',
                'Please try again later, or sign up for DeepL Pro, which allows you to translate a much higher volume of text.',
              ].join('\n'));
            }
          }
          throw new Error('request failed');
        }
        return data;
      }
      else {
        var data = await res.text();
        console.log(`text:\n${data.slice(0, 1000)} ...\n\n\n############### end of text ###################\n\n`);
        if (!res.ok) {
          throw new Error('request failed');
        }
        return data;
      }
    }

    // static.deepl.com/js/translator_late.min.$2878b2.js
    const
      STATUS_NORMAL = 0,
      STATUS_ERRORS = 1,
      STATUS_STRESS = 2,
      config = [
        [3, 30, 900, 300, 800],
        [2, 30, 900, 500, 1200],
        [1, 12, 160, 750, 3e3],
      ],
      CONFIG_LIMIT_5SECS = 0,
      CONFIG_LIMIT_MINUTE = 1,
      CONFIG_LIMIT_HOUR = 2,
      CONFIG_DELAY_NORMAL = 3,
      CONFIG_DELAY_AFTER_EMPTY = 4
    ;



    // sample input. http://www.nietzschesource.org/#eKGWB/GT-Titelblatt
    const sourceTextCollection = `
      Was auch diesem fragwürdigen Buche zu Grunde liegen mag: es muss eine Frage ersten Ranges und Reizes gewesen sein, noch dazu eine tief persönliche Frage, — Zeugniss dafür ist die Zeit, in der es entstand, trotz der es entstand, die aufregende Zeit des deutsch-französischen Krieges von 1870/71. Während die Donner der Schlacht von Wörth über Europa weggiengen, sass der Grübler und Räthselfreund, dem die Vaterschaft dieses Buches zu Theil ward, irgendwo in einem Winkel der Alpen, sehr vergrübelt und verräthselt, folglich sehr bekümmert und unbekümmert zugleich, und schrieb seine Gedanken über die Griechen nieder, — den Kern des wunderlichen und schlecht zugänglichen Buches, dem diese späte Vorrede (oder Nachrede) gewidmet sein soll. Einige Wochen darauf: und er befand sich selbst unter den Mauern von Metz, immer noch nicht losgekommen von den Fragezeichen, die er zur vorgeblichen „Heiterkeit“ der Griechen und der griechischen Kunst gesetzt hatte; bis er endlich, in jenem Monat tiefster Spannung, als man in Versailles über den Frieden berieth, auch mit sich zum Frieden kam und, langsam von einer aus dem Felde heimgebrachten Krankheit genesend, die „Geburt der Tragödie aus dem Geiste der Musik“ letztgültig bei sich feststellte. — Aus der Musik? Musik und Tragödie? Griechen und Tragödien-Musik? Griechen und das Kunstwerk des Pessimismus? Die wohlgerathenste, schönste, bestbeneidete, zum Leben verführendste Art der bisherigen Menschen, die Griechen — wie? gerade sie hatten die Tragödie nöthig? Mehr noch — die Kunst? Wozu — griechische Kunst?….
      Man erräth, an welche Stelle hiermit das grosse Fragezeichen vom Werth des Daseins gesetzt war. Ist Pessimismus nothwendig das Zeichen des Niedergangs, Verfalls, des Missrathenseins, der ermüdeten und geschwächten Instinkte? — wie er es bei den Indern war, wie er es, allem Anschein nach, bei uns, den „modernen“ Menschen und Europäern ist? Giebt es einen Pessimismus der Stärke? Eine intellektuelle Vorneigung für das Harte, Schauerliche, Böse, Problematische des Daseins aus Wohlsein, aus überströmender Gesundheit, aus Fülle des Daseins? Giebt es vielleicht ein Leiden an der Ueberfülle selbst? Eine versucherische Tapferkeit des schärfsten Blicks, die nach dem Furchtbaren verlangt, als nach dem Feinde, dem würdigen Feinde, an dem sie ihre Kraft erproben kann? an dem sie lernen will, was „das Fürchten“ ist? Was bedeutet, gerade bei den Griechen der besten, stärksten, tapfersten Zeit, der tragische Mythus? Und das ungeheure Phänomen des Dionysischen? Was, aus ihm geboren, die Tragödie? — Und wiederum: das, woran die Tragödie starb, der Sokratismus der Moral, die Dialektik, Genügsamkeit und Heiterkeit des theoretischen Menschen — wie? könnte nicht gerade dieser Sokratismus ein Zeichen des Niedergangs, der Ermüdung, Erkrankung, der anarchisch sich lösenden Instinkte sein? Und die „griechische Heiterkeit“ des späteren Griechenthums nur eine Abendröthe? Der epikurische Wille gegen den Pessimismus nur eine Vorsicht des Leidenden? Und die Wissenschaft selbst, unsere Wissenschaft — ja, was bedeutet überhaupt, als Symptom des Lebens angesehn, alle Wissenschaft? Wozu, schlimmer noch, woher — alle Wissenschaft? Wie? Ist Wissenschaftlichkeit vielleicht nur eine Furcht und Ausflucht vor dem Pessimismus? Eine feine Nothwehr gegen — die Wahrheit? Und, moralisch geredet, etwas wie Feig- und Falschheit? Unmoralisch geredet, eine Schlauheit? Oh Sokrates, Sokrates, war das vielleicht dein Geheimniss? Oh geheimnissvoller Ironiker, war dies vielleicht deine — Ironie? ——
      Was ich damals zu fassen bekam, etwas Furchtbares und Gefährliches, ein Problem mit Hörnern, nicht nothwendig gerade ein Stier, jedenfalls ein neues Problem: heute würde ich sagen, dass es das Problem der Wissenschaft selbst war — Wissenschaft zum ersten Male als problematisch, als fragwürdig gefasst. Aber das Buch, in dem mein jugendlicher Muth und Argwohn sich damals ausliess — was für ein unmögliches Buch musste aus einer so jugendwidrigen Aufgabe erwachsen! Aufgebaut aus lauter vorzeitigen übergrünen Selbsterlebnissen, welche alle hart an der Schwelle des Mittheilbaren lagen, hingestellt auf den Boden der Kunst — denn das Problem der Wissenschaft kann nicht auf dem Boden der Wissenschaft erkannt werden —, ein Buch vielleicht für Künstler mit dem Nebenhange analytischer und retrospektiver Fähigkeiten (das heisst für eine Ausnahme-Art von Künstlern, nach denen man suchen muss und nicht einmal suchen möchte…), voller psychologischer Neuerungen und Artisten-Heimlichkeiten, mit einer Artisten-Metaphysik im Hintergrunde, ein Jugendwerk voller Jugendmuth und Jugend-Schwermuth, unabhängig, trotzig-selbstständig auch noch, wo es sich einer Autorität und eignen Verehrung zu beugen scheint, kurz ein Erstlingswerk auch in jedem schlimmen Sinne des Wortes, trotz seines greisenhaften Problems, mit jedem Fehler der Jugend behaftet, vor allem mit ihrem „Viel zu lang“, ihrem „Sturm und Drang“: andererseits, in Hinsicht auf den Erfolg, den es hatte (in Sonderheit bei dem grossen Künstler, an den es sich wie zu einem Zwiegespräch wendete, bei Richard Wagner) ein bewiesenes Buch, ich meine ein solches, das jedenfalls „den Besten seiner Zeit“ genug gethan hat. Darauf hin sollte es schon mit einiger Rücksicht und Schweigsamkeit behandelt werden; trotzdem will ich nicht gänzlich unterdrücken, wie unangenehm es mir jetzt erscheint, wie fremd es jetzt nach sechzehn Jahren vor mir steht, — vor einem älteren, hundert Mal verwöhnteren, aber keineswegs kälter gewordenen Auge, das auch jener Aufgabe selbst nicht fremder wurde, an welche sich jenes verwegene Buch zum ersten Male herangewagt hat, — die Wissenschaft unter der Optik des Künstlers zu sehn, die Kunst aber unter der des Lebens….
      Nochmals gesagt, heute ist es mir ein unmögliches Buch, — ich heisse es schlecht geschrieben, schwerfällig, peinlich, bilderwüthig und bilderwirrig, gefühlsam, hier und da verzuckert bis zum Femininischen, ungleich im Tempo, ohne Willen zur logischen Sauberkeit, sehr überzeugt und deshalb des Beweisens sich überhebend, misstrauisch selbst gegen die Schicklichkeit des Beweisens, als Buch für Eingeweihte, als „Musik“ für Solche, die auf Musik getauft, die auf gemeinsame und seltene Kunst-Erfahrungen hin von Anfang der Dinge an verbunden sind, als Erkennungszeichen für Blutsverwandte in artibus, — ein hochmüthiges und schwärmerisches Buch, das sich gegen das profanum vulgus der „Gebildeten“ von vornherein noch mehr als gegen das „Volk“ abschliesst, welches aber, wie seine Wirkung bewies und beweist, sich gut genug auch darauf verstehen muss, sich seine Mitschwärmer zu suchen und sie auf neue Schleichwege und Tanzplätze zu locken. Hier redete jedenfalls — das gestand man sich mit Neugierde ebenso als mit Abneigung ein — eine fremde Stimme, der Jünger eines noch „unbekannten Gottes“, der sich einstweilen unter die Kapuze des Gelehrten, unter die Schwere und dialektische Unlustigkeit des Deutschen, selbst unter die schlechten Manieren des Wagnerianers versteckt hat; hier war ein Geist mit fremden, noch namenlosen Bedürfnissen, ein Gedächtniss strotzend von Fragen, Erfahrungen, Verborgenheiten, welchen der Name Dionysos wie ein Fragezeichen mehr beigeschrieben war; hier sprach — so sagte man sich mit Argwohn — etwas wie eine mystische und beinahe mänadische Seele, die mit Mühsal und willkürlich, fast unschlüssig darüber, ob sie sich mittheilen oder verbergen wolle, gleichsam in einer fremden Zunge stammelt. Sie hätte singen sollen, diese „neue Seele“ — und nicht reden! Wie schade, dass ich, was ich damals zu sagen hatte, es nicht als Dichter zu sagen wagte: ich hätte es vielleicht gekonnt! Oder mindestens als Philologe: — bleibt doch auch heute noch für den Philologen auf diesem Gebiete beinahe Alles zu entdecken und auszugraben! Vor allem das Problem, dass hier ein Problem vorliegt, — und dass die Griechen, so lange wir keine Antwort auf die Frage „was ist dionysisch?“ haben, nach wie vor gänzlich unerkannt und unvorstellbar sind…
    `.split(/[\.!\?…\n]/sg);

    console.log(`sourceTextCollection.length = ${sourceTextCollection.length}`);
    const sourceText = sourceTextCollection[sourceTextCollection.length * Math.random() | 0].trim(); // 'humans are the virus.';
    console.log(`sourceText = ${sourceText}`);

    const sourceLangPath = 'german';
    const targetLangPath = 'english';
    const sourceLang = 'DE';
    const targetLang = 'EN';
    const translatorId = 'dnsof7h3k2lgh3gda'; // hard-coded in static.deepl.com/js/translator_late.min.$2878b2.js



    // send request

    // 1. get cookies: userCountry, releaseGroups
    const indexUrl = "https://www.deepl.com/translator";
    var res = await fetch(indexUrl, {
      "headers": defaultHeaders,
      "body": null,
      "method": "GET",
    }); ;
    var data = await showRes(res);



    // 2.
    var body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'getClientState',
      params: { v: '20180814' },
      id: 11940001 // TODO?
    });
    var res = await fetch("https://www.deepl.com/PHP/backend/clientState.php?request_type=jsonrpc&il=EN&method=getClientState", {
      "headers": jsonHeaders,
      "body": body,
      "method": "POST",
    }); ;
    var data = await showRes(res);



    // 3.
    var body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'getClientState',
      params: { v: '20180814', clientVars: { showAppOnboarding: true } },
      id: 11940002
    });
    var res = await fetch("https://www.deepl.com/PHP/backend/clientState.php?request_type=jsonrpc&il=EN&method=getClientState", {
      "headers": jsonHeaders,
      "body": body,
      "method": "POST",
    });
    var data = await showRes(res);



    // 4.
    var delayMs = config[STATUS_NORMAL][CONFIG_DELAY_NORMAL];
    console.log(`delay dict query by ${delayMs} ms`)
    await sleep(delayMs);

    var requestCounter = 0; // TODO count requests to follow rate limits

    var body = `query=${encodeURIComponent(sourceText).replace(/%20/g, '+')}`
    var query = [
      'ajax=1',
      `source=${sourceLangPath}`,
      'onlyDictEntries=1',
      `translator=${translatorId}`,
      'delay=300',
      'jsStatus=0',
      'kind=full',
      'eventkind=change', // change, paste, ...
      'forleftside=true'
    ].join('&');
    var res = await fetch(`https://dict.deepl.com/${sourceLangPath}-${targetLangPath}/search?` + query, {
      "headers": {
        ...defaultHeaders,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      "body": body,
      "method": "POST",
    }); ;
    requestCounter++;
    var data = await showRes(res);
    // empty response -> result in cache



    // 5.
    // not needed?
    var res = await fetch("https://www2.deepl.com/jsonrpc?method=LMT_split_into_sentences", {
      "headers": defaultHeaders,
      "body": null,
      "method": "OPTIONS",
    }); ;
    var data = await showRes(res);
    // empty



    // 6.
    var body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'LMT_split_into_sentences',
      params: {
        texts: [ sourceText ],
        lang: {
          lang_user_selected: sourceLang, // 'auto',
          user_preferred_langs: [sourceLang], // [ 'DE', 'EN' ],
        }
      },
      id: 11940003
    });
    var res = await fetch("https://www2.deepl.com/jsonrpc?method=LMT_split_into_sentences", {
      "headers": jsonHeaders,
      "body": body,
      "method": "POST",
    }); ;
    var data = await showRes(res);



    // 7.
    var res = await fetch("https://www2.deepl.com/jsonrpc?method=LMT_handle_jobs", {
      "headers": defaultHeaders,
      "body": null,
      "method": "OPTIONS",
    }); ;
    var data = await showRes(res);

    var body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'LMT_handle_jobs',
      params: {
        jobs: [
          {
            kind: 'default',
            raw_en_sentence: sourceText,
            raw_en_context_before: [],
            raw_en_context_after: [],
            preferred_num_beams: 4
          }
        ],
        lang: {
          user_preferred_langs: [sourceLang], // [ sourceLang, sourceLang ],
          source_lang_computed: sourceLang,
          target_lang: targetLang,
        },
        priority: 1,
        commonJobParams: {},
        timestamp: new Date().getTime()
      },
      id: 11940004
    });



    // 8.
    var res = await fetch("https://www2.deepl.com/jsonrpc?method=LMT_handle_jobs", {
      "headers": jsonHeaders,
      "body": body,
      "method": "POST",
    }); ;
    var data = await showRes(res);



    // save cookies to disk
    await cookieJar.save(cookiePath);

  })();

}
else {

async function main() {

var t1 = new Date().getTime();
const jsdom = await import('jsdom');
if (showTime) console.log(`time: ${(new Date().getTime() - t1) / 1000} sec to require jsdom`)

const fs = await import('fs');
const path = await import('path');

var t1 = new Date().getTime();
const getPath = (await import('platform-folders')).default.default;
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
        /* TODO patch? static.deepl.com/js/translator_late.min.$2878b2.js
                function Et(e) {
                  return e && /^function fetch\(\)\s+\{\s+\[native code\]\s+\}$/.test(e.toString());
                }
        */
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
    /* TODO remove?
      \r\n is only added to #target-dummydiv
              var A = document.getElementById("source-dummydiv"),
                L = document.getElementById("target-dummydiv");
              (A.textContent = g + "\r\n"), (L.textContent = b + "\r\n"), f();
    */
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

}
