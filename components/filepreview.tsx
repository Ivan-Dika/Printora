import {Archive, FileText, Image as ImageIcon, Layers, PenTool, Shapes, type LucideIcon} from 'lucide-react';

export type PreviewFile = {file: string; mime?: string; name: string; size?: number};
const IMAGES = ['image/png', 'image/jpeg', 'image/webp'];
const THUMB_MAX = 6 * 1048576;

// Warna label mengikuti jenis berkas: teks dan latar dipasangkan agar kontras.
const TYPES: Record<string, {label: string; Icon: LucideIcon; fg: string; bg: string}> = {
  pdf: {label: 'PDF', Icon: FileText, fg: '#a3204f', bg: '#fde4ec'},
  psd: {label: 'Photoshop', Icon: Layers, fg: '#0047a8', bg: '#dbe9ff'},
  ai: {label: 'Illustrator', Icon: PenTool, fg: '#6b5000', bg: '#fff3c4'},
  eps: {label: 'EPS', Icon: Shapes, fg: '#006a8c', bg: '#dff5ff'},
  cdr: {label: 'CorelDRAW', Icon: Shapes, fg: '#17692f', bg: '#e1f4e6'},
  tif: {label: 'TIFF', Icon: ImageIcon, fg: '#5b2fb0', bg: '#eee6fb'},
  zip: {label: 'Arsip ZIP', Icon: Archive, fg: '#33425f', bg: '#e8edf5'},
};
const extOf = (n: string) => { const e = (n.split('.').pop() || '').toLowerCase(); return e === 'tiff' ? 'tif' : e; };
export const isImage = (f: PreviewFile) => IMAGES.includes(f.mime || '');
export const isPdf = (f: PreviewFile) => f.mime === 'application/pdf';

/** Kartu jenis berkas (untuk berkas yang tidak dapat dirender di peramban). */
export function TypeCard({f, compact}: {f: PreviewFile; compact?: boolean}) {
  const t = TYPES[extOf(f.name)] || {label: extOf(f.name).toUpperCase() || 'Berkas', Icon: FileText, fg: '#33425f', bg: '#e8edf5'};
  return <div className={'typecard' + (compact ? ' compact' : '')} style={{background: t.bg, color: t.fg}}>
    <t.Icon size={compact ? 22 : 44} strokeWidth={1.8}/>
    <b>{t.label}</b>{!compact && <small>.{extOf(f.name)}{f.size ? ' · ' + (f.size >= 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB') : ''}</small>}
  </div>;
}

/** Pratinjau penuh: gambar ditampilkan, PDF dirender oleh peramban, jenis lain memakai kartu jenis berkas. */
export function DesignPreview({f}: {f: PreviewFile}) {
  if (!f.file) return <div className="typecard" style={{background: '#eef3fb', color: '#33425f'}}><b>Pratinjau belum tersedia</b></div>;
  if (isImage(f)) return <img src={f.file} alt={f.name}/>; // eslint-disable-line @next/next/no-img-element
  if (isPdf(f)) return <iframe className="pdfframe" title={f.name} src={f.file + '#toolbar=0&navpanes=0&view=FitH'}/>;
  return <TypeCard f={f}/>;
}

/** Gambar kecil untuk daftar: gambar (bila tidak terlalu besar) atau kartu jenis berkas. Null bila tidak ada berkas. */
export function DesignThumb({f}: {f?: PreviewFile}) {
  if (!f || !f.file) return null;
  if (isImage(f) && (f.size ?? 0) <= THUMB_MAX) return <img src={f.file} alt="" loading="lazy"/>; // eslint-disable-line @next/next/no-img-element
  return <TypeCard f={f} compact/>;
}
