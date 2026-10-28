'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import BotSimulator from '../components/BotSimulator';
import DesignModal from '../components/DesignModal';
import SkillsModal from '../components/SkillsModal';
import { buildPreview, extractBotJson, parseFiles, splitReply } from '../lib/files';
import { buildDesignBlock, loadDesign, saveDesign, DEFAULT_DESIGN } from '../lib/design';
import { getBotSystem, getClarifySystem, getWebsiteSystem } from '../lib/prompts';
import { buildSkillBlock, loadSkillState, saveSkillState, skillsForMode } from '../lib/skills';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/settings';

const FENCE = '```';
const EXPORT_APP = 'xagent-ai-studio';
const EXPORT_VERSION = 1;
const BOT_LANGS = ['auto', 'javascript', 'python'];

function isBotJson(f) {
  return /(^|\/)bot\.json$/i.test(f.path);
}

function parseQuestions(raw) {
  const src = String(raw || '');
  const a = src.indexOf('{');
  const b = src.lastIndexOf('}');
  if (a < 0 || b <= a) return null;

  let data;
  try {
    data = JSON.parse(src.slice(a, b + 1));
  } catch (e) {
    return null;
  }

  const list = data && Array.isArray(data.questions) ? data.questions : [];
  const out = list
    .map((q) => {
      const question = q && typeof q.question === 'string' ? q.question.trim() : '';
      const options =
        q && Array.isArray(q.options)
          ? q.options.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim()).slice(0, 6)
          : [];
      return { question, options, multiple: !!(q && q.multiple === true) };
    })
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, 5);

  return out.length > 0 ? out : null;
}

function cleanMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => {
      const out = { role: m.role, content: m.content };
      if (m.role === 'user' && typeof m.send === 'string') out.send = m.send;
      return out;
    });
}

function cleanFiles(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string')
    .map((f) => ({
      path: f.path,
      lang: typeof f.lang === 'string' ? f.lang : 'text',
      content: f.content
    }));
}

