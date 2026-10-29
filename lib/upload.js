// Baca file upload user langsung di browser: teks/kode, ZIP, docx, gambar.
// Tidak ada dependency eksternal.

const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'json', 'xml', 'svg', 'yml', 'yaml', 'toml', 'ini', 'env', 'example', 'py', 'rb', 'php',
  'java', 'kt', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cs', 'sh', 'bat', 'sql', 'csv', 'log',
  'gitignore', 'lock', 'prisma', 'vue', 'svelte'
]);

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'avif']);

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml'
};

const LANG = {
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
  py: 'python',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  rb: 'ruby',
  php: 'php',
  go: 'go',
  rs: 'rust'
};

const MAX_TEXT_BYTES = 400000;
const MAX_IMAGE_BYTES = 1500000;
const MAX_ZIP_ITEMS = 80;
const MAX_FILE_CHARS = 40000;
const MAX_TOTAL_CHARS = 140000;

let counter = 0;

function makeItem(part) {
  counter += 1;
  return {
    id: `up-${Date.now().toString(36)}-${counter}`,
    include: true,
    kind: 'text',
    size: 0,
    ...part
  };
}

export function extOf(name) {
  const s = String(name || '');
  const clean = s.split(/[?#]/)[0];
  const i = clean.lastIndexOf('.');
  if (i < 0) return '';
  return clean.slice(i + 1).toLowerCase();
}

export function langOf(path) {
  const ext = extOf(path);
  return LANG[ext] || ext || 'text';
}

export function mimeOf(ext) {
  return MIME[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function bytesToDataUrl(bytes, mime) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gambar tidak bisa dibaca.'));
    reader.readAsDataURL(file);
  });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('File tidak bisa dibaca.'));
    reader.readAsText(file);
  });
}

function findEocd(view) {
  const len = view.byteLength;
  const start = Math.max(0, len - 66000);
  for (let i = len - 22; i >= start; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser ini belum mendukung DecompressionStream, ZIP terkompresi tidak bisa dibaca. Coba Chrome/Edge/Firefox terbaru.');
  }
  if (bytes.length === 0) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function unzipEntries(buffer) {
  const view = new DataView(buffer);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error('Bukan file ZIP yang valid.');

  const total = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const out = [];

  for (let i = 0; i < total; i += 1) {
    if (ptr + 46 > buffer.byteLength) break;
    if (view.getUint32(ptr, true) !== 0x02014b50) break;

    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOff = view.getUint32(ptr + 42, true);

    const nameBytes = new Uint8Array(buffer, ptr + 46, nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);

    ptr += 46 + nameLen + extraLen + commentLen;

    if (!name || name.endsWith('/')) continue;
    if (name.startsWith('__MACOSX/') || /(^|\/)\._/.test(name)) continue;
    if (localOff + 30 > buffer.byteLength) continue;

    const lnameLen = view.getUint16(localOff + 26, true);
    const lextraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lnameLen + lextraLen;
    if (dataStart + compSize > buffer.byteLength) continue;

    const raw = new Uint8Array(buffer, dataStart, compSize);

    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflateRaw(raw);
    else continue;

    out.push({ name, data });
  }

  return out;
}

async function readDocx(file) {
  const buffer = await file.arrayBuffer();
  const entries = await unzipEntries(buffer);
  const main = entries.find((e) => /^word\/document\.xml$/i.test(e.name));
  if (!main) throw new Error('File .docx tidak punya word/document.xml.');

  const xml = new TextDecoder('utf-8').decode(main.data);
  const text = xml
    .replace(/<w:p\b[^>]*>/gi, '\n')
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) throw new Error('Tidak ada teks yang terbaca dari .docx.');
  return text;
}

function zipPath(base, name) {
  const clean = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return base ? `${base}/${clean}` : clean;
}

