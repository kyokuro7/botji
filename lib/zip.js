// ZIP writer minimal tanpa dependency. Metode "store" (tanpa kompresi).
// Cukup untuk mengunduh file teks proyek dari browser.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function safeName(path) {
  const name = String(path || 'file.txt')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/(^|\/)\.\.(\/|$)/g, '$1')
    .trim();
  return name.slice(0, 180) || 'file.txt';
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const safeYear = year < 1980 ? 1980 : year > 2107 ? 2107 : year;
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const day = (((safeYear - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time: time & 0xffff, date: day & 0xffff };
}

export function createZip(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) throw new Error('Tidak ada file untuk diunduh.');

  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  const stamp = dosDateTime(new Date());
  let offset = 0;

  for (const entry of list) {
    const nameBytes = enc.encode(safeName(entry && entry.path));
    const dataBytes =
      entry && entry.bytes instanceof Uint8Array
        ? entry.bytes
        : enc.encode(String(entry && entry.content != null ? entry.content : ''));
    const crc = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, dataBytes);

    const header = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(header.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, stamp.time, true);
    cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    central.push(header);

    offset += local.length + dataBytes.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint16(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
