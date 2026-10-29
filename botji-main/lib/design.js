export const DESIGN_KEY = 'xagent.design';
export const PALETTES_KEY = 'xagent.design.palettes';

export const STYLES = [
  { id: 'minimal', name: 'Minimalis', brief: 'Banyak ruang kosong, tipografi besar, hampir tanpa dekorasi, garis tipis, satu warna aksen.' },
  { id: 'glass', name: 'Glassmorphism', brief: 'Kartu kaca transparan dengan backdrop-filter blur, border tipis semi-transparan, latar gradient lembut.' },
  { id: 'brutal', name: 'Neobrutalism', brief: 'Border hitam tebal, bayangan keras tanpa blur (offset), warna cerah kontras, sudut tegas, tipografi tebal.' },
  { id: 'darktech', name: 'Dark modern', brief: 'Latar gelap, aksen neon halus, glow lembut, grid rapi, kesan teknologi dan profesional.' },
  { id: 'editorial', name: 'Editorial', brief: 'Gaya majalah: font serif untuk judul, kolom teks nyaman dibaca, hierarki tipografi kuat, warna kalem.' },
  { id: 'playful', name: 'Playful', brief: 'Bentuk membulat besar, warna cerah, ilustrasi bentuk sederhana, animasi kecil yang ceria.' },
  { id: 'corporate', name: 'Korporat', brief: 'Bersih dan tepercaya, grid konsisten, biru atau netral, kartu dengan bayangan lembut, CTA jelas.' }
];

export const PALETTES = [
  { id: 'ocean', name: 'Ocean', primary: '#2563eb', accent: '#06b6d4', bg: '#0b1220', text: '#e6edf7' },
  { id: 'sunset', name: 'Sunset', primary: '#f97316', accent: '#ec4899', bg: '#1a0f14', text: '#fdeee6' },
  { id: 'forest', name: 'Forest', primary: '#16a34a', accent: '#a3e635', bg: '#0c1510', text: '#e8f5ea' },
  { id: 'violet', name: 'Violet', primary: '#7c3aed', accent: '#f0abfc', bg: '#120d1f', text: '#efe9fb' },
  { id: 'paper', name: 'Paper', primary: '#111827', accent: '#dc2626', bg: '#faf7f2', text: '#1f2937' },
  { id: 'mint', name: 'Mint', primary: '#0d9488', accent: '#fbbf24', bg: '#f0fdfa', text: '#134e4a' }
];

export const FONTS = [
  { id: 'system', name: 'System UI', css: 'system-ui, -apple-system, "Segoe UI", sans-serif', note: 'tanpa import font' },
  { id: 'inter', name: 'Inter', css: '"Inter", system-ui, sans-serif', gf: 'Inter:wght@400;500;600;700' },
  { id: 'poppins', name: 'Poppins', css: '"Poppins", system-ui, sans-serif', gf: 'Poppins:wght@400;500;600;700' },
  { id: 'space', name: 'Space Grotesk', css: '"Space Grotesk", system-ui, sans-serif', gf: 'Space+Grotesk:wght@400;500;700' },
  { id: 'playfair', name: 'Playfair + Inter', css: '"Inter", system-ui, sans-serif', head: '"Playfair Display", Georgia, serif', gf: 'Playfair+Display:wght@600;700&family=Inter:wght@400;500;600' },
  { id: 'mono', name: 'JetBrains Mono', css: '"JetBrains Mono", ui-monospace, monospace', gf: 'JetBrains+Mono:wght@400;600' }
];

export const RADII = [
  { id: 'sharp', name: 'Tajam', px: '2px' },
  { id: 'soft', name: 'Lembut', px: '10px' },
  { id: 'round', name: 'Bulat', px: '20px' },
  { id: 'pill', name: 'Pil', px: '999px' }
];

export const DENSITIES = [
  { id: 'compact', name: 'Rapat', brief: 'spasi rapat, padding section sekitar 48px' },
  { id: 'normal', name: 'Normal', brief: 'spasi seimbang, padding section sekitar 80px' },
  { id: 'airy', name: 'Lega', brief: 'spasi lega, padding section sekitar 128px' }
];

