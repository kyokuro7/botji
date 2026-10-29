'use client';

import { formatSize } from '../lib/upload';

const KIND_LABEL = { text: 'teks', image: 'gambar', binary: 'biner' };

export default function UploadModal({
  items,
  busy,
  useVision,
  hasImage,
  onPick,
  onToggle,
  onRemove,
  onClear,
  onImport,
  onVision,
  onClose
}) {
  const list = Array.isArray(items) ? items : [];
  const included = list.filter((i) => i.include !== false).length;
  const textChars = list
    .filter((i) => i.include !== false && i.kind === 'text')
    .reduce((sum, i) => sum + String(i.content || '').length, 0);
  const canImport = list.some((i) => i.kind === 'text' && i.include !== false);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Upload file</div>
            <div className="modal-sub">
              Kode, dokumen, ZIP project, atau gambar. Isi file dipakai AI sebagai acuan saat mengedit project.
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="modal-body">
          <div className="up-top">
            <button type="button" className="btn" onClick={onPick} disabled={busy}>
              {busy ? 'Membaca file...' : 'Pilih file'}
            </button>
            {list.length > 0 && (
              <button type="button" className="btn ghost" onClick={onClear} disabled={busy}>
                Hapus semua
              </button>
            )}
          </div>

          <div className="up-hint">
            Bisa pilih banyak sekaligus: html, css, js, json, md, py, docx, zip, gambar (png/jpg/webp). Folder di dalam ZIP
            ikut dibaca. File biner lain cuma dicatat namanya.
          </div>

          {list.length === 0 ? (
            <div className="empty">Belum ada file.</div>
          ) : (
            <div className="up-list">
              {list.map((it) => (
                <div key={it.id} className={`up-item ${it.include === false ? 'off' : ''}`}>
                  <label className="up-main">
                    <input type="checkbox" checked={it.include !== false} onChange={() => onToggle(it.id)} />
                    {it.kind === 'image' && it.dataUrl ? (
                      <img src={it.dataUrl} alt={it.name} />
                    ) : (
                      <span className={`up-badge ${it.kind}`}>{KIND_LABEL[it.kind] || 'file'}</span>
                    )}
                    <span className="up-meta">
                      <b>{it.path || it.name}</b>
                      <small>
                        {formatSize(it.size)}
                        {it.kind === 'text' ? ` · ${String(it.content || '').length} karakter` : ''}
                        {it.truncated ? ' · dipotong' : ''}
                      </small>
                    </span>
                  </label>
                  <button type="button" className="btn ghost sm" onClick={() => onRemove(it.id)}>
                    Buang
                  </button>
                </div>
              ))}
            </div>
          )}

          {hasImage && (
            <label className="up-vision">
              <input type="checkbox" checked={!!useVision} onChange={(e) => onVision(e.target.checked)} />
              <span>Kirim gambar ke AI juga (model harus mendukung vision, misal gpt-4o / claude sonnet)</span>
            </label>
          )}

          <div className="up-summary">
            {included} file dipakai · {textChars} karakter teks dikirim ke AI
          </div>

          <div className="clarify-actions">
            <button type="button" className="btn ghost" onClick={onImport} disabled={!canImport}>
              Jadikan project
            </button>
            <div className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
