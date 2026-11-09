// Jenis berkas yang diterima (daftar putih) beserta penanda awal berkas ("magic bytes") untuk verifikasi isi.
export type FileKind = {mime: string; inline: boolean; magic: (b: Buffer) => boolean};
const starts = (b: Buffer, s: string, at = 0) => b.subarray(at, at + s.length).toString('latin1') === s;
const KINDS: Record<string, FileKind> = {
  png: {mime: 'image/png', inline: true, magic: (b) => starts(b, '\x89PNG\r\n\x1a\n')},
  jpg: {mime: 'image/jpeg', inline: true, magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff},
  webp: {mime: 'image/webp', inline: true, magic: (b) => starts(b, 'RIFF') && starts(b, 'WEBP', 8)},
  pdf: {mime: 'application/pdf', inline: true, magic: (b) => b.subarray(0, 1024).toString('latin1').includes('%PDF-')},
  tif: {mime: 'image/tiff', inline: false, magic: (b) => starts(b, 'II*\0') || starts(b, 'MM\0*')},
  zip: {mime: 'application/zip', inline: false, magic: (b) => starts(b, 'PK')},
  psd: {mime: 'image/vnd.adobe.photoshop', inline: false, magic: (b) => starts(b, '8BPS')},
  ai: {mime: 'application/postscript', inline: false, magic: (b) => starts(b, '%!PS') || starts(b, '%PDF-')},
  eps: {mime: 'application/postscript', inline: false, magic: (b) => starts(b, '%!PS') || (b[0] === 0xc5 && b[1] === 0xd0)},
  cdr: {mime: 'application/vnd.corel-draw', inline: false, magic: (b) => starts(b, 'RIFF') || starts(b, 'PK')},
};
const ALIAS: Record<string, string> = {jpeg: 'jpg', tiff: 'tif'};
export const ACCEPT_EXT = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'tif', 'tiff', 'zip', 'psd', 'ai', 'eps', 'cdr'];
export const ACCEPT_ATTR = ACCEPT_EXT.map((e) => '.' + e).join(',');
export const ACCEPT_LABEL = 'PNG, JPG, WebP, PDF, TIFF, ZIP, PSD, AI, EPS, CDR';
export const MAX_UPLOAD_MB_UI = 500;

export function kindOf(name: string): FileKind | null {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return KINDS[ALIAS[ext] || ext] ?? null;
}
export function cleanName(raw: string): string {
  const base = raw.replace(/[\\/]+/g, '/').split('/').pop() || '';
  // eslint-disable-next-line no-control-regex
  const name = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '').trim();
  if (name.length <= 150) return name;
  const dot = name.lastIndexOf('.');
  return name.slice(0, 150 - (name.length - dot)) + name.slice(dot);
}
export const formatSize = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
