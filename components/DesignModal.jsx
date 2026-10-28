'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DENSITIES,
  FONTS,
  PALETTES,
  RADII,
  STYLES,
  DEFAULT_DESIGN,
  allPalettes,
  designColors,
  extractColorsFromImage,
  loadSavedPalettes,
  paletteFromColors,
  saveSavedPalettes
} from '../lib/design';

function Chips({ items, value, onPick }) {
  return (
    <div className="chips">
      {items.map((it) => (
        <button key={it.id} type="button" className={`chip ${value === it.id ? 'on' : ''}`} onClick={() => onPick(it.id)}>
          {it.name}
        </button>
      ))}
    </div>
  );
}

export default function DesignModal({ design, onChange, onClose }) {
  const [saved, setSaved] = useState([]);
  const [found, setFound] = useState([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setSaved(loadSavedPalettes());
  }, []);

  const set = (patch) => onChange({ ...design, ...patch });
  const c = designColors(design);
  const palettes = allPalettes(saved);

  function pickPalette(id) {
    const p = palettes.find((x) => x.id === id);
    if (!p) return;
    const builtin = PALETTES.some((x) => x.id === id);
    set({
      palette: id,
      custom: !builtin,
      colors: { primary: p.primary, accent: p.accent, bg: p.bg, text: p.text }
    });
  }

  function setColor(key, value) {
    set({ custom: true, colors: { ...c, [key]: value } });
  }

  function removeSaved(id) {
    const next = saved.filter((p) => p.id !== id);
    setSaved(next);
    saveSavedPalettes(next);
    if (design.palette === id) set({ custom: true });
  }

  async function pickFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImgBusy(true);
    setImgErr('');
    setFound([]);
    try {
      const colors = await extractColorsFromImage(file, 6);
      if (!colors.length) throw new Error('Tidak ada warna yang terbaca.');
      setFound(colors.map((x) => x.hex));
    } catch (err) {
      setImgErr(err.message || 'Gagal membaca foto.');
    } finally {
      setImgBusy(false);
    }
  }

  function applyFound() {
    if (!found.length) return;
    const pal = paletteFromColors(found);
    set({ custom: true, colors: pal });
  }

  function saveFound() {
    if (!found.length) return;
    const pal = paletteFromColors(found);
    const stamp = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const item = {
      id: `foto-${Date.now().toString(36)}`,
      name: `Foto ${stamp}`,
      primary: pal.primary,
      accent: pal.accent,
      bg: pal.bg,
      text: pal.text,
      colors: found.slice(0, 8)
    };
    const next = [...saved, item].slice(-12);
    setSaved(next);
    saveSavedPalettes(next);
    set({ palette: item.id, custom: true, colors: pal });
  }

  const radiusPx = RADII.find((r) => r.id === design.radius) ? RADII.find((r) => r.id === design.radius).px : '10px';
  const demoRadius = radiusPx === '999px' ? 20 : radiusPx;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Desain web</div>
            <div className="modal-sub">Atur gaya, warna, font, lalu Generate. Brief desain dikirim ke AI dan wajib diikuti.</div>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="modal-body">
          <label className="design-switch">
            <input type="checkbox" checked={design.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <span>Pakai brief desain ini saat generate</span>
          </label>

          <div className={design.enabled ? '' : 'dim'}>
            <div className="field">
              <label>Gaya</label>
              <Chips items={STYLES} value={design.style} onPick={(id) => set({ style: id })} />
            </div>

            <div className="field">
              <label>Palet warna</label>
              <div className="palettes">
                {palettes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`palette ${design.palette === p.id ? 'on' : ''}`}
                    onClick={() => pickPalette(p.id)}
                    title={p.name}
                  >
                    <span style={{ background: p.bg }} />
                    <span style={{ background: p.primary }} />
                    <span style={{ background: p.accent }} />
                    <i>{p.name}</i>
                  </button>
                ))}
              </div>

              {saved.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {saved.map((p) => (
                    <button key={p.id} type="button" className="btn ghost sm" onClick={() => removeSaved(p.id)}>
                      Hapus {p.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="colors">
                {[
                  ['primary', 'Primary'],
                  ['accent', 'Accent'],
                  ['bg', 'Background'],
                  ['text', 'Teks']
                ].map(([k, label]) => (
                  <label key={k} className="color-in">
                    <input type="color" value={c[k]} onChange={(e) => setColor(k, e.target.value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Ambil warna dari foto palet</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn ghost sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={imgBusy}>
                  {imgBusy ? 'Membaca foto...' : 'Pilih foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
                <span style={{ fontSize: 12, color: '#7d879c' }}>jpg, png, webp. Warna diambil otomatis.</span>
              </div>

              {imgErr && <div style={{ fontSize: 12, color: '#f87171' }}>{imgErr}</div>}

              {found.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {found.map((hex) => (
                      <span
                        key={hex}
                        title={hex}
                        style={{ width: 30, height: 30, borderRadius: 6, background: hex, border: '1px solid rgba(255,255,255,0.15)' }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#8b95a8', wordBreak: 'break-word' }}>{found.join(' · ')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn ghost sm" onClick={applyFound}>
                      Pakai warna ini
                    </button>
                    <button type="button" className="btn sm" onClick={saveFound}>
                      Simpan jadi palet
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="field">
              <label>Font</label>
              <Chips items={FONTS} value={design.font} onPick={(id) => set({ font: id })} />
            </div>

            <div className="field">
              <label>Sudut</label>
              <Chips items={RADII} value={design.radius} onPick={(id) => set({ radius: id })} />
            </div>

            <div className="field">
              <label>Kepadatan</label>
              <Chips items={DENSITIES} value={design.density} onPick={(id) => set({ density: id })} />
            </div>

            <div className="field">
              <label>Catatan desain (opsional)</label>
              <textarea
                rows={3}
                value={design.note}
                onChange={(e) => set({ note: e.target.value })}
                placeholder="Contoh: hero fullscreen dengan gradient, kartu produk hover naik."
              />
            </div>

            <div
              className="design-demo"
              style={{
                background: c.bg,
                color: c.text,
                borderRadius: demoRadius
              }}
            >
              <b>Pratinjau warna</b>
              <span>Judul dan teks contoh</span>
              <button type="button" style={{ background: c.primary, color: c.bg, borderRadius: radiusPx }}>
                Tombol utama
              </button>
              <button
                type="button"
                style={{ background: 'transparent', color: c.accent, border: `1px solid ${c.accent}`, borderRadius: radiusPx }}
              >
                Aksen
              </button>
            </div>
          </div>

          <div className="clarify-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => onChange({ ...DEFAULT_DESIGN, colors: { ...DEFAULT_DESIGN.colors }, enabled: design.enabled })}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
