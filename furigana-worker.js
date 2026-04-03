// Web Worker에서 브라우저 전역 객체 폴리필
self.window = self;
self.document = { createElementNS: () => ({}) };

try {
  importScripts(
    'https://cdn.jsdelivr.net/npm/kuroshiro@1.2.0/dist/kuroshiro.min.js',
    'https://cdn.jsdelivr.net/npm/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js'
  );
} catch(e) {
  self.postMessage({ id: 0, error: 'importScripts failed: ' + e.message });
}

let kuroshiro = null;
let initPromise = null;

async function init(dictBase) {
  if (kuroshiro) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const KuroshiroClass = (typeof Kuroshiro !== 'undefined' && Kuroshiro.default) || Kuroshiro;
    const AnalyzerClass = (typeof KuromojiAnalyzer !== 'undefined' && KuromojiAnalyzer.default) || KuromojiAnalyzer;
    const k = new KuroshiroClass();
    await k.init(new AnalyzerClass({ dictPath: dictBase + 'dict' }));
    kuroshiro = k;
  })();
  return initPromise;
}

function parseFuriganaHTML(html) {
  const pairs = [];
  const regex = /<ruby>([^<]*)<rp>\(<\/rp><rt>([^<]*)<\/rt><rp>\)<\/rp><\/ruby>|([^<]+)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (m[1] !== undefined) {
      pairs.push({ text: m[1], reading: m[2] });
    } else if (m[3] !== undefined) {
      const t = m[3].trim();
      if (t) pairs.push({ text: t, reading: '' });
    }
  }
  return pairs;
}

self.onmessage = async function(e) {
  const { id, type, text, dictBase } = e.data;
  try {
    if (type === 'init') {
      await init(dictBase);
      self.postMessage({ id, result: 'ok' });
    } else if (type === 'convert') {
      await init(dictBase);
      const [html, reading] = await Promise.all([
        kuroshiro.convert(text, { mode: 'furigana', to: 'hiragana' }),
        kuroshiro.convert(text, { mode: 'normal', to: 'hiragana' }),
      ]);
      const pairs = parseFuriganaHTML(html);
      self.postMessage({ id, result: { html, reading, pairs } });
    }
  } catch (err) {
    self.postMessage({ id, error: 'worker error: ' + (err.message || String(err)) });
  }
};
