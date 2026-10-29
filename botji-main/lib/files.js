const LANG_MAP = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'json',
  svg: 'xml',
  md: 'markdown',
  py: 'python'
};

function guessLang(path) {
  const ext = String(path || '').split('.').pop().toLowerCase();
  return LANG_MAP[ext] || ext || 'text';
}

function cleanPath(path) {
  return String(path)
    .replace(/[`*_]/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function parseFiles(text) {
  const source = String(text || '');
  const out = [];

  const strict = /File:\s*([^\n]+?)\s*\n+```([A-Za-z0-9+#._-]*)\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = strict.exec(source)) !== null) {
    const path = cleanPath(m[1]);
    if (!path) continue;
    out.push({ path, lang: m[2] || guessLang(path), content: m[3].replace(/\s+$/, '') });
  }
  if (out.length) return dedupe(out);

  const loose = /```([A-Za-z0-9+#._-]*)\r?\n([\s\S]*?)```/g;
  let i = 0;
  while ((m = loose.exec(source)) !== null) {
    i += 1;
    const lang = (m[1] || '').toLowerCase();
    let path = `file${i}.txt`;
    if (lang === 'html') path = 'index.html';
    else if (lang === 'css') path = `style${i}.css`;
    else if (lang === 'js' || lang === 'javascript') path = `script${i}.js`;
    else if (lang === 'json') path = 'bot.json';
    else if (lang) path = `file${i}.${lang}`;
    out.push({ path, lang: lang || 'text', content: m[2].replace(/\s+$/, '') });
  }
  return dedupe(out);
}

function dedupe(files) {
  const map = new Map();
  for (const f of files) map.set(f.path, f);
  return Array.from(map.values());
}

// ===== preview =====
// Preview dirender lewat <iframe srcDoc>. Dokumen srcDoc mewarisi base URL
// dari halaman induk (aplikasi Studio ini). Akibatnya href="#halaman2",
// location.hash = '#halaman2', href="tentang.html", atau href="/" diresolve
// ke URL Studio, lalu iframe memuat ULANG halaman Studio (Studio tampil dobel
// di dalam preview).
//
// Perbaikan utama: suntik <base href="about:srcdoc"> ke setiap halaman.
// Semua URL relatif dan hash lalu diresolve ke dokumen preview sendiri,
// bukan ke domain Studio.
//
// Router di dalam iframe menangani pindah antar file .html, dan memblokir
// tautan yang tidak ada di preview supaya iframe tidak pernah keluar dokumen.

function pageKey(path) {
  return String(path || '')
    .replace(/^(?:\.\/|\/)+/, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const PREVIEW_BASE = '<base href="about:srcdoc">';

const PREVIEW_GUARD = `<script>
(function () {
  var selfSource = document.currentScript ? document.currentScript.textContent : '';

  var dataEl = document.getElementById('__pv_pages');
  var pages = {};
  var json = '{}';
  var current = 'index.html';

  if (dataEl) {
    json = dataEl.textContent || '{}';
    try {
      pages = JSON.parse(json) || {};
    } catch (e) {
      pages = {};
    }
    current = dataEl.getAttribute('data-current') || current;
  }

  var baseOk = String(document.baseURI || '').indexOf('about:') === 0;

  function note(msg) {
    try {
      var n = document.getElementById('__pv_note');
      if (!n) {
        n = document.createElement('div');
        n.id = '__pv_note';
        n.setAttribute('style', 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(20,22,30,.92);color:#fff;font:13px/1.4 system-ui,sans-serif;padding:8px 14px;border-radius:999px;z-index:2147483647;pointer-events:none;transition:opacity .2s');
        (document.body || document.documentElement).appendChild(n);
      }
      n.textContent = msg;
      n.style.opacity = '1';
      clearTimeout(n.__t);
      n.__t = setTimeout(function () { n.style.opacity = '0'; }, 2400);
    } catch (e) {}
  }

  function strip(href) {
    var s = String(href || '').toLowerCase().trim();
    while (s.indexOf('./') === 0) s = s.slice(2);
    while (s.indexOf('../') === 0) s = s.slice(3);
    while (s.charAt(0) === '/') s = s.slice(1);
    var h = s.indexOf('#');
    if (h > -1) s = s.slice(0, h);
    var q = s.indexOf('?');
    if (q > -1) s = s.slice(0, q);
    return s;
  }

  function findPage(href) {
    var path = strip(href);
    if (!path) return null;
    if (pages[path]) return path;
    if (pages[path + '.html']) return path + '.html';
    if (pages[path + '/index.html']) return path + '/index.html';

    var dir = current.indexOf('/') > -1 ? current.slice(0, current.lastIndexOf('/') + 1) : '';
    if (dir) {
      var joined = strip(dir + path);
      if (pages[joined]) return joined;
      if (pages[joined + '.html']) return joined + '.html';
    }

    var base = path.split('/').pop();
    if (base && base.indexOf('.') === -1 && pages[base + '.html']) return base + '.html';
    return null;
  }

  function decode(value) {
    try {
      return decodeURIComponent(String(value || '').replace(/\\+/g, ' '));
    } catch (e) {
      return String(value || '');
    }
  }

  function idFrom(href) {
    var s = String(href || '').trim();

    var hash = s.indexOf('#');
    if (hash > -1) {
      var fromHash = decode(s.slice(hash + 1)).trim();
      if (fromHash) return fromHash;
    }

    var q = s.indexOf('?');
    if (q > -1) {
      var params = s.slice(q + 1).split('&');
      for (var i = 0; i < params.length; i += 1) {
        var eq = params[i].indexOf('=');
        if (eq < 0) continue;
        var key = decode(params[i].slice(0, eq)).toLowerCase();
        var val = decode(params[i].slice(eq + 1)).trim();
        if (!val) continue;
        if (
          key === 'page' ||
          key === 'p' ||
          key === 'halaman' ||
          key === 'view' ||
          key === 'section' ||
          key === 'tab' ||
          key === 'id' ||
          key === 'screen' ||
          key === 'menu' ||
          key === 'route'
        ) {
          return val;
        }
      }
    }

    return '';
  }

  function scrollTop() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      try {
        window.scrollTo(0, 0);
      } catch (err) {}
    }
  }

  function goHash(raw) {
    var id = String(raw || '').replace(/^#/, '').trim();
    if (!id || id === 'top') {
      scrollTop();
      return true;
    }

    var plain = decode(id);
    var el = document.getElementById(plain) || document.getElementsByName(plain)[0];

    if (!el) {
      var low = plain.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      el =
        document.getElementById(low) ||
        document.getElementById('page-' + low) ||
        document.getElementById('section-' + low) ||
        document.getElementById('halaman-' + low);
    }

    if (el && el.scrollIntoView) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        try {
          el.scrollIntoView();
        } catch (err) {}
      }
      return true;
    }

    return false;
  }

  function render(id) {
    var html = pages[id];
    if (typeof html !== 'string') return false;
    current = id;

    var head =
      '<base href="about:srcdoc">' +
      '<script type="application/json" id="__pv_pages" data-current="' + id + '">' + json + '<\\/script>' +
      '<script>' + selfSource + '<\\/script>';

    var out = html;
    if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, function (m) { return m + head; });
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, function (m) { return m + head; });
    else out = head + out;

    try {
      document.open();
      document.write(out);
      document.close();
    } catch (e) {
      note('Gagal pindah halaman di preview');
      return false;
    }

    scrollTop();
    return true;
  }

  function onClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;

    var href = a.getAttribute('href');
    if (href === null) return;
    href = String(href).trim();

    if (!href) {
      e.preventDefault();
      scrollTop();
      return;
    }

    var low = href.toLowerCase();

    if (
      low.indexOf('javascript:') === 0 ||
      low.indexOf('mailto:') === 0 ||
      low.indexOf('tel:') === 0 ||
      low.indexOf('sms:') === 0 ||
      low.indexOf('data:') === 0 ||
      low.indexOf('blob:') === 0
    ) {
      return;
    }

    if (a.hasAttribute('download')) return;

    if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 || href.indexOf('//') === 0) {
      e.preventDefault();
      try {
        window.open(a.href, '_blank', 'noopener');
      } catch (err) {}
      return;
    }

    // hash: kalau base URL aman, biarkan native supaya router/:target halaman jalan
    if (href.charAt(0) === '#') {
      if (baseOk) return;
      e.preventDefault();
      goHash(href);
      return;
    }

    var page = findPage(href);
    if (page) {
      e.preventDefault();
      if (page === current) {
        scrollTop();
        return;
      }
      render(page);
      return;
    }

    e.preventDefault();

    var id = idFrom(href);
    if (id && goHash('#' + id)) return;

    var path = strip(href);
    if (path) {
      var last = path.split('/').pop();
      if (last && goHash('#' + last)) return;
    }

    note('Tautan "' + href + '" tidak tersedia di preview');
  }

  function onSubmit(e) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    note('Form dinonaktifkan di preview');
  }

  try {
    var hist = window.history;
    if (hist && typeof hist.pushState === 'function' && !hist.__pvPatched) {
      hist.__pvPatched = true;
      var push = hist.pushState;
      var replace = hist.replaceState;
      hist.pushState = function () {
        try {
          return push.apply(hist, arguments);
        } catch (e) {
          return undefined;
        }
      };
      hist.replaceState = function () {
        try {
          return replace.apply(hist, arguments);
        } catch (e) {
          return undefined;
        }
      };
    }
  } catch (e) {}

  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, false);
})();
</script>
`;

function inlineAssets(input, css, js) {
  let html = String(input || '');

  html = html.replace(/<link[^>]*href=["'][^"']+\.css["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]*src=["'][^"']+\.m?js["'][^>]*>\s*<\/script>/gi, '');

  if (css) {
    const styleTag = `<style>\n${css}\n</style>\n`;
    html = html.includes('</head>')
      ? html.replace('</head>', () => `${styleTag}</head>`)
      : `${styleTag}${html}`;
  }

  if (js) {
    const scriptTag = `<script type="module">\n${js}\n</script>\n`;
    html = html.includes('</body>')
      ? html.replace('</body>', () => `${scriptTag}</body>`)
      : `${html}\n${scriptTag}`;
  }

  return html;
}

function injectHead(html, head) {
  const src = String(html || '');

  if (/<head[^>]*>/i.test(src)) {
    return src.replace(/<head[^>]*>/i, (m) => `${m}\n${head}`);
  }
  if (/<html[^>]*>/i.test(src)) {
    return src.replace(/<html[^>]*>/i, (m) => `${m}\n${head}`);
  }
  return `${head}\n${src}`;
}

export function buildPreview(files) {
  if (!Array.isArray(files) || files.length === 0) return null;

  const htmlFiles = files.filter((f) => /\.html?$/i.test(f.path));
  if (htmlFiles.length === 0) return null;

  const css = files
    .filter((f) => /\.css$/i.test(f.path))
    .map((f) => f.content)
    .join('\n\n');

  const js = files
    .filter((f) => /\.m?js$/i.test(f.path))
    .map((f) => f.content)
    .join('\n;\n');

  const pages = {};
  for (const f of htmlFiles) {
    pages[pageKey(f.path)] = inlineAssets(f.content, css, js);
  }

  const entryFile = htmlFiles.find((f) => /(^|\/)index\.html?$/i.test(f.path)) || htmlFiles[0];
  const entryKey = pageKey(entryFile.path);

  const dataScript = `<script type="application/json" id="__pv_pages" data-current="${entryKey}">${safeJson(pages)}</script>`;
  const head = `${PREVIEW_BASE}\n${dataScript}\n${PREVIEW_GUARD}`;

  return injectHead(pages[entryKey], head);
}

export function extractBotJson(files) {
  if (!Array.isArray(files)) return { bot: null, error: 'Tidak ada file.' };
  const jsonFile = files.find((f) => /(^|\/)bot\.json$/i.test(f.path));
  if (!jsonFile) return { bot: null, error: 'AI tidak mengirim file bot.json untuk preview.' };

  let parsed;
  try {
    parsed = JSON.parse(jsonFile.content);
  } catch (e) {
    return { bot: null, error: `bot.json bukan JSON valid: ${e.message}` };
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.screens || typeof parsed.screens !== 'object') {
    return { bot: null, error: 'bot.json tidak punya objek "screens".' };
  }

  const ids = Object.keys(parsed.screens);
  if (ids.length === 0) return { bot: null, error: '"screens" kosong.' };

  if (!parsed.start || !parsed.screens[parsed.start]) {
    parsed.start = ids[0];
  }

  return { bot: parsed, error: '' };
}

// Pisahkan teks balasan (di luar blok file) dari kode.
// Dipakai untuk tampilan streaming maupun hasil akhir.
export function splitReply(text) {
  let src = String(text || '');

  // buang blok file yang sudah lengkap
  src = src.replace(/File:\s*[^\n]+?\s*\n+```[A-Za-z0-9+#._-]*\r?\n[\s\S]*?```/g, '');
  src = src.replace(/```[A-Za-z0-9+#._-]*\r?\n[\s\S]*?```/g, '');

  // blok yang masih ditulis (belum ditutup)
  let writing = '';
  const open = src.search(/(^|\n)\s*File:\s*[^\n]+|```/);
  if (open >= 0) {
    const rest = src.slice(open);
    const m = rest.match(/File:\s*([^\n]+)/);
    writing = m ? m[1].replace(/[`*_"']/g, '').trim() : 'file';
    src = src.slice(0, open);
  }

  return { reply: src.trim(), writing };
}

// ===== diff baris (untuk panel Kode) =====

const DIFF_DP_LIMIT = 2500000;

function condenseDiff(lines, ctx) {
  const keep = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].type === 'same') continue;
    for (let k = i - ctx; k <= i + ctx; k += 1) {
      if (k >= 0 && k < lines.length) keep[k] = true;
    }
  }

  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (keep[i]) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    let j = i;
    while (j < lines.length && !keep[j]) j += 1;
    out.push({ type: 'gap', text: '', count: j - i });
    i = j;
  }
  return out;
}

// oldText -> newText, hasil: [{ type: 'same'|'add'|'del'|'gap', text, count? }]
export function diffLines(oldText, newText, options = {}) {
  const oldStr = String(oldText == null ? '' : oldText);
  const newStr = String(newText == null ? '' : newText);
  const ctx = typeof options.context === 'number' ? options.context : 3;

  if (oldStr === newStr) return [];

  const b = newStr.split('\n');
  if (oldStr.length === 0) {
    return condenseDiff(b.map((t) => ({ type: 'add', text: t })), ctx);
  }

  const a = oldStr.split('\n');
  const n = a.length;
  const m = b.length;

  if (n * m > DIFF_DP_LIMIT) {
    const naive = [...a.map((t) => ({ type: 'del', text: t })), ...b.map((t) => ({ type: 'add', text: t }))];
    return condenseDiff(naive, ctx);
  }

  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)]);
    }
  }

  const out = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ type: 'same', text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (dp[(i - 1) * width + j] >= dp[i * width + (j - 1)]) {
      out.push({ type: 'del', text: a[i - 1] });
      i -= 1;
    } else {
      out.push({ type: 'add', text: b[j - 1] });
      j -= 1;
    }
  }

  while (i > 0) {
    out.push({ type: 'del', text: a[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    out.push({ type: 'add', text: b[j - 1] });
    j -= 1;
  }

  out.reverse();
  return condenseDiff(out, ctx);
}
