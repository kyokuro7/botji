export const SETTINGS_KEY = 'xagent.settings';

export const DEFAULT_SETTINGS = {
  provider: 'openai',
  baseUrl: '',
  model: 'gpt-4o-mini',
  apiKey: '',
  askFirst: true
};

export const DEFAULT_MODEL = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5-5'
};

export function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {
    // localStorage rusak / diblokir
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false;
  }
}

// Ambil daftar model dari base URL lewat proxy /api/models.
export async function listModels(cfg) {
  const provider = cfg && cfg.provider === 'anthropic' ? 'anthropic' : 'openai';
  const baseUrl = cfg && typeof cfg.baseUrl === 'string' ? cfg.baseUrl.trim() : '';
  const apiKey = cfg && typeof cfg.apiKey === 'string' ? cfg.apiKey.trim() : '';

  if (!apiKey) throw new Error('API key belum diisi.');

  const res = await fetch('/api/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, baseUrl, apiKey })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Gagal memuat daftar model (${res.status}).`);
  }

  const list = Array.isArray(data.models) ? data.models : [];

  return list
    .filter((m) => m && typeof m.id === 'string' && m.id.trim())
    .map((m) => ({
      id: m.id.trim(),
      label: typeof m.label === 'string' && m.label.trim() ? m.label.trim() : m.id.trim()
    }));
}
