'use client';
import {use, useEffect, useState} from 'react';
import {CheckCircle2, QrCode} from 'lucide-react';
import {money} from '../../../lib/domain';
import '../bayar.css';

type Info = {status: string; amount: number; orderId: string; title: string; method: string; demo?: boolean};

// Halaman pembayaran QRIS yang dibuka dari ponsel lewat token pada kode QR.
export default function Bayar({params}: {params: Promise<{id: string}>}) {
  const {id} = use(params);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/bayar/demo?id=' + id, {cache: 'no-store'}).then(async (r) => { const j = await r.json() as Info & {error?: string}; if (!r.ok) throw Error(j.error); setInfo(j); }).catch((e) => setError(e.message));
  }, [id]);
  async function pay() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/bayar/demo', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id})});
      const j = await r.json() as Info & {error?: string}; if (!r.ok) throw Error(j.error); setInfo(j);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="payshell"><section className="paycard">
    <div className="paybadge"><QrCode size={16}/> Pembayaran QRIS</div>
    {error && !info && <><h1>Kode tidak dikenali</h1><p>{error}</p></>}
    {info && info.status === 'paid' && <div className="paydone"><span className="okmark"><CheckCircle2 size={48} strokeWidth={2.4}/></span><h1>Pembayaran berhasil</h1><p className="amount">{money(info.amount)}</p><p>Pesanan {info.orderId} · {info.title}</p><p className="note">Anda dapat menutup halaman ini. Status pesanan di Printora diperbarui otomatis.</p></div>}
    {info && info.status === 'cancelled' && <><h1>Permintaan dibatalkan</h1><p>Permintaan pembayaran ini sudah dibatalkan. Buat permintaan baru dari halaman pesanan.</p></>}
    {info && info.status === 'pending' && <>
      <p className="label">Bayar ke</p><h1>Printora Percetakan</h1>
      <p className="amount">{money(info.amount)}</p>
      <dl><dt>Pesanan</dt><dd>{info.orderId}</dd><dt>Keterangan</dt><dd>{info.title}</dd></dl>
      {error && <p className="payerr" role="alert">{error}</p>}
      {info.demo === false
        ? <p className="muted">Pembayaran lewat halaman ini tidak tersedia. Lakukan pembayaran sesuai arahan FO; FO akan mengonfirmasi setelah dana diterima.</p>
        : <button className="paybtn" onClick={pay} disabled={busy}>{busy ? 'Memproses…' : 'Bayar sekarang'}</button>}
    </>}
  </section></main>;
}
