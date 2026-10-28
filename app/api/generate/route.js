export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_BASE = 'https://api.openai.com/v1';

function err(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
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

  if (!apiKey) return err('API key kosong.');
  if (!model) return err('Model kosong.');

  const clean = inputMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: String(m.content || '') }))
    .filter((m) => m.content.length > 0);

  if (clean.length === 0) return err('Riwayat pesan kosong.');

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
      messages: clean
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
      messages: system ? [{ role: 'system', content: system }, ...clean] : clean
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
