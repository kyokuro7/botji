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

// ===== preview multi halaman =====
// Preview dirender lewat <iframe srcDoc>, artinya basis URL dokumen = URL aplikasi Studio.
// Tanpa penjagaan, link seperti href="tentang.html", href="?page=2", atau href="/kontak"
// membuat iframe memuat ULANG halaman Studio (Studio tampil dobel di dalam preview).
// Solusi:
// 1. Semua file .html digabung jadi satu peta halaman.
// 2. Script di dalam iframe mencegat link. Halaman internal dipindah dengan document.write,
//    jadi iframe tidak pernah berpindah URL.
// 3. Link yang tidak dikenali diblokir, bukan diteruskan ke browser.
// 4. Link hash (#section) dibiarkan native supaya router JS di dalam halaman tetap jalan.

function pageKey(path) {
  return String(path || '')
    .replace(/^(?:\.\/|\/)+/, '')
    .toLowerCase();
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const PREVIEW_GUARD = `<script>
(function () {
  var dataEl = document.getElementById('__pv_pages');
  var pages = {};
  var current = 'index.html';

  if (dataEl) {
    try {
      pages = JSON.parse(dataEl.textContent || '{}') || {};
    } catch (e) {
      pages = {};
    }
    current = dataEl.getAttribute('data-current') || current;
  }

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
      return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
    } catch (e) {
      return String(value || '');
    }
  }

  function idFrom(href) {
    var s = String(href || '').trim();

    var hash = s.indexOf('#');
    if (hash > -1) {
      var fromHash = decode(s.slice(hash + 1));
      if (fromHash) return fromHash;
    }

    var q = s.indexOf('?');
    if (q > -1) {
      var params = s.slice(q + 1).split('&');
      for (var i = 0; i < params.length; i += 1) {
        var eq = params[i].indexOf('=');
        if (eq < 0) continue;
        var key = decode(params[i].slice(0, eq)).toLowerCase();
        var val = decode(params[i].slice(eq + 1));
        if (!val) continue;
        if (
          key === 'page' ||
          key === 'p' ||
          key === 'halaman' ||
          key === 'view' ||
          key === 'section' ||
          key === 'tab' ||
          key === 'id' ||
          key === 'route' ||
          key === 'screen' ||
          key === 'menu'
        ) {
          return val;
        }
      }
    }

    return '';
  }

  function goHash(raw) {
    var id = String(raw || '').replace(/^#/, '').trim();
    if (!id) return false;

    var el =
      document.getElementById(id) ||
      document.getElementById(id.toLowerCase()) ||
      document.getElementsByName(id)[0];

    if (!el) {
      var low = id.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
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
        el.scrollIntoView();
      }
      return true;
    }

    return false;
  }

  function render(id) {
    var html = pages[id];
    if (typeof html !== 'string') return false;
    current = id;
    try {
      document.open();
      document.write(html);
      document.close();
    } catch (e) {
      note('Gagal pindah halaman di preview');
      return false;
    }
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
    return true;
  }

  function onClick(e) {
    if (e.defaultPrevented) return;

    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;

    var href = a.getAttribute('href');
    if (href === null) return;
    href = String(href);

    if (!href.trim()) {
      e.preventDefault();
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        window.scrollTo(0, 0);
      }
      return;
    }

    var low = href.toLowerCase().trim();

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

    // hash murni: serahkan ke browser dan router JS di dalam halaman
    if (href.charAt(0) === '#') return;

    var page = findPage(href);
    if (page) {
      e.preventDefault();
      if (page === current) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
          window.scrollTo(0, 0);
        }
        return;
      }
      render(page);
      return;
    }

    // bukan file halaman: coba petakan ke id elemen (query string / route)
    e.preventDefault();

    var id = idFrom(href);
    if (id && goHash(id)) return;

    var path = strip(href);
    if (path) {
      var last = path.split('/').pop();
      if (last && goHash(last)) return;
    }

    note('Tautan "' + href + '" tidak bisa dibuka di preview');
  }

  function onSubmit(e) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    note('Form dinonaktifkan di preview');
  }

  function onBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  // listener dipasang di window, bukan document, karena document.write tidak menghapus listener window
  window.addEventListener('click', onClick, true);
  window.addEventListener('submit', onSubmit, false);
  window.addEventListener('beforeunload', onBeforeUnload, false);
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

function injectRouter(pages, entryKey) {
  const data = `<script type="application/json" id="__pv_pages" data-current="${entryKey}">${safeJson(pages)}</script>\n`;
  const block = `${data}${PREVIEW_GUARD}`;
  const html = pages[entryKey] || '';

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${block}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n${block}`);
  }
  return `${block}${html}`;
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

  return injectRouter(pages, entryKey);
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