async function readZip(file) {
  const buffer = await file.arrayBuffer();
  const entries = await unzipEntries(buffer);
  if (!entries.length) throw new Error('ZIP kosong atau tidak terbaca.');

  const base = String(file.name || 'arsip').replace(/\.zip$/i, '');
  const out = [];

  for (const entry of entries) {
    if (out.length >= MAX_ZIP_ITEMS) break;

    const ext = extOf(entry.name);
    const path = zipPath(base, entry.name);
    const name = entry.name.split('/').pop();

    if (IMAGE_EXT.has(ext)) {
      if (entry.data.length > MAX_IMAGE_BYTES) continue;
      out.push(
        makeItem({
          name,
          path,
          size: entry.data.length,
          kind: 'image',
          dataUrl: bytesToDataUrl(entry.data, mimeOf(ext)),
          include: false
        })
      );
      continue;
    }

    if (!TEXT_EXT.has(ext)) continue;
    if (entry.data.length > MAX_TEXT_BYTES) continue;

    const content = new TextDecoder('utf-8', { fatal: false }).decode(entry.data);
    out.push(makeItem({ name, path, size: entry.data.length, kind: 'text', content, include: true }));
  }

  if (!out.length) throw new Error('Tidak ada file teks atau gambar yang bisa dibaca dari ZIP.');
  return out;
}

export async function readUpload(file) {
  if (!file) return [];

  const name = file.name || 'file';
  const ext = extOf(name);

  if (ext === 'zip' || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    return readZip(file);
  }

  if (ext === 'docx') {
    const text = await readDocx(file);
    const cut = text.length > MAX_TEXT_BYTES;
    return [
      makeItem({
        name,
        path: name,
        size: file.size || text.length,
        kind: 'text',
        content: cut ? text.slice(0, MAX_TEXT_BYTES) : text,
        truncated: cut,
        include: true
      })
    ];
  }

  if (IMAGE_EXT.has(ext) || /^image\//i.test(String(file.type || ''))) {
    const dataUrl = await fileToDataUrl(file);
    return [makeItem({ name, path: name, size: file.size || 0, kind: 'image', dataUrl, include: false })];
  }

  if (TEXT_EXT.has(ext) || !ext) {
    const text = await readTextFile(file);
    const cut = text.length > MAX_TEXT_BYTES;
    return [
      makeItem({
        name,
        path: name,
        size: file.size || text.length,
        kind: 'text',
        content: cut ? text.slice(0, MAX_TEXT_BYTES) : text,
        truncated: cut,
        include: true
      })
    ];
  }

  return [makeItem({ name, path: name, size: file.size || 0, kind: 'binary', include: false })];
}

export function buildUploadBlock(items) {
  const list = (Array.isArray(items) ? items : []).filter(
    (i) => i && i.include !== false && i.kind === 'text' && typeof i.content === 'string' && i.content.trim()
  );
  if (list.length === 0) return '';

  const fence = '```';
  const chunks = [];
  let used = 0;

  for (const it of list) {
    if (used >= MAX_TOTAL_CHARS) break;
    const room = Math.min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - used);
    let body = it.content;
    let cut = false;
    if (body.length > room) {
      body = body.slice(0, room);
      cut = true;
    }
    used += body.length;
    const path = it.path || it.name || 'file.txt';
    chunks.push(`File: ${path}\n${fence}${langOf(path)}\n${body}\n${fence}${cut ? '\n(file dipotong, terlalu panjang)' : ''}`);
  }

  if (!chunks.length) return '';

  return [
    'FILE DARI USER (hasil upload, ini kondisi project yang sebenarnya):',
    'Pakai isi file di bawah sebagai acuan utama. Kalau user minta perubahan, kirim ULANG file yang berubah secara utuh memakai format File: nama.ext lalu blok kode. Jangan mengarang isi file yang tidak ada di sini.',
    '',
    chunks.join('\n\n')
  ].join('\n');
}

export function uploadsToFiles(items) {
  const list = Array.isArray(items) ? items : [];
  const out = [];
  const seen = new Set();

  for (const it of list) {
    if (!it || it.kind !== 'text' || typeof it.content !== 'string') continue;
    if (it.include === false) continue;

    const path = String(it.path || it.name || 'file.txt')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();

    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, lang: langOf(path), content: it.content });
  }

  return out;
}
