'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import BotSimulator from '../components/BotSimulator';
import { buildPreview, extractBotJson, parseFiles } from '../lib/files';
import { BOT_SYSTEM, WEBSITE_SYSTEM } from '../lib/prompts';

const DEFAULT_SETTINGS = {
  provider: 'openai',
  baseUrl: '',
  model: 'gpt-4o-mini',
  apiKey: ''
};

const FENCE = '```';

export default function Page() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [mode, setMode] = useState('website');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [bot, setBot] = useState(null);
  const [streamText, setStreamText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('preview');
  const [activeFile, setActiveFile] = useState(0);
  const [showSettings, setShowSettings] = useState(true);
  const [rawOutput, setRawOutput] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('xagent.settings');
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      const savedChat = localStorage.getItem('xagent.chat');
      if (savedChat) {
        const c = JSON.parse(savedChat);
        setMessages(Array.isArray(c.messages) ? c.messages : []);
        setFiles(Array.isArray(c.files) ? c.files : []);
        setBot(c.bot || null);
        setMode(c.mode === 'telegram' ? 'telegram' : 'website');
      }
    } catch (e) {
      // localStorage rusak, abaikan
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('xagent.settings', JSON.stringify(settings));
    } catch (e) {
      // storage penuh / diblokir
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('xagent.chat', JSON.stringify({ messages, files, bot, mode }));
    } catch (e) {
      // storage penuh / diblokir
    }
  }, [messages, files, bot, mode]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, streamText, busy]);

  const previewHtml = useMemo(() => buildPreview(files), [files]);

  function update(field, value) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function newChat() {
    setMessages([]);
    setFiles([]);
    setBot(null);
    setStreamText('');
    setRawOutput('');
    setError('');
    setActiveFile(0);
    setTab('preview');
  }

  function currentFilesDump() {
    return files
      .map((f) => `File: ${f.path}\n${FENCE}${f.lang}\n${f.content}\n${FENCE}`)
      .join('\n\n');
  }

  async function generate() {
    const text = prompt.trim();
    if (!text) return;
    if (!settings.apiKey.trim()) {
      setError('API key belum diisi.');
      setShowSettings(true);
      return;
    }
    if (!settings.model.trim()) {
      setError('Model belum diisi.');
      setShowSettings(true);
      return;
    }

    let send = text;

    if (mode === 'website' && files.length > 0) {
      send = `Kode saat ini:\n\n${currentFilesDump()}\n\nPermintaan baru: ${text}\n\nKirim ulang SEMUA file secara lengkap.`;
    }

    if (mode === 'telegram' && bot) {
      send = `bot.json saat ini:\n${FENCE}json\n${JSON.stringify(bot, null, 2)}\n${FENCE}\n\nPermintaan baru: ${text}`;
    }

    const history = [...messages, { role: 'user', content: text, send }];

    setMessages(history);
    setPrompt('');
    setError('');
    setBusy(true);
    setStreamText('');
    setTab('preview');

    const system = mode === 'telegram' ? BOT_SYSTEM : WEBSITE_SYSTEM;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          baseUrl: settings.baseUrl,
          model: settings.model,
          apiKey: settings.apiKey,
          system,
          messages: history.map((m) => ({
            role: m.role,
            content: m.send || m.content
          }))
        })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Request gagal (${res.status})`);
      }

      if (!res.body) throw new Error('Respons tidak punya body.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamText(acc);
      }

      setRawOutput(acc);
      const parsed = parseFiles(acc);

      if (parsed.length === 0) {
        throw new Error('AI tidak mengembalikan file dengan format yang dikenali. Lihat tab Kode.');
      }

      if (mode === 'telegram') {
        const result = extractBotJson(parsed);
        if (result.error) throw new Error(result.error);
        setBot(result.bot);
        setFiles(parsed);
        setActiveFile(0);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `bot.json diperbarui. ${Object.keys(result.bot.screens).length} menu siap diuji.` }
        ]);
      } else {
        if (!parsed.some((f) => /\.html?$/i.test(f.path))) {
          throw new Error('Tidak ada index.html di hasil AI. Preview tidak bisa dibuat.');
        }
        setFiles(parsed);
        setActiveFile(0);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Selesai. ${parsed.length} file: ${parsed.map((f) => f.path).join(', ')}` }
        ]);
      }
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan.');
      setMessages((prev) => [...prev, { role: 'assistant', content: `Gagal: ${e.message}` }]);
    } finally {
      setBusy(false);
      setStreamText('');
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadChat() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const lines = [
      '# Percakapan XAGENT AI Studio',
      '',
      `Mode: ${mode}`,
      `Provider: ${settings.provider}`,
      `Model: ${settings.model}`,
      `Waktu: ${new Date().toISOString()}`,
      '',
      '## Riwayat Chat',
      ''
    ];

    for (const m of messages) {
      lines.push(`### ${m.role === 'user' ? 'User' : 'AI'}`);
      lines.push('');
      lines.push(m.content);
      lines.push('');
    }

    if (files.length > 0) {
      lines.push('## File Hasil Generasi');
      lines.push('');
      for (const f of files) {
        lines.push(`### ${f.path}`);
        lines.push('');
        lines.push(`${FENCE}${f.lang}`);
        lines.push(f.content);
        lines.push(FENCE);
        lines.push('');
      }
    }

    if (bot) {
      lines.push('## bot.json');
      lines.push('');
      lines.push(`${FENCE}json`);
      lines.push(JSON.stringify(bot, null, 2));
      lines.push(FENCE);
      lines.push('');
    }

    download(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), `chat-${stamp}.md`);
  }

  function downloadFile(file) {
    download(new Blob([file.content], { type: 'text/plain;charset=utf-8' }), file.path);
  }

  const active = files[activeFile] || null;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          XAGENT <span>AI Studio</span>
        </div>

        <div className="pill">
          <button
            type="button"
            className={mode === 'website' ? 'active' : ''}
            onClick={() => setMode('website')}
          >
            Website
          </button>
          <button
            type="button"
            className={mode === 'telegram' ? 'active' : ''}
            onClick={() => setMode('telegram')}
          >
            Bot Telegram
          </button>
        </div>

        <div className="spacer" />

        <button type="button" className="btn ghost" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'Tutup setelan' : 'Setelan'}
        </button>
        <button type="button" className="btn ghost" onClick={downloadChat} disabled={messages.length === 0}>
          Download chat
        </button>
        <button type="button" className="btn ghost" onClick={newChat}>
          Chat baru
        </button>
      </div>

      {showSettings && (
        <>
          <div className="settings">
            <div className="field">
              <label>Provider</label>
              <select
                value={settings.provider}
                onChange={(e) => update('provider', e.target.value)}
              >
                <option value="openai">OpenAI / OpenAI-compatible</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div className="field">
              <label>Model</label>
              <input
                value={settings.model}
                onChange={(e) => update('model', e.target.value)}
                placeholder={settings.provider === 'anthropic' ? 'claude-3-5-sonnet-latest' : 'gpt-4o-mini'}
              />
            </div>

            <div className="field">
              <label>API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => update('apiKey', e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>

            {settings.provider === 'openai' && (
              <div className="field">
                <label>Base URL (opsional)</label>
                <input
                  value={settings.baseUrl}
                  onChange={(e) => update('baseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            )}
          </div>
          <div className="hint">
            Key disimpan di localStorage browser ini dan hanya diteruskan ke serverless proxy untuk memanggil provider.
            Tidak ditulis ke database atau log server.
          </div>
        </>
      )}

      <div className="main">
        <div className="panel">
          <div className="panel-head">Chat</div>

          <div className="chat" ref={chatRef}>
            {messages.length === 0 && !busy && (
              <div className="empty">
                {mode === 'website'
                  ? 'Contoh: buat landing page portofolio dark mode, ada hero, skill, kontak.'
                  : 'Contoh: bot toko online, menu katalog, cek ongkir, jam buka, kontak admin.'}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                {m.content}
              </div>
            ))}

            {busy && <div className="msg stream">{streamText || 'menulis...'}</div>}
          </div>

          {error && <div className="err">{error}</div>}

          <div className="composer">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'website' ? 'Mau bikin website apa?' : 'Mau bikin bot apa?'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
              }}
            />
            <div className="composer-row">
              <span style={{ fontSize: 12, color: '#7d879c' }}>Ctrl+Enter kirim</span>
              <div className="spacer" />
              <button type="button" className="btn" onClick={generate} disabled={busy || !prompt.trim()}>
                {busy ? 'Memproses...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="tabs">
              <button
                type="button"
                className={tab === 'preview' ? 'active' : ''}
                onClick={() => setTab('preview')}
              >
                Preview
              </button>
              <button
                type="button"
                className={tab === 'code' ? 'active' : ''}
                onClick={() => setTab('code')}
              >
                Kode
              </button>
            </div>
            <div className="spacer" />
            {active && (
              <button type="button" className="btn ghost" onClick={() => downloadFile(active)}>
                Unduh file
              </button>
            )}
          </div>

          {tab === 'preview' && (
            <div className="preview-wrap">
              {mode === 'telegram' ? (
                bot ? (
                  <BotSimulator bot={bot} />
                ) : (
                  <div className="empty">Belum ada bot. Generate dulu.</div>
                )
              ) : previewHtml ? (
                <iframe
                  title="preview"
                  srcDoc={previewHtml}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              ) : (
                <div className="empty">Belum ada preview. Generate dulu.</div>
              )}
            </div>
          )}

          {tab === 'code' && (
            <div className="code-wrap">
              {files.length > 0 && (
                <div className="filebar">
                  {files.map((f, i) => (
                    <button
                      key={f.path}
                      type="button"
                      className={i === activeFile ? 'active' : ''}
                      onClick={() => setActiveFile(i)}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
              )}

              {active ? (
                <pre className="code">{active.content}</pre>
              ) : rawOutput ? (
                <>
                  <div className="filebar">
                    <span style={{ fontSize: 12, color: '#7d879c' }}>Output mentah AI</span>
                  </div>
                  <pre className="code">{rawOutput}</pre>
                </>
              ) : (
                <div className="empty">Belum ada kode.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
