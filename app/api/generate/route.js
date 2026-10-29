export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_BASE = 'https://api.openai.com/v1';
const MAX_IMAGES = 4;

function err(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function cleanImages(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .filter((img) => img && typeof img.dataUrl === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(img.dataUrl))
    .slice(0, MAX_IMAGES);
}

function openAiContent(text, images) {
  const parts = [];
  if (text) parts.push({ type: 'text', text });
  for (const img of images) {
    parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }
  return parts;
}

function anthropicContent(text, images) {
  const parts = [];
  for (const img of images) {
    const m = String(img.dataUrl).match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!m) continue;
    parts.push({ type: 'image', source: { type: 'base64', media_type: m[1].toLowerCase(), data: m[2] } });
  }
  if (text) parts.push({ type: 'text', text });
  return parts;
}

// Lampirkan gambar ke pesan user terakhir.
function attachImages(messages, images, provider) {
  if (!images.length) return messages;

  const list = messages.map((m) => ({ ...m }));
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].role !== 'user') continue;
    const text = String(list[i].content || '');
    list[i].content = provider === 'anthropic' ? anthropicContent(text, images) : openAiContent(text, images);
    break;
  }
  return list;
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
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const system = typeof body.system === 'string' ? body.system : '';
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
  const inputMessages = Array.isArray(body.messages) ? body.messages : [];
  const images = cleanImages(body.images);

  if (!apiKey) return err('API key kosong.');
  if (!model) return err('Model kosong.');

  const clean = inputMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: String(m.content || '') }))
    .filter((m) => m.content.length > 0);

  if (clean.length === 0) return err('Riwayat pesan kosong.');

  const withImages = attachImages(clean, images, provider);

  let url;
  let headers;
  let payload;

  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    payload = {
      model,
      max_tokens: 8192,
      temperature: 0.3,
      stream: true,
      messages: withImages
    };
    if (system) payload.system = system;
  } else {
    const base = (baseUrl || OPENAI_BASE).replace(/\/+$/, '');
    url = `${base}/chat/completions`;
    headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    };
    payload = {
      model,
      temperature: 0.3,
      stream: true,
      messages: system ? [{ role: 'system', content: system }, ...withImages] : withImages
    };
  }

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return err(`Gagal menghubungi provider: ${e.message}`, 502);
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return err(`Provider ${upstream.status}: ${text.slice(0, 600)}`, 502);
  }

  if (!upstream.body) return err('Provider tidak mengirim stream.', 502);

  const isAnthropic = provider === 'anthropic';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      let closed = false;

      const push = (text) => {
        if (!text || closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch (e) {
          closed = true;
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            let event;
            try {
              event = JSON.parse(data);
            } catch (e) {
              continue;
            }

            if (isAnthropic) {
              if (event.type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta') {
                push(event.delta.text || '');
              }
            } else {
              const choice = event.choices && event.choices[0];
              const delta = choice && choice.delta;
              if (delta && typeof delta.content === 'string') push(delta.content);
            }
          }
        }
      } catch (e) {
        // stream terputus, biarkan selesai
      } finally {
        closed = true;
        try {
          controller.close();
        } catch (e) {
          // sudah tertutup
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