export const DEFAULT_DESIGN = {
  enabled: false,
  style: 'minimal',
  palette: 'ocean',
  custom: false,
  colors: { primary: '#2563eb', accent: '#06b6d4', bg: '#0b1220', text: '#e6edf7' },
  font: 'system',
  radius: 'soft',
  density: 'normal',
  note: ''
};

// ===== palet simpanan user (hasil foto / upload) =====

function cleanColor(value, fallback) {
  const v = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

export function loadSavedPalettes() {
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: p.id,
        name: p.name.slice(0, 24),
        primary: cleanColor(p.primary, DEFAULT_DESIGN.colors.primary),
        accent: cleanColor(p.accent, DEFAULT_DESIGN.colors.accent),
        bg: cleanColor(p.bg, DEFAULT_DESIGN.colors.bg),
        text: cleanColor(p.text, DEFAULT_DESIGN.colors.text),
        colors: Array.isArray(p.colors) ? p.colors.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 8) : []
      }))
      .slice(-12);
  } catch (e) {
    return [];
  }
}

export function saveSavedPalettes(list) {
  try {
    localStorage.setItem(PALETTES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    return true;
  } catch (e) {
    return false;
  }
}

export function allPalettes(saved) {
  const extra = Array.isArray(saved) ? saved : loadSavedPalettes();
  return [...PALETTES, ...extra];
}

export function loadDesign() {
  try {
    const raw = localStorage.getItem(DESIGN_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { ...DEFAULT_DESIGN, ...d, colors: { ...DEFAULT_DESIGN.colors, ...(d && d.colors) } };
    }
  } catch (e) {
    // abaikan
  }
  return { ...DEFAULT_DESIGN, colors: { ...DEFAULT_DESIGN.colors } };
}

export function saveDesign(d) {
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(d));
  } catch (e) {
    // abaikan
  }
}

const by = (list, id) => list.find((x) => x.id === id) || list[0];

export function designColors(d) {
  if (!d) return { ...DEFAULT_DESIGN.colors };
  if (d.custom) return { ...DEFAULT_DESIGN.colors, ...(d.colors || {}) };
  const p = by(PALETTES, d.palette);
  return { primary: p.primary, accent: p.accent, bg: p.bg, text: p.text };
}

// ===== ambil warna dari foto =====

function clamp255(n) {
  const v = Math.round(Number(n) || 0);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function hex2(n) {
  const s = clamp255(n).toString(16);
  return s.length === 1 ? `0${s}` : s;
}

function toHex(r, g, b) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

function hexToRgb(hex) {
  const v = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16)
  };
}

function lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sat(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === 0) return 0;
  return (mx - mn) / mx;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar tidak bisa dibaca.'));
    img.src = url;
  });
}

export async function extractColorsFromImage(file, max = 6) {
  if (!file) throw new Error('File kosong.');
  if (!/^image\//i.test(String(file.type || ''))) throw new Error('File harus gambar (jpg, png, webp).');

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) throw new Error('Ukuran gambar tidak terbaca.');

    const limit = 180;
    const scale = Math.min(1, limit / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    const bins = new Map();

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const cur = bins.get(key);
      if (cur) {
        cur.r += r;
        cur.g += g;
        cur.b += b;
        cur.n += 1;
      } else {
        bins.set(key, { r, g, b, n: 1 });
      }
    }

    const sorted = Array.from(bins.values())
      .map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }))
      .sort((a, b) => b.n - a.n);

    if (!sorted.length) throw new Error('Tidak ada warna yang terbaca dari foto.');

    const picked = [];
    for (const c of sorted) {
      if (picked.length >= max) break;
      const far = picked.every((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) > 48);
      if (far) picked.push(c);
    }
    if (!picked.length) picked.push(sorted[0]);

    return picked
      .map((c) => ({ hex: toHex(c.r, c.g, c.b), r: c.r, g: c.g, b: c.b }))
      .sort((a, b) => lum(b.r, b.g, b.b) - lum(a.r, a.g, a.b));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Susun 4 warna utama dari daftar warna hasil foto.
