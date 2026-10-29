'use client';

import { useState } from 'react';
import { importSkillsFromGitHub, skillsForMode } from '../lib/skills';

const EMPTY = { id: '', name: '', desc: '', instruction: '', scope: 'all' };

export default function SkillsModal({ mode, state, onChange, onClose }) {
  const [form, setForm] = useState(null);
  const [ghUrl, setGhUrl] = useState('');
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState('');
  const [ghResult, setGhResult] = useState([]);

  const list = skillsForMode(mode, state.custom);

  function toggle(id) {
    const active = state.active.includes(id) ? state.active.filter((x) => x !== id) : [...state.active, id];
    onChange({ ...state, active });
  }

  function saveForm() {
    const name = form.name.trim();
    const instruction = form.instruction.trim();
    if (!name || !instruction) return;
    const item = {
      id: form.id || `custom-${Date.now().toString(36)}`,
      name: name.slice(0, 40),
      desc: form.desc.trim().slice(0, 80),
      instruction: instruction.slice(0, 1200),
      scope: form.scope,
      custom: true
    };
    const exists = state.custom.some((s) => s.id === item.id);
    const custom = exists ? state.custom.map((s) => (s.id === item.id ? item : s)) : [...state.custom, item];
    const active = state.active.includes(item.id) ? state.active : [...state.active, item.id];
    onChange({ active, custom });
    setForm(null);
  }

  function remove(id) {
    onChange({
      active: state.active.filter((x) => x !== id),
      custom: state.custom.filter((s) => s.id !== id)
    });
  }

  function applySkills(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    const custom = state.custom.slice();
    const active = state.active.slice();

    for (const s of items) {
      const idx = custom.findIndex((x) => x.id === s.id || (x.source && x.source === s.source));
      if (idx >= 0) {
        const keepId = custom[idx].id;
        custom[idx] = { ...s, id: keepId };
        if (!active.includes(keepId)) active.push(keepId);
      } else {
        custom.push(s);
        if (!active.includes(s.id)) active.push(s.id);
      }
    }

    onChange({ active, custom });
  }

  async function loadGithub() {
    const url = ghUrl.trim();
    if (!url || ghBusy) return;
    setGhBusy(true);
    setGhError('');
    setGhResult([]);
    try {
      const found = await importSkillsFromGitHub(url);
      setGhResult(found);
    } catch (e) {
      setGhError(e.message || 'Gagal mengambil dari GitHub.');
    } finally {
      setGhBusy(false);
    }
  }

  function importOne(skill) {
    applySkills([skill]);
    setGhResult((prev) => prev.filter((s) => s.id !== skill.id));
  }

  function importAll() {
    applySkills(ghResult);
    setGhResult([]);
    setGhUrl('');
  }

  const activeCount = list.filter((s) => state.active.includes(s.id)).length;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Skill</div>
            <div className="modal-sub">
              {activeCount} aktif untuk mode {mode === 'telegram' ? 'Bot Telegram' : 'Website'}. Skill menambah aturan ke instruksi AI.
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="modal-body">
          {!form && (
            <>
              <div className="skill-list">
                {list.map((s) => {
                  const on = state.active.includes(s.id);
                  return (
                    <div key={s.id} className={`skill ${on ? 'on' : ''}`}>
                      <label className="skill-main">
                        <input type="checkbox" checked={on} onChange={() => toggle(s.id)} />
                        <span>
                          <b>{s.name}</b>
                          {s.custom && <em className="tag">kustom</em>}
                          <small>{s.desc || s.instruction.slice(0, 70)}</small>
                        </span>
                      </label>
                      {s.custom && (
                        <div className="skill-tools">
                          <button type="button" className="btn ghost sm" onClick={() => setForm({ ...s })}>
                            Edit
                          </button>
                          <button type="button" className="btn ghost sm" onClick={() => remove(s.id)}>
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" className="btn" onClick={() => setForm({ ...EMPTY })}>
                + Buat skill sendiri
              </button>

              <div className="gh-box">
                <div className="gh-title">Impor dari GitHub</div>
                <div className="gh-row">
                  <input
                    value={ghUrl}
                    onChange={(e) => setGhUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        loadGithub();
                      }
                    }}
                    placeholder="https://github.com/user/repo/blob/main/SKILL.md"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button type="button" className="btn ghost sm" onClick={loadGithub} disabled={ghBusy || !ghUrl.trim()}>
                    {ghBusy ? 'Mengambil...' : 'Ambil'}
                  </button>
                </div>
                <div className="gh-hint">
                  Bisa URL file .md, folder skill, root repo, atau gist. Repo dibaca lewat api.github.com (maks 60 permintaan per jam tanpa token).
                </div>

                {ghError && <div className="gh-err">{ghError}</div>}

                {ghResult.length > 0 && (
                  <div className="gh-found">
                    <div className="gh-found-head">
                      <span>{ghResult.length} skill ditemukan</span>
                      <button type="button" className="btn ghost sm" onClick={importAll}>
                        Impor semua
                      </button>
                    </div>
                    <div className="gh-list">
                      {ghResult.map((s) => (
                        <div key={s.id} className="gh-item">
                          <div className="gh-item-main">
                            <b>{s.name}</b>
                            <small>{s.desc || s.instruction.slice(0, 70)}</small>
                          </div>
                          <button type="button" className="btn ghost sm" onClick={() => importOne(s)}>
                            Impor
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {form && (
            <div className="skill-form">
              <div className="field">
                <label>Nama skill</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Gaya bahasa santai" />
              </div>
              <div className="field">
                <label>Deskripsi singkat (opsional)</label>
                <input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
              </div>
              <div className="field">
                <label>Instruksi untuk AI</label>
                <textarea
                  rows={5}
                  value={form.instruction}
                  onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                  placeholder="Tulis aturan yang harus diikuti AI setiap kali generate."
                />
              </div>
              <div className="field">
                <label>Berlaku untuk</label>
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                  <option value="all">Website dan Bot</option>
                  <option value="website">Website saja</option>
                  <option value="telegram">Bot Telegram saja</option>
                </select>
              </div>
              <div className="clarify-actions">
                <button type="button" className="btn ghost" onClick={() => setForm(null)}>
                  Batal
                </button>
                <div className="spacer" />
                <button type="button" className="btn" onClick={saveForm} disabled={!form.name.trim() || !form.instruction.trim()}>
                  Simpan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
