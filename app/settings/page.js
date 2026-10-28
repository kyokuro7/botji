'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DEFAULT_MODEL, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../lib/settings';

export default function SettingsPage() {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  function change(field, value) {
    setS((prev) => ({ ...prev, [field]: value }));
    setStatus(null);
  }

  function changeProvider(provider) {
    setS((prev) => {
      const unchanged = !prev.model.trim() || prev.model === DEFAULT_MODEL[prev.provider];
      return { ...prev, provider, model: unchanged ? DEFAULT_MODEL[provider] : prev.model };
    });
    setStatus(null);
  }

  function cleaned() {
    return { ...s, apiKey: s.apiKey.trim(), model: s.model.trim(), baseUrl: s.baseUrl.trim() };
  }

  function save() {
    const clean = cleaned();
    setS(clean);
    if (saveSettings(clean)) {
      setStatus({ type: 'ok', text: 'Tersimpan di browser ini.', saved: true });
    } else {
      setStatus({ type: 'err', text: 'Gagal menyimpan. Penyimpanan browser diblokir atau penuh.' });
    }
  }

  async function test() {
    const cfg = cleaned();
    if (!cfg.apiKey) return setStatus({ type: 'err', text: 'API key masih kosong.' });
    if (!cfg.model) return setStatus({ type: 'err', text: 'Model masih kosong.' });

    setTesting(true);
    setStatus({ type: 'info', text: 'Menguji koneksi...' });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: cfg.provider,
          baseUrl: cfg.baseUrl,
          model: cfg.model,
          apiKey: cfg.apiKey,
          system: '',
          messages: [{ role: 'user', content: 'Balas satu kata saja: ok' }]
        })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Request gagal (${res.status})`);
      }

      let out = '';
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          out += decoder.decode(value, { stream: true });
        }
      }

      const reply = out.trim().slice(0, 60);
      setStatus({ type: 'ok', text: reply ? `Koneksi berhasil. Balasan model: ${reply}` : 'Koneksi berhasil.' });
    } catch (e) {
      setStatus({ type: 'err', text: e.message || 'Koneksi gagal.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="sp-wrap">
      <div className="sp-head">
        <Link href="/" className="btn ghost">
          ← Studio
        </Link>
        <div className="brand">
          XAGENT <span>Setelan</span>
        </div>
      </div>

      <div className="sp-card">
        <div className="field">
          <label>Provider</label>
          <select value={s.provider} onChange={(e) => changeProvider(e.target.value)}>
            <option value="openai">OpenAI / OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div className="field">
          <label>Model</label>
          <input
            value={s.model}
            onChange={(e) => change('model', e.target.value)}
            placeholder={DEFAULT_MODEL[s.provider]}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label>API Key</label>
          <div className="sp-keyrow">
            <input
              type={showKey ? 'text' : 'password'}
              value={s.apiKey}
              onChange={(e) => change('apiKey', e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="button" className="btn ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Sembunyi' : 'Lihat'}
            </button>
          </div>
        </div>

        {s.provider === 'openai' && (
          <div className="field">
            <label>Base URL (opsional)</label>
            <input
              value={s.baseUrl}
              onChange={(e) => change('baseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className="sp-hint">
          Key disimpan di localStorage browser ini dan hanya diteruskan ke server aplikasi untuk memanggil provider.
          Tidak ditulis ke database atau log server.
        </div>

        <div className="sp-actions">
          <button type="button" className="btn" onClick={save}>
            Simpan
          </button>
          <button type="button" className="btn ghost" onClick={test} disabled={testing}>
            {testing ? 'Menguji...' : 'Tes koneksi'}
          </button>
        </div>

        {status && <div className={`sp-status ${status.type}`}>{status.text}</div>}

        {status && status.saved && (
          <Link href="/" className="btn sp-go">
            Lanjut ke Studio
          </Link>
        )}
      </div>
    </div>
  );
}