export function paletteFromColors(colors) {
  const list = (Array.isArray(colors) ? colors : [])
    .map((c) => {
      if (typeof c === 'string') {
        const rgb = hexToRgb(c);
        return rgb ? { ...rgb, hex: c.toLowerCase() } : null;
      }
      if (c && typeof c === 'object') {
        const rgb = hexToRgb(c.hex);
        if (rgb) return { ...rgb, hex: c.hex.toLowerCase() };
        if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
          return { r: c.r, g: c.g, b: c.b, hex: toHex(c.r, c.g, c.b) };
        }
      }
      return null;
    })
    .filter(Boolean);

  if (!list.length) return { ...DEFAULT_DESIGN.colors };

  const scored = list.map((c) => ({ ...c, l: lum(c.r, c.g, c.b), s: sat(c.r, c.g, c.b) }));
  const byLight = scored.slice().sort((a, b) => a.l - b.l);
  const darkest = byLight[0];
  const lightest = byLight[byLight.length - 1];
  const bySat = scored.slice().sort((a, b) => b.s - a.s);
  const vivid = bySat[0];
  const accent = bySat.find((c) => c.hex !== vivid.hex) || vivid;
  const avg = scored.reduce((acc, c) => acc + c.l, 0) / scored.length;
  const bg = avg < 140 ? darkest : lightest;
  const text = avg < 140 ? lightest : darkest;

  return {
    primary: vivid.hex,
    accent: accent.hex,
    bg: bg.hex,
    text: text.hex
  };
}

// ===== brief untuk AI =====

export function buildDesignBlock(d) {
  if (!d || !d.enabled) return '';

  const style = by(STYLES, d.style);
  const c = designColors(d);
  const font = by(FONTS, d.font);
  const radius = by(RADII, d.radius);
  const density = by(DENSITIES, d.density);
  const head = font.head || font.css;

  const fontLine = font.gf
    ? `Muat Google Fonts lewat <link href="https://fonts.googleapis.com/css2?family=${font.gf}&display=swap" rel="stylesheet">. Judul h1-h3 pakai ${head}; teks lain pakai ${font.css}.`
    : `Pakai font-family: ${font.css} untuk seluruh halaman, tanpa import font.`;

  const note = d.note && d.note.trim()
    ? `\n7. Catatan tambahan dari user: ${d.note.trim().slice(0, 500)}`
    : '';

  return `

=== BRIEF DESAIN (WAJIB, MENANG ATAS SELERA DEFAULT) ===
User sudah menetapkan desain ini. Terapkan persis, jangan diganti dengan selera defaultmu.

1. Gaya visual: ${style.name}. ${style.brief}
2. Palet warna. Pakai nilai hex PERSIS ini:
   --primary: ${c.primary};
   --accent: ${c.accent};
   --bg: ${c.bg};
   --text: ${c.text};
   Tulis ke dalam :root { ... } dan rujuk lewat var() di seluruh CSS.
3. Tipografi: ${fontLine}
4. Sudut: --radius: ${radius.px}; pakai var(--radius) di tombol, kartu, input, dan gambar.
5. Kepadatan: ${density.brief}.
6. Wajib terapkan tema: body { background: var(--bg); color: var(--text); }${note}

LARANGAN (dicek dulu sebelum kirim kode):
- Jangan memakai nilai hex lain untuk background, teks, tombol, border, atau aksen. Warna lain hanya boleh rgba() atau color-mix() yang diturunkan dari empat nilai di atas.
- Jangan mengganti font, radius, atau gaya visual dengan selera defaultmu.

CEK SEBELUM KIRIM:
- :root memuat keempat variabel dengan nilai persis seperti di atas.
- body memakai var(--bg) dan var(--text).
- Tombol dan link memakai var(--primary) atau var(--accent).
- Semua border-radius memakai var(--radius).
`;
}
