export const DESIGN_KEY = 'xagent.design';

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
  { id: 'compact', name: 'Rapat', brief: 'spasi rapat, section padding sekitar 48px' },
  { id: 'normal', name: 'Normal', brief: 'spasi seimbang, section padding sekitar 80px' },
  { id: 'airy', name: 'Lega', brief: 'spasi lega, section padding sekitar 128px' }
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
  return d.custom ? d.colors : by(PALETTES, d.palette);
}

export function buildDesignBlock(d) {
  if (!d || !d.enabled) return '';
  const style = by(STYLES, d.style);
  const c = designColors(d);
  const font = by(FONTS, d.font);
  const radius = by(RADII, d.radius);
  const density = by(DENSITIES, d.density);

  const fontLine = font.gf
    ? `${font.name}. Muat lewat <link> Google Fonts: https://fonts.googleapis.com/css2?family=${font.gf}&display=swap${font.head ? `. Judul (h1-h3) pakai ${font.head}, teks pakai ${font.css}` : `. font-family: ${font.css}`}`
    : `font-family: ${font.css}`;

  return `\n\nBRIEF DESAIN (wajib diikuti):
- Gaya: ${style.name}. ${style.brief}
- Warna: primary ${c.primary}, accent ${c.accent}, background ${c.bg}, teks ${c.text}. Definisikan sebagai CSS variables di :root (--primary, --accent, --bg, --text) dan pakai variabel itu di seluruh CSS.
- Tipografi: ${fontLine}
- Sudut: border-radius dasar ${radius.px} (--radius), pakai konsisten di tombol, kartu, input.
- Kepadatan: ${density.brief}.${d.note && d.note.trim() ? `\n- Catatan desain tambahan dari user: ${d.note.trim().slice(0, 500)}` : ''}
- Jaga kontras teks terhadap background tetap terbaca.`;
}
