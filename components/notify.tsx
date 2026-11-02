'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Bell, BellOff, BellRing, CheckCheck, CheckCircle2, Info, TriangleAlert, Wallet, X} from 'lucide-react';
import {money, paid, type Order} from '../lib/domain';

type Kind = 'ok' | 'info' | 'error';
type Item = {id: number; text: string; kind: Kind};
const EVENT = 'printora:toast';

/** Tampilkan toast di dalam halaman. Dipanggil dari mana saja. */
export function toast(text: string, kind: Kind = 'ok') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, {detail: {text, kind}}));
}

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const {text, kind} = (e as CustomEvent<{text: string; kind: Kind}>).detail;
      const id = ++n;
      setItems((cur) => [...cur.slice(-3), {id, text, kind}]);
      setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === 'error' ? 8000 : 5000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!items.length) return null;
  return <div className="toasts" role="region" aria-label="Notifikasi">
    {items.map((i) => <div key={i.id} className={'toastitem ' + i.kind} role={i.kind === 'error' ? 'alert' : 'status'}>
      {i.kind === 'ok' ? <CheckCircle2 size={18}/> : i.kind === 'error' ? <TriangleAlert size={18}/> : <Info size={18}/>}
      <span>{i.text}</span>
      <button aria-label="Tutup notifikasi" onClick={() => setItems((cur) => cur.filter((x) => x.id !== i.id))}><X size={15}/></button>
    </div>)}
  </div>;
}

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Notifikasi sistem (muncul di pusat notifikasi Windows). Hanya bila izin diberikan dan jendela tidak sedang dilihat. */
export function desktopNotify(title: string, body: string, tag: string) {
  if (!supported() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  try {
    const n = new Notification(title, {body, tag, icon: '/brand/logo-mark.png'});
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* beberapa peramban hanya mengizinkan lewat service worker */ }
}

/** Tombol untuk meminta izin notifikasi desktop. */
export function NotifyButton() {
  const [perm, setPerm] = useState<NotificationPermission | 'none'>('none');
  useEffect(() => { if (supported()) setPerm(Notification.permission); }, []);
  if (perm === 'none') return null;
  async function click() {
    if (perm === 'default') {
      const r = await Notification.requestPermission();
      setPerm(r);
      toast(r === 'granted' ? 'Notifikasi desktop aktif. Pembaruan pesanan muncul saat jendela ini tidak dibuka.' : 'Notifikasi desktop tidak diaktifkan.', r === 'granted' ? 'ok' : 'info');
    } else if (perm === 'granted') {
      toast('Notifikasi desktop aktif. Ubah lewat pengaturan situs di peramban.', 'info');
    } else toast('Notifikasi diblokir. Izinkan lewat ikon gembok di bilah alamat peramban.', 'error');
  }
  const label = perm === 'granted' ? 'Notifikasi desktop aktif' : perm === 'denied' ? 'Notifikasi desktop diblokir' : 'Aktifkan notifikasi desktop';
  return <button className={'icon notifybtn ' + perm} title={label} aria-label={label} onClick={click}>{perm === 'denied' ? <BellOff size={17}/> : <Bell size={17}/>}</button>;
}

export type Change = {title: string; body: string; tag: string};

/** Bandingkan dua daftar pesanan dan jelaskan perubahan yang relevan bagi pengguna. */
export function diffOrders(prev: Order[], next: Order[]): Change[] {
  const old = new Map(prev.map((o) => [o.id, o]));
  const out: Change[] = [];
  for (const o of next) {
    const p = old.get(o.id);
    if (!p) { out.push({title: 'Pesanan baru', body: `${o.id} · ${o.title}`, tag: o.id}); continue; }
    if (p.status !== o.status) out.push({title: `${o.id}: ${o.status}`, body: o.title, tag: o.id});
    else if (o.designs.length > p.designs.length) out.push({title: `${o.id}: desain versi ${o.designs.length}`, body: `${o.title}. Desain baru siap ditinjau.`, tag: o.id});
    else if (o.revisions.length > p.revisions.length) out.push({title: `${o.id}: revisi diminta`, body: o.title, tag: o.id});
    else if (o.payments.length > p.payments.length) out.push({title: `${o.id}: pembayaran dicatat`, body: o.title, tag: o.id});
  }
  return out.slice(0, 5);
}

export type Note = {key: string; at: string; orderId: string; title: string; text: string; tab: string; action?: boolean};

/**
 * Riwayat notifikasi untuk satu pengguna, dibangun dari riwayat aktivitas pesanan yang boleh dilihatnya (tersimpan di server,
 * jadi tetap ada setelah keluar atau berganti perangkat). Aksi milik sendiri tidak dihitung. Pelanggan juga mendapat pengingat
 * pembayaran selama DP atau pelunasan masih kurang.
 */
export function buildNotes(orders: Order[], userId: string, role: string): Note[] {
  const out: Note[] = [];
  for (const o of orders) {
    for (const [i, h] of o.history.entries()) {
      if (h.by === userId) continue;
      out.push({key: o.id + ':' + i, at: h.date, orderId: o.id, title: o.title, text: h.text, tab: /[Pp]embayaran|DP|[Ll]unas/.test(h.text) ? 'Pembayaran' : /[Dd]esain|[Rr]evisi/.test(h.text) ? 'Desain' : 'Ringkasan'});
    }
    if (role === 'customer' && o.verified && o.status !== 'Selesai') {
      const dueNow = o.status === 'Siap diambil' ? o.total - paid(o) : o.dp - paid(o);
      if (dueNow > 0) {
        const last = o.history.at(-1)?.date || o.created;
        out.push({key: o.id + ':bayar:' + dueNow, at: last, orderId: o.id, title: o.title, tab: 'Pembayaran', action: true,
          text: (o.status === 'Siap diambil' ? 'Pesanan siap diambil. Lunasi sisa tagihan ' : 'Bayar DP ') + money(dueNow) + ' lewat tab Pembayaran.'});
      }
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 40);
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' menit lalu';
  if (m < 1440) return Math.round(m / 60) + ' jam lalu';
  return new Date(iso).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
};

/** Lonceng dengan daftar riwayat notifikasi; juga memuat tombol izin notifikasi desktop. */
export function NotifyCenter({orders, userId, role, onOpen}: {orders: Order[]; userId: string; role: string; onOpen: (orderId: string, tab: string) => void}) {
  const notes = useMemo(() => buildNotes(orders, userId, role), [orders, userId, role]);
  const storeKey = 'printora:seen:' + userId;
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState('');
  const [perm, setPerm] = useState<NotificationPermission | 'none'>('none');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { try { setSeen(localStorage.getItem(storeKey) || ''); } catch { /* penyimpanan tidak tersedia */ } if (supported()) setPerm(Notification.permission); }, [storeKey]);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const unread = notes.filter((n) => n.at > seen || n.action).length;
  function markRead() {
    const t = new Date().toISOString(); setSeen(t);
    try { localStorage.setItem(storeKey, t); } catch { /* abaikan */ }
  }
  async function enableDesktop() {
    if (!supported()) return;
    if (perm === 'default') { const r = await Notification.requestPermission(); setPerm(r); toast(r === 'granted' ? 'Notifikasi desktop aktif.' : 'Notifikasi desktop tidak diaktifkan.', r === 'granted' ? 'ok' : 'info'); }
    else if (perm === 'denied') toast('Notifikasi diblokir. Izinkan lewat ikon gembok di bilah alamat peramban.', 'error');
  }
  return <div className="notifycenter" ref={box}>
    <button className={'icon notifybtn' + (unread ? ' has' : '')} title="Notifikasi" aria-label={'Notifikasi' + (unread ? ', ' + unread + ' belum dibaca' : '')} aria-expanded={open} onClick={() => setOpen(!open)}>
      {unread ? <BellRing size={18}/> : <Bell size={18}/>}{unread > 0 && <b className="notifycount">{unread > 9 ? '9+' : unread}</b>}
    </button>
    {open && <div className="notifypanel" role="dialog" aria-label="Riwayat notifikasi">
      <div className="notifyhead"><h3>Notifikasi</h3>{unread > 0 && <button className="linkbutton" onClick={markRead}><CheckCheck size={14}/> Tandai dibaca</button>}</div>
      <div className="notifylist">
        {!notes.length && <p className="emptytext">Belum ada notifikasi.</p>}
        {notes.map((n) => {
          const isNew = n.at > seen || n.action;
          return <button key={n.key} className={'notifyitem' + (isNew ? ' new' : '') + (n.action ? ' act' : '')} onClick={() => { setOpen(false); markRead(); onOpen(n.orderId, n.tab); }}>
            <span className="notifyicon">{n.action ? <Wallet size={15}/> : <Info size={15}/>}</span>
            <span><b>{n.orderId} <i className="sep"/> {n.title}</b><span className="notifytext">{n.text}</span><small>{n.action ? 'Perlu tindakan Anda' : ago(n.at)}</small></span>
          </button>;
        })}
      </div>
      {perm !== 'none' && <div className="notifyfoot"><button onClick={enableDesktop} disabled={perm === 'granted'}>{perm === 'denied' ? <BellOff size={14}/> : <Bell size={14}/>}{perm === 'granted' ? 'Notifikasi desktop aktif' : perm === 'denied' ? 'Notifikasi desktop diblokir' : 'Aktifkan notifikasi desktop'}</button></div>}
    </div>}
  </div>;
}
