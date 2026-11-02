import {Flag, IdCard, Mail, Newspaper, Package, Printer, Tag} from 'lucide-react';
import type {ReactElement} from 'react';

/** Ikon produk menurut nama; bawaan Printer untuk produk baru dari Admin. */
export function productIcon(name: string, size = 28): ReactElement {
  const n = name.toLowerCase();
  if (/banner|spanduk|baliho|x-?banner/.test(n)) return <Flag size={size}/>;
  if (/stiker|sticker|label/.test(n)) return <Tag size={size}/>;
  if (/kartu|id card|nama/.test(n)) return <IdCard size={size}/>;
  if (/brosur|poster|flyer|leaflet|menu/.test(n)) return <Newspaper size={size}/>;
  if (/undangan|kartu ucapan|amplop/.test(n)) return <Mail size={size}/>;
  if (/kemasan|box|dus|paket/.test(n)) return <Package size={size}/>;
  return <Printer size={size}/>;
}

const KNOWN: Record<string, number> = {promosi: 0, kemasan: 1, identitas: 2, acara: 3};
/** Kelas warna kategori (c0..c5); kategori baru dipetakan stabil lewat hash. */
export function catClass(category: string): string {
  const k = category.trim().toLowerCase();
  if (k in KNOWN) return 'c' + KNOWN[k];
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 'c' + (4 + (h % 2));
}