export default function Page() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [mode, setMode] = useState('website');
  const [botLang, setBotLang] = useState('auto');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [bot, setBot] = useState(null);
  const [streamText, setStreamText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const [clarify, setClarify] = useState(null);
  const [tab, setTab] = useState('preview');
  const [activeFile, setActiveFile] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [mobileView, setMobileView] = useState('chat');
  const [menuOpen, setMenuOpen] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const [skillState, setSkillState] = useState({ active: [], custom: [] });
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [modal, setModal] = useState('');
  const [device, setDevice] = useState('desktop');
  const chatRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => {
    setSettings(loadSettings());
    setSkillState(loadSkillState());
    setDesign(loadDesign());
    try {
      const savedChat = localStorage.getItem('xagent.chat');
      if (savedChat) {
        const c = JSON.parse(savedChat);
        setMessages(Array.isArray(c.messages) ? c.messages : []);
        setFiles(Array.isArray(c.files) ? c.files : []);
        setBot(c.bot || null);
        setMode(c.mode === 'telegram' ? 'telegram' : 'website');
        setBotLang(BOT_LANGS.includes(c.botLang) ? c.botLang : 'auto');
      }
    } catch (e) {
      // localStorage rusak, abaikan
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('xagent.chat', JSON.stringify({ messages, files, bot, mode, botLang }));
    } catch (e) {
      // storage penuh / diblokir
    }
  }, [hydrated, messages, files, bot, mode, botLang]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, streamText, busy, asking, clarify]);

  const previewHtml = useMemo(() => buildPreview(files), [files]);

  function changeSkills(next) {
    setSkillState(next);
    saveSkillState(next);
  }

  function changeDesign(next) {
    setDesign(next);
    saveDesign(next);
  }

  const activeSkillCount = skillsForMode(mode, skillState.custom).filter((s) => skillState.active.includes(s.id)).length;

  function update(field, value) {
    const next = { ...settings, [field]: value };
    setSettings(next);
    saveSettings(next);
  }

  function newChat() {
    setMessages([]);
    setFiles([]);
    setBot(null);
    setStreamText('');
    setRawOutput('');
    setError('');
    setClarify(null);
    setAsking(false);
    setActiveFile(0);
    setTab('preview');
    setMobileView('chat');
  }

  function switchMode(next) {
    if (clarify) {
      setPrompt(clarify.text);
      setClarify(null);
    }
    setMode(next);
  }

  function currentFilesDump() {
    return files
      .map((f) => `File: ${f.path}\n${FENCE}${f.lang}\n${f.content}\n${FENCE}`)
      .join('\n\n');
  }

  async function streamAI(system, history, onChunk) {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: settings.apiKey,
        system,
        messages: history
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
      if (onChunk) onChunk(acc);
    }

    return acc;
  }

  function hasProject() {
    if (mode === 'telegram') return files.some(isBotJson) || !!bot;
    return files.some((f) => /\.html?$/i.test(f.path));
  }

  async function submit() {
    const text = prompt.trim();
    if (!text || busy || asking || clarify) return;

    if (!settings.apiKey.trim()) {
      setError('API key belum diisi. Buka Setelan untuk mengisinya.');
      return;
    }
    if (!settings.model.trim()) {
      setError('Model belum diisi. Buka Setelan untuk mengisinya.');
      return;
    }

    if (settings.askFirst && !hasProject()) {
      await startClarify(text);
    } else {
      setPrompt('');
      await runGenerate(text);
    }
  }

  async function startClarify(text) {
    setAsking(true);
    setError('');

    let questions = null;
    try {
      const raw = await streamAI(getClarifySystem(mode, botLang), [{ role: 'user', content: text }]);
      questions = parseQuestions(raw);
    } catch (e) {
      setError(e.message || 'Gagal menyiapkan pertanyaan.');
      setAsking(false);
      return;
    }

    setAsking(false);

    if (!questions) {
      // AI tidak mengirim pertanyaan yang valid: langsung generate saja
      setPrompt('');
      await runGenerate(text);
      return;
    }

    setPrompt('');
    setClarify({
      text,
      questions,
      answers: questions.map(() => ({ picked: [], other: '' }))
    });
  }

  function togglePick(qi, oi) {
    setClarify((prev) => {
      if (!prev) return prev;
      const multiple = prev.questions[qi].multiple;
      const answers = prev.answers.map((a, i) => {
        if (i !== qi) return a;
        if (multiple) {
          const picked = a.picked.includes(oi) ? a.picked.filter((x) => x !== oi) : [...a.picked, oi];
          return { ...a, picked };
        }
        return { picked: [oi], other: '' };
      });
      return { ...prev, answers };
    });
  }

  function setOther(qi, value) {
    setClarify((prev) => {
      if (!prev) return prev;
      const multiple = prev.questions[qi].multiple;
      const answers = prev.answers.map((a, i) => {
        if (i !== qi) return a;
        return multiple ? { ...a, other: value } : { picked: value.trim() ? [] : a.picked, other: value };
      });
      return { ...prev, answers };
    });
  }

  const clarifyReady =
    !!clarify && clarify.answers.every((a) => a.picked.length > 0 || a.other.trim().length > 0);

  async function confirmClarify() {
    if (!clarify || !clarifyReady || busy) return;

    const lines = clarify.questions.map((q, i) => {
      const a = clarify.answers[i];
      const parts = a.picked.map((oi) => q.options[oi]);
      if (a.other.trim()) parts.push(a.other.trim());
      return `- ${q.question} ${parts.join(', ')}`;
    });

    const full = `${clarify.text}\n\nPilihan saya:\n${lines.join('\n')}`;
    setClarify(null);
    await runGenerate(full);
  }

  function skipClarify() {
    if (!clarify || busy) return;
    const text = clarify.text;
    setClarify(null);
    runGenerate(text);
  }

  function cancelClarify() {
    if (!clarify) return;
    setPrompt(clarify.text);
    setClarify(null);
  }

  async function runGenerate(text) {
    let send = text;

    const hasWebsite = files.some((f) => /\.html?$/i.test(f.path));
    const hasBotProject = files.some(isBotJson);

    if (mode === 'website' && hasWebsite) {
      send = `Kode saat ini:\n\n${currentFilesDump()}\n\nPermintaan baru: ${text}\n\nKirim ulang SEMUA file secara lengkap.`;
    }

    if (mode === 'telegram' && hasBotProject) {
      send = `Kode saat ini:\n\n${currentFilesDump()}\n\nPermintaan baru: ${text}\n\nKirim ulang SEMUA file secara lengkap (kode bot, dependensi, .env.example, dan bot.json).`;
    } else if (mode === 'telegram' && bot) {
      send = `bot.json saat ini:\n${FENCE}json\n${JSON.stringify(bot, null, 2)}\n${FENCE}\n\nPermintaan baru: ${text}\n\nBuat kode bot asli lengkap beserta bot.json.`;
    }

    const history = [...messages, { role: 'user', content: text, send }];

    setMessages(history);
    setPrompt('');
    setError('');
    setBusy(true);
    setStreamText('');
    setTab('preview');

    const skillBlock = buildSkillBlock(mode, skillState);
    const system =
      mode === 'telegram'
        ? getBotSystem(botLang, skillBlock)
        : getWebsiteSystem(`${skillBlock}${buildDesignBlock(design)}`);

    try {
      const acc = await streamAI(
        system,
        history.map((m) => ({ role: m.role, content: m.send || m.content })),
        setStreamText
      );

      setRawOutput(acc);
      const parsed = parseFiles(acc);
      const { reply } = splitReply(acc);

      if (parsed.length === 0) {
        if (reply) {
          // AI hanya menjawab dengan teks (misal bertanya balik): tampilkan sebagai chat
          setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
          return;
        }
        throw new Error('AI tidak mengembalikan file dengan format yang dikenali. Lihat tab Kode.');
      }

      if (mode === 'telegram') {
        // kode utama di depan, bot.json (preview) di belakang
        const ordered = [...parsed.filter((f) => !isBotJson(f)), ...parsed.filter(isBotJson)];
        const result = extractBotJson(ordered);
        const list = ordered.map((f) => f.path).join(', ');

        setFiles(ordered);
        setActiveFile(0);

        if (result.error) {
          setError(`Kode bot terbuat, tapi preview gagal: ${result.error}`);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `${reply ? `${reply}\n\n` : ''}${ordered.length} file masuk ke tab Kode: ${list}.\nPreview bot belum bisa dibuat: ${result.error}`
            }
          ]);
        } else {
          setBot(result.bot);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `${reply ? `${reply}\n\n` : ''}${ordered.length} file masuk ke tab Kode: ${list}.\nPreview: ${Object.keys(result.bot.screens).length} menu siap diuji.`
            }
          ]);
        }
      } else {
        if (!parsed.some((f) => /\.html?$/i.test(f.path))) {
          throw new Error('Tidak ada index.html di hasil AI. Preview tidak bisa dibuat.');
        }
        setFiles(parsed);
        setActiveFile(0);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${reply ? `${reply}\n\n` : ''}${parsed.length} file masuk ke tab Kode: ${parsed.map((f) => f.path).join(', ')}.`
          }
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

  function exportChat() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const data = {
      app: EXPORT_APP,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      mode,
      botLang,
      provider: settings.provider,
      model: settings.model,
      messages,
      files,
      bot
    };
    download(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
      `chat-xagent-${stamp}.json`
    );
  }

  async function importChat(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || busy || asking) return;

    try {
      const data = JSON.parse(await file.text());
      const msgs = cleanMessages(data && data.messages);
      if (!data || data.app !== EXPORT_APP || msgs.length === 0) {
        throw new Error('File bukan hasil export chat XAGENT.');
      }

      if (messages.length > 0 && !window.confirm('Chat saat ini akan diganti dengan chat dari file. Lanjut?')) {
        return;
      }

      const importedMode = data.mode === 'telegram' ? 'telegram' : 'website';
      const importedFiles = cleanFiles(data.files);
      let importedBot = null;

      if (importedMode === 'telegram') {
        importedBot = extractBotJson(importedFiles).bot;
        if (!importedBot && data.bot && typeof data.bot === 'object' && data.bot.screens) {
          importedBot = data.bot;
        }
      }

      setMode(importedMode);
      setBotLang(BOT_LANGS.includes(data.botLang) ? data.botLang : 'auto');
      setMessages(msgs);
      setFiles(importedFiles);
      setBot(importedBot);
      setStreamText('');
      setRawOutput('');
      setError('');
      setClarify(null);
      setActiveFile(0);
      setTab('preview');
    } catch (err) {
      setError(`Import gagal: ${err.message || 'file tidak bisa dibaca.'}`);
    }
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
            onClick={() => switchMode('website')}
          >
            Website
          </button>
          <button
            type="button"
            className={mode === 'telegram' ? 'active' : ''}
            onClick={() => switchMode('telegram')}
          >
            Bot Telegram
          </button>
        </div>

        <div className="spacer" />

        <button
          type="button"
          className="btn ghost menu-btn"
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ⋯
        </button>

        <div className={`actions ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
          <Link href="/settings" className="btn ghost">
            Setelan
          </Link>
          <button type="button" className="btn ghost" onClick={exportChat} disabled={messages.length === 0}>
            Export chat
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => importRef.current && importRef.current.click()}
            disabled={busy || asking}
          >
            Import chat
          </button>
          <button type="button" className="btn ghost" onClick={newChat}>
            Chat baru
          </button>
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          onChange={importChat}
          style={{ display: 'none' }}
        />
      </div>

      {hydrated && !settings.apiKey.trim() && (
        <div className="notice">
          API key belum diisi. <Link href="/settings">Buka Setelan</Link>
        </div>
      )}

      <div className="main" data-view={mobileView}>
        <div className="panel panel-chat">
          <div className="panel-head">Chat</div>

          <div className="chat" ref={chatRef}>
            {messages.length === 0 && !busy && (
              <div className="empty">
                {mode === 'website'
                  ? 'Contoh: buat landing page portofolio dark mode, ada hero, skill, kontak.'
                  : 'Contoh: bot toko online pakai index.js, menu katalog, cek ongkir, jam buka, kontak admin.'}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                {m.content}
              </div>
            ))}

            {busy && (() => {
              const live = splitReply(streamText);
              return (
                <>
                  {live.reply && <div className="msg bot">{live.reply}</div>}
                  <div className="msg stream">
                    {live.writing ? `menulis ${live.writing}...` : live.reply ? 'menyiapkan file...' : 'berpikir...'}
                  </div>
                </>
              );
            })()}

            {asking && <div className="msg stream">menyiapkan pertanyaan...</div>}

            {clarify && (
              <div className="clarify">
                <div className="clarify-title">Beberapa pertanyaan dulu sebelum mulai</div>
                <div className="clarify-ask">{clarify.text}</div>

                {clarify.questions.map((q, qi) => (
                  <div key={qi} className="clarify-q">
                    <div className="clarify-qtext">
                      {qi + 1}. {q.question}
                      {q.multiple && <span className="clarify-tag">boleh lebih dari satu</span>}
                    </div>
                    <div className="clarify-opts">
                      {q.options.map((opt, oi) => {
                        const on = clarify.answers[qi].picked.includes(oi);
                        return (
                          <label key={oi} className={`clarify-opt ${on ? 'on' : ''}`}>
                            <input
                              type={q.multiple ? 'checkbox' : 'radio'}
                              name={`clarify-${qi}`}
                              checked={on}
                              onChange={() => togglePick(qi, oi)}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    <input
                      className="clarify-other"
                      value={clarify.answers[qi].other}
                      onChange={(e) => setOther(qi, e.target.value)}
                      placeholder="Lainnya (ketik sendiri)"
                    />
                  </div>
                ))}

                <div className="clarify-actions">
                  <button type="button" className="btn ghost" onClick={cancelClarify}>
                    Batal
                  </button>
                  <button type="button" className="btn ghost" onClick={skipClarify}>
                    Lewati
                  </button>
                  <div className="spacer" />
                  <button type="button" className="btn" onClick={confirmClarify} disabled={!clarifyReady || busy}>
                    Kirim
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <div className="err">{error}</div>}

          <div className="composer">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'website' ? 'Mau bikin website apa?' : 'Mau bikin bot apa?'}
              disabled={!!clarify || asking}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
              }}
            />
            <div className="composer-row">
              {mode === 'telegram' && (
                <select
                  className="lang-select"
                  value={botLang}
                  onChange={(e) => setBotLang(e.target.value)}
                  title="Bahasa kode bot"
                >
                  <option value="auto">Bahasa: auto</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                </select>
              )}
              <button type="button" className="btn ghost sm" onClick={() => setModal('skills')}>
                Skill{activeSkillCount > 0 ? ` (${activeSkillCount})` : ''}
              </button>
              {mode === 'website' && (
                <button type="button" className="btn ghost sm" onClick={() => setModal('design')}>
                  Desain{design.enabled ? ' ✓' : ''}
                </button>
              )}
              <label style={{ fontSize: 12, color: '#7d879c', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!settings.askFirst}
                  onChange={(e) => update('askFirst', e.target.checked)}
                />
                Tanya dulu
              </label>
              <div className="spacer" />
              <button
                type="button"
                className="btn"
                onClick={submit}
                disabled={busy || asking || !!clarify || !prompt.trim()}
              >
                {asking ? 'Menyiapkan...' : busy ? 'Memproses...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        <div className="panel panel-result">
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
            {tab === 'preview' && mode === 'website' && previewHtml && (
              <div className="devices">
                {[
                  ['desktop', 'Desktop'],
                  ['tablet', 'Tablet'],
                  ['mobile', 'HP']
                ].map(([id, label]) => (
                  <button key={id} type="button" className={device === id ? 'active' : ''} onClick={() => setDevice(id)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
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
                  className={`frame-${device}`}
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

      {modal === 'skills' && (
        <SkillsModal mode={mode} state={skillState} onChange={changeSkills} onClose={() => setModal('')} />
      )}
      {modal === 'design' && <DesignModal design={design} onChange={changeDesign} onClose={() => setModal('')} />}

      <nav className="mobile-nav">
        <button
          type="button"
          className={mobileView === 'chat' ? 'active' : ''}
          onClick={() => setMobileView('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          className={mobileView === 'result' && tab === 'preview' ? 'active' : ''}
          onClick={() => {
            setTab('preview');
            setMobileView('result');
          }}
        >
          Preview
        </button>
        <button
          type="button"
          className={mobileView === 'result' && tab === 'code' ? 'active' : ''}
          onClick={() => {
            setTab('code');
            setMobileView('result');
          }}
        >
          Kode{files.length > 0 ? ` (${files.length})` : ''}
        </button>
      </nav>
    </div>
  );
}
