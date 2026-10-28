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

export function buildPreview(files) {
  if (!Array.isArray(files) || files.length === 0) return null;

  const htmlFile = files.find((f) => /\.html?$/i.test(f.path));
  if (!htmlFile) return null;

  const css = files
    .filter((f) => /\.css$/i.test(f.path))
    .map((f) => f.content)
    .join('\n\n');

  const js = files
    .filter((f) => /\.m?js$/i.test(f.path))
    .map((f) => f.content)
    .join('\n;\n');

  let html = htmlFile.content;

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
