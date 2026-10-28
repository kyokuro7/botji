// Skill = paket instruksi yang bisa dinyalakan/dimatikan dan disisipkan ke system prompt.
// scope: 'website' | 'telegram' | 'all'

export const SKILLS_KEY = 'xagent.skills';

export const BUILTIN_SKILLS = [
  {
    id: 'seo',
    scope: 'website',
    name: 'SEO dasar',
    desc: 'Meta tag, Open Graph, heading rapi',
    instruction:
      'Terapkan SEO dasar: <title> dan meta description yang relevan, meta viewport, Open Graph (og:title, og:description), satu <h1> saja, urutan heading logis, atribut alt di semua gambar, dan elemen semantik (header, main, section, footer).'
  },
  {
    id: 'a11y',
    scope: 'website',
    name: 'Aksesibilitas',
    desc: 'Kontras, fokus, label, ARIA',
    instruction:
      'Terapkan aksesibilitas: kontras teks minimal 4.5:1, state :focus-visible yang jelas, label untuk semua input, aria-label untuk tombol berisi ikon saja, navigasi bisa dipakai lewat keyboard, dan hormati prefers-reduced-motion.'
  },
  {
    id: 'animation',
    scope: 'website',
    name: 'Animasi halus',
    desc: 'Scroll reveal, hover, transisi',
    instruction:
      'Tambahkan animasi halus tanpa library berat: efek reveal saat scroll memakai IntersectionObserver, transisi hover pada tombol dan kartu, durasi 150 sampai 400ms. Matikan animasi lewat @media (prefers-reduced-motion: reduce).'
  },
  {
    id: 'mobile-first',
    scope: 'website',
    name: 'Mobile-first',
    desc: 'Layout utama untuk layar HP',
    instruction:
      'Rancang mobile-first: tulis CSS dasar untuk layar kecil lalu perbesar dengan min-width media query. Target sentuh minimal 44px, tidak ada scroll horizontal, font body minimal 16px, grid/flex yang bisa turun jadi satu kolom.'
  },
  {
    id: 'darkmode',
    scope: 'website',
    name: 'Dark mode toggle',
    desc: 'Tombol ganti tema terang/gelap',
    instruction:
      'Sediakan dark mode dengan CSS variables dan tombol toggle tema di header. Ikuti prefers-color-scheme sebagai nilai awal. Jangan pakai localStorage; cukup simpan state di variabel JS.'
  },
  {
    id: 'forms',
    scope: 'website',
    name: 'Form + validasi',
    desc: 'Validasi sisi klien dan pesan error',
    instruction:
      'Untuk setiap form: validasi di sisi klien (required, format email, panjang minimal), tampilkan pesan error di bawah field dalam bahasa Indonesia, nonaktifkan tombol saat submit, dan tampilkan pesan sukses. Gunakan preventDefault dan jangan kirim ke server sungguhan.'
  },
  {
    id: 'perf',
    scope: 'website',
    name: 'Performa ringan',
    desc: 'Tanpa framework, aset seminimal mungkin',
    instruction:
      'Utamakan performa: tanpa framework JS, sedikit dependensi CDN, loading="lazy" untuk gambar, gambar placeholder dari SVG inline atau gradient, dan hindari CSS/JS yang tidak dipakai.'
  },
  {
    id: 'copy-id',
    scope: 'website',
    name: 'Copywriting Indonesia',
    desc: 'Teks nyata, bukan lorem ipsum',
    instruction:
      'Tulis semua teks dalam bahasa Indonesia yang natural dan meyakinkan sesuai konteks. Dilarang memakai lorem ipsum. Judul singkat dan kuat, CTA jelas dan spesifik.'
  },
  {
    id: 'admin',
    scope: 'telegram',
    name: 'Panel admin',
    desc: 'Perintah khusus admin',
    instruction:
      'Tambahkan fitur admin: daftar ADMIN_IDS dibaca dari environment variable (pisah koma), perintah /admin yang hanya bisa diakses admin, statistik pengguna, dan penolakan sopan untuk non-admin.'
  },
  {
    id: 'storage',
    scope: 'telegram',
    name: 'Simpan data (JSON)',
    desc: 'Data user tersimpan di file',
    instruction:
      'Simpan data pengguna dan pesanan ke file data.json dengan helper baca/tulis yang aman (cek file ada, tangani JSON rusak, tulis atomik lewat file sementara). Jangan perlu database eksternal.'
  },
  {
    id: 'broadcast',
    scope: 'telegram',
    name: 'Broadcast',
    desc: 'Kirim pesan massal oleh admin',
    instruction:
      'Tambahkan perintah /broadcast <pesan> khusus admin yang mengirim pesan ke semua pengguna tersimpan. Beri jeda kecil antar kirim (sekitar 50ms) untuk menghindari rate limit dan tangani user yang memblokir bot.'
  },
  {
    id: 'antispam',
    scope: 'telegram',
    name: 'Anti spam',
    desc: 'Batasi pesan beruntun',
    instruction:
      'Tambahkan pembatas laju per user (misal maksimal 5 pesan per 10 detik). Jika melewati batas, balas peringatan singkat sekali lalu abaikan pesan berikutnya sampai jendela waktu habis.'
  },
  {
    id: 'multilang',
    scope: 'telegram',
    name: 'Multi bahasa',
    desc: 'Indonesia dan Inggris',
    instruction:
      'Dukung dua bahasa (Indonesia dan Inggris). Sediakan tombol pilih bahasa di /start, simpan pilihan per user, dan simpan semua teks di objek terjemahan terpusat, bukan di-hardcode di handler.'
  }
];

export function skillsForMode(mode, custom = []) {
  const m = mode === 'telegram' ? 'telegram' : 'website';
  return [...BUILTIN_SKILLS, ...custom].filter((s) => s.scope === 'all' || s.scope === m);
}

export function loadSkillState() {
  try {
    const raw = localStorage.getItem(SKILLS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return {
        active: Array.isArray(d.active) ? d.active.filter((x) => typeof x === 'string') : [],
        custom: Array.isArray(d.custom)
          ? d.custom
              .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.instruction === 'string')
              .map((s) => ({
                id: s.id,
                name: s.name,
                desc: typeof s.desc === 'string' ? s.desc : '',
                instruction: s.instruction,
                scope: ['website', 'telegram', 'all'].includes(s.scope) ? s.scope : 'all',
                custom: true
              }))
          : []
      };
    }
  } catch (e) {
    // abaikan
  }
  return { active: [], custom: [] };
}

export function saveSkillState(state) {
  try {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(state));
  } catch (e) {
    // storage penuh / diblokir
  }
}

// Blok teks yang ditempel ke system prompt.
export function buildSkillBlock(mode, state) {
  const list = skillsForMode(mode, state.custom).filter((s) => state.active.includes(s.id));
  if (list.length === 0) return '';
  const lines = list.map((s, i) => `${i + 1}. ${s.name}: ${s.instruction}`);
  return `\n\nSKILL AKTIF (wajib diterapkan di hasil akhir, selama tidak bertentangan dengan aturan output di atas):\n${lines.join('\n')}`;
}
