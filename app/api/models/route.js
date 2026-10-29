export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MAX_MODELS = 300;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

function pickList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.models)) return data.models;
  return [];
}

function toModel(item) {
  if (typeof item === 'string') {
    const id = item.trim();
    return id ? { id, label: id } : null;
  }
  if (!item || typeof item !== 'object') return null;

  const rawId = item.id || item.name || item.model || '';
  const id = String(rawId).trim();
  if (!id) return null;

  const rawLabel = item.display_name || item.label || item.title || '';
  const label = String(rawLabel).trim();

  return { id, label: label || id };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return err('Body bukan JSON valid.');
  }

  const provider = body.provider === 'anthropic' ? 'anthropic' : 'openai';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';

  if (!apiKey) return err('API key kosong.');

  let url;
  let headers;

  if (provider === 'anthropic') {
    url = `${ANTHROPIC_BASE}/models?limit=100`;
    headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
  } else {
    const base = (baseUrl || OPENAI_BASE).replace(/\/+$/, '');
    url = `${base}/models`;
    headers = {
      authorization: `Bearer ${apiKey}`
    };
  }

  let upstream;
  try {
    upstream = await fetch(url, { headers });
  } catch (e) {
    return err(`Gagal menghubungi provider: ${e.message}`, 502);
  }

  const text = await upstream.text().catch(() => '');

  if (!upstream.ok) {
    return err(`Provider ${upstream.status}: ${text.slice(0, 600)}`, 502);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return err('Balasan provider bukan JSON.', 502);
  }

  const seen = new Set();
  const models = [];

  for (const item of pickList(data)) {
    const m = toModel(item);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    models.push(m);
  }

  models.sort((a, b) => a.id.localeCompare(b.id));

  return json({
    provider,
    endpoint: url,
    count: models.length,
    models: models.slice(0, MAX_MODELS)
  });
}
