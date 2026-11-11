'use client';
import {Printer, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {BRAND} from '../lib/brand';
import {money, type Order} from '../lib/domain';

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
/** Angka bulat menjadi kata Indonesia ("terbilang"), mis. 1500000 -> "satu juta lima ratus ribu". */
export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' puluh ' + terbilang(n % 10)).trim();
  if (n < 200) return ('seratus ' + terbilang(n - 100)).trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + ' ratus ' + terbilang(n % 100)).trim();
  if (n < 2000) return ('seribu ' + terbilang(n - 1000)).trim();
  if (n < 1e6) return (terbilang(Math.floor(n / 1000)) + ' ribu ' + terbilang(n % 1000)).trim();
  if (n < 1e9) return (terbilang(Math.floor(n / 1e6)) + ' juta ' + terbilang(n % 1e6)).trim();
  if (n < 1e12) return (terbilang(Math.floor(n / 1e9)) + ' miliar ' + terbilang(n % 1e9)).trim();
  return String(n);
}

const fmt = (iso: string) => new Date(iso).toLocaleString('id-ID', {day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'});

/** Kwitansi satu pembayaran, siap cetak (tombol Cetak memakai dialog cetak browser; dapat disimpan sebagai PDF). */
export function Receipt({order, paymentId, customer, cashier, onClose}: {order: Order; paymentId: string; customer: string; cashier: string; onClose: () => void}) {
  const idx = order.payments.findIndex((p) => p.id === paymentId);
  const p = order.payments[idx];
  if (!p) return null;
  const sofar = order.payments.slice(0, idx + 1).reduce((s, x) => s + x.amount, 0);
  const left = Math.max(0, order.total - sofar);
  const no = `KW-${order.id}-${String(idx + 1).padStart(2, '0')}`;
  return <div className="modalback receiptback" role="dialog" aria-modal="true" aria-label="Kwitansi pembayaran" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="receiptwrap">
      <div className="receipttools"><Button onClick={() => window.print()}><Printer size={16}/> Cetak / simpan PDF</Button><button type="button" className="receiptclose" onClick={onClose}><X size={16}/> Tutup</button></div>
      <article className="receiptsheet">
        <header><img src={BRAND.logoMark} width={52} height={52} alt=""/><div><b>PRINTORA</b><small>Sistem alur percetakan</small></div><div className="receiptno"><small>KWITANSI</small><b>{no}</b></div></header>
        <div className="receiptstripe"/>
        {left === 0 && <div className="receiptstamp">LUNAS</div>}
        <dl>
          <div><dt>Telah diterima dari</dt><dd>{customer}</dd></div>
          <div><dt>Terbilang</dt><dd className="terbilang">{terbilang(p.amount)} rupiah</dd></div>
          <div><dt>Untuk pembayaran</dt><dd>{p.kind} pesanan {order.id} - {order.title} ({order.qty} pcs)</dd></div>
          <div><dt>Metode</dt><dd>{p.method}</dd></div>
          <div><dt>Tanggal</dt><dd>{fmt(p.date)}</dd></div>
        </dl>
        <div className="receiptsum">
          <div><span>Total tagihan</span><b>{money(order.total)}</b></div>
          <div><span>Dibayar sampai kwitansi ini</span><b>{money(sofar)}</b></div>
          <div><span>Sisa tagihan</span><b>{left > 0 ? money(left) : 'Lunas'}</b></div>
        </div>
        <div className="receiptamount"><span>Jumlah</span><b>{money(p.amount)}</b></div>
        <footer><div><small>Dicatat oleh</small><b>{cashier}</b></div><p>Kwitansi ini sah sebagai bukti pembayaran tanpa tanda tangan basah. Simpan untuk pengambilan pesanan.</p></footer>
      </article>
    </div>
  </div>;
}
