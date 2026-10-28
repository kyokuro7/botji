'use client';

import { DENSITIES, FONTS, PALETTES, RADII, STYLES, DEFAULT_DESIGN, designColors } from '../lib/design';

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
  const set = (patch) => onChange({ ...design, ...patch });
  const c = designColors(design);

  function pickPalette(id) {
    const p = PALETTES.find((x) => x.id === id);
    set({ palette: id, custom: false, colors: { primary: p.primary, accent: p.accent, bg: p.bg, text: p.text } });
  }

  function setColor(key, value) {
    set({ custom: true, colors: { ...c, [key]: value } });
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Desain web</div>
            <div className="modal-sub">Atur gaya, warna, font, lalu Generate. Brief desain dikirim ke AI.</div>
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
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`palette ${!design.custom && design.palette === p.id ? 'on' : ''}`}
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
                borderRadius: RADII.find((r) => r.id === design.radius).px === '999px' ? 20 : RADII.find((r) => r.id === design.radius).px
              }}
            >
              <b>Pratinjau warna</b>
              <span>Judul dan teks contoh</span>
              <button type="button" style={{ background: c.primary, color: c.bg, borderRadius: RADII.find((r) => r.id === design.radius).px }}>
                Tombol utama
              </button>
              <button type="button" style={{ background: 'transparent', color: c.accent, border: `1px solid ${c.accent}`, borderRadius: RADII.find((r) => r.id === design.radius).px }}>
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
