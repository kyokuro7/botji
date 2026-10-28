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
              .map((s) => {
                const item = {
                  id: s.id,
                  name: s.name,
                  desc: typeof s.desc === 'string' ? s.desc : '',
                  instruction: s.instruction,
                  scope: ['website', 'telegram', 'all'].includes(s.scope) ? s.scope : 'all',
                  custom: true
                };
                if (typeof s.source === 'string' && s.source) item.source = s.source;
                return item;
              })
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

// ===== impor skill dari GitHub =====

const GH_API = 'https://api.github.com';
const MAX_INSTRUCTION = 4000;
const MAX_SKILLS = 10;

function shortHash(input) {
  const s = String(input || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 6) || '0';
}

function slugify(input) {
  const s = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return s || 'skill';
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { accept: 'text/plain' } });
  if (!res.ok) throw new Error(`Gagal mengambil file (HTTP ${res.status}).`);
  return res.text();
}

async function ghJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/vnd.github+json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && typeof data.message === 'string' ? data.message : `GitHub error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function parseGitHubUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const rawHost = raw.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/([^\s?#]+)/i);
  if (rawHost) {
    return { owner: rawHost[1], repo: rawHost[2], branch: rawHost[3], path: rawHost[4], kind: 'blob' };
  }

  const gh = raw.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)(?:\/(blob|tree|raw)\/([^/\s]+)(?:\/([^\s?#]+))?)?/i
  );
  if (gh) {
    return {
      owner: gh[1],
      repo: gh[2].replace(/\.git$/i, ''),
      kind: gh[3] ? gh[3].toLowerCase() : '',
      branch: gh[4] || '',
      path: (gh[5] || '').replace(/[?#].*$/, '')
    };
  }

  const short = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (short) {
    return { owner: short[1], repo: short[2].replace(/\.git$/i, ''), kind: '', branch: '', path: '' };
  }

  return null;
}

function parseFrontmatter(text) {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const meta = {};
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta, body: src.trim() };

  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (!kv) continue;
    meta[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, '').trim();
  }

  return { meta, body: src.slice(m[0].length).trim() };
}

function firstParagraph(body) {
  const lines = String(body || '').split('\n');
  const buf = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('>')) {
      if (buf.length) break;
      continue;
    }
    buf.push(t);
    if (buf.join(' ').length > 120) break;
  }
  return buf.join(' ');
}

function skillFromMarkdown(text, fallbackName, source) {
  const { meta, body } = parseFrontmatter(text);
  if (!body) throw new Error('Isi file kosong.');

  const h1 = body.match(/^#\s+(.+)$/m);
  const name =
    (meta.name || (h1 && h1[1]) || fallbackName || 'Skill GitHub').replace(/[`*_]/g, '').trim().slice(0, 40) ||
    'Skill GitHub';

  const desc = (meta.description || firstParagraph(h1 ? body.replace(h1[0], '') : body))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  let instruction = body;
  if (h1) instruction = instruction.replace(h1[0], '').trim();
  instruction = instruction.slice(0, MAX_INSTRUCTION).trim();
  if (!instruction) throw new Error('File tidak berisi instruksi.');

  const scopeRaw = String(meta.scope || '').toLowerCase();
  const scope = ['website', 'telegram', 'all'].includes(scopeRaw) ? scopeRaw : 'all';

  return {
    id: `gh-${slugify(name)}-${shortHash(`${source}|${name}`)}`,
    name,
    desc,
    instruction,
    scope,
    custom: true,
    source
  };
}

function rawUrl(owner, repo, branch, path) {
  const parts = String(path || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${parts}`;
}

async function listContents(owner, repo, branch, path) {
  const parts = String(path || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const url = `${GH_API}/repos/${owner}/${repo}/contents${parts ? `/${parts}` : ''}?ref=${encodeURIComponent(branch)}`;
  const data = await ghJson(url);
  return Array.isArray(data) ? data : [data];
}

async function collectFolder(owner, repo, branch, path, out, depth) {
  if (out.length >= MAX_SKILLS) return;

  const items = await listContents(owner, repo, branch, path);
  const files = items.filter((it) => it.type === 'file' && /\.(md|markdown)$/i.test(it.name));
  const dirs = items.filter((it) => it.type === 'dir');

  const skillFile = files.find((it) => /^skill\.md$/i.test(it.name));
  const readme = files.find((it) => /^readme\.md$/i.test(it.name));

  let pick = [];
  if (skillFile) pick = [skillFile];
  else if (readme) pick = [readme];
  else pick = files.filter((it) => !/^readme\.md$/i.test(it.name)).slice(0, 3);

  for (const f of pick) {
    if (out.length >= MAX_SKILLS) return;
    try {
      const text = await fetchText(rawUrl(owner, repo, branch, f.path));
      out.push(skillFromMarkdown(text, f.name.replace(/\.[^.]+$/, ''), `github:${owner}/${repo}/${f.path}`));
    } catch (e) {
      // file tidak valid, lewati
    }
  }

  if (depth >= 2) return;

  for (const d of dirs.slice(0, 12)) {
    if (out.length >= MAX_SKILLS) return;
    try {
      await collectFolder(owner, repo, branch, d.path, out, depth + 1);
    } catch (e) {
      // folder tidak terbaca, lewati
    }
  }
}

export async function importSkillsFromGitHub(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Tempel URL GitHub dulu.');

  const gistId = (raw.match(/gist\.github\.com\/(?:[^/\s]+\/)?([a-f0-9]{8,})/i) || [])[1];
  if (gistId) {
    const data = await ghJson(`${GH_API}/gists/${gistId}`);
    const files = data && data.files ? data.files : {};
    const out = [];

    for (const fname of Object.keys(files)) {
      if (!/\.(md|markdown|txt)$/i.test(fname)) continue;
      const f = files[fname] || {};
      let content = typeof f.content === 'string' ? f.content : '';
      if (!content && f.raw_url) {
        try {
          content = await fetchText(f.raw_url);
        } catch (e) {
          content = '';
        }
      }
      if (!content.trim()) continue;
      try {
        out.push(skillFromMarkdown(content, fname.replace(/\.[^.]+$/, ''), `gist:${gistId}/${fname}`));
      } catch (e) {
        // lewati
      }
    }

    if (!out.length) throw new Error('Gist tidak berisi file .md yang bisa dipakai.');
    return out.slice(0, MAX_SKILLS);
  }

  const info = parseGitHubUrl(raw);
  if (!info) {
    throw new Error('URL tidak dikenali. Contoh: https://github.com/user/repo/blob/main/SKILL.md');
  }

  let branch = info.branch;
  if (!branch) {
    const repo = await ghJson(`${GH_API}/repos/${info.owner}/${info.repo}`);
    branch = repo.default_branch || 'main';
  }

  const path = (info.path || '').replace(/^\/+|\/+$/g, '');

  if (/\.(md|markdown|txt)$/i.test(path)) {
    const text = await fetchText(rawUrl(info.owner, info.repo, branch, path));
    const fallback = path.split('/').pop().replace(/\.[^.]+$/, '');
    return [skillFromMarkdown(text, fallback, `github:${info.owner}/${info.repo}/${path}`)];
  }

  const out = [];
  await collectFolder(info.owner, info.repo, branch, path, out, 0);
  if (!out.length) throw new Error('Tidak ada file .md yang bisa dijadikan skill di repo/folder itu.');
  return out.slice(0, MAX_SKILLS);
}
