'use client';
import {Button} from '@/components/ui/button';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Banknote, Check, Landmark, QrCode, Wallet} from 'lucide-react';
import {api} from './auth';
import {toast} from './notify';
import {money} from '../lib/domain';
import {Sep} from './printsample';

type Req = {id: string; orderId: string; method: string; kind: 'qr' | 'bank' | 'cash' | 'other'; amount: number; status: 'pending' | 'paid' | 'cancelled'};
type Resp = {requests: Req[]; methods: string[]; bank: {bank: string; number: string; holder: string}; id?: string; demo?: boolean};
type Ord = {id: string; total: number; dp: number; verified: boolean; status: string; payments: {amount: number}[]};

const Icon = ({kind}: {kind: Req['kind']}) => kind === 'qr' ? <QrCode size={18}/> : kind === 'bank' ? <Landmark size={18}/> : kind === 'cash' ? <Banknote size={18}/> : <Wallet size={18}/>;
const kindOf = (m: string): Req['kind'] => /qris/i.test(m) ? 'qr' : /transfer/i.test(m) ? 'bank' : /tunai|cash/i.test(m) ? 'cash' : 'other';
const hint: Record<Req['kind'], string> = {qr: 'Pindai kode QR', bank: 'Transfer ke rekening', cash: 'Bayar di kasir', other: 'Dikonfirmasi FO'};

/** Pembayaran dari sisi pelanggan (pilih metode, bayar) dan konfirmasi dari sisi FO. */
export function PayPanel({order, role, onChange}: {order: Ord; role: string; onChange: () => void}) {
  const [data, setData] = useState<Resp | null>(null);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef<string>('');
  const changed = useRef(onChange); changed.current = onChange;
  const sum = order.payments.reduce((n, p) => n + p.amount, 0);
  const rest = order.total - sum, dueDp = Math.max(0, order.dp - sum);
  const options = dueDp > 0 && dueDp < rest ? [{label: 'DP', value: dueDp}, {label: 'Lunas', value: rest}] : [{label: dueDp > 0 ? 'Lunas (sama dengan DP)' : 'Pelunasan', value: rest}];
  const mine = (data?.requests || []).filter((r) => r.orderId === order.id);
  const pending = mine.find((r) => r.status === 'pending');

  const refresh = useCallback(async () => {
    try {
      const j = await api<Resp>('/api/bayar');
      setData(j);
      const p = j.requests.find((r) => r.orderId === order.id && r.status === 'pending');
      const paidNow = j.requests.find((r) => r.orderId === order.id && r.status === 'paid' && r.id === seen.current);
      if (paidNow && !p) { seen.current = ''; toast(`Pembayaran ${money(paidNow.amount)} diterima.`); changed.current(); }
    } catch { /* jaringan: coba lagi pada siklus berikutnya */ }
  }, [order.id]);

  useEffect(() => { if (role === 'customer' || role === 'fo') void refresh(); }, [role, refresh]);
  useEffect(() => { if (data?.methods.length && !method) setMethod(data.methods[0]); }, [data, method]);
  useEffect(() => { if (!options.some((o) => o.value === amount)) setAmount(options[0].value); }, [options.map((o) => o.value).join(), amount]);
  useEffect(() => {
    if (!pending) return;
    seen.current = pending.id;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [pending?.id, refresh]);

  async function call(body: Record<string, unknown>, done?: string) {
    setBusy(true); setError('');
    try { const j = await api<Resp>('/api/bayar', body); setData(j); if (done) toast(done); return j; }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (role !== 'customer' && role !== 'fo') return null;

  if (role === 'fo') {
    if (!pending) return null;
    return <div className="paypanel fo"><h3>Menunggu konfirmasi</h3>
      <div className="payreq"><span className="payicon"><Icon kind={pending.kind}/></span><div><b>{pending.method} <Sep/> {money(pending.amount)}</b><small>{pending.kind === 'qr' && data?.demo !== false ? 'Menunggu pelanggan memindai kode QR.' : 'Pelanggan mengaku sudah membayar. Konfirmasi setelah dana atau uang diterima.'}</small></div>
        <div className="rowactions">{(pending.kind !== 'qr' || data?.demo === false) && <Button size="sm" disabled={busy} onClick={async () => { const j = await call({action: 'confirm', id: pending.id}, 'Pembayaran dikonfirmasi.'); if (j) onChange(); }}><Check size={15}/> Konfirmasi</Button>}<button disabled={busy} onClick={() => call({action: 'cancel', id: pending.id}, 'Permintaan dibatalkan.')}>Tolak</button></div></div>
      {error && <p className="error" role="alert">{error}</p>}</div>;
  }

  if (!order.verified) return <div className="paypanel"><h3>Pembayaran</h3><p className="muted">Tagihan tersedia setelah FO memverifikasi pesanan.</p></div>;
  if (rest <= 0) return <div className="paypanel"><div className="successnote"><Check size={17}/>Tagihan sudah lunas.</div></div>;

  if (pending) return <div className="paypanel"><h3>Selesaikan pembayaran</h3>
    <div className="payamount"><span>{pending.method}</span><strong>{money(pending.amount)}</strong></div>
    {pending.kind === 'qr' && <div className="payqr"><img src={'/api/bayar/qr?id=' + pending.id} alt="Kode QR pembayaran" width={196} height={196}/><p>Pindai kode dengan kamera ponsel, lalu konfirmasi pembayaran di halaman yang terbuka.</p><a className="linkbutton" href={'/bayar/' + pending.id} target="_blank" rel="noreferrer">Buka halaman bayar di perangkat ini</a></div>}
    {pending.kind === 'bank' && data && <dl className="paybank"><dt>Bank</dt><dd>{data.bank.bank}</dd><dt>Nomor rekening</dt><dd>{data.bank.number}</dd><dt>Atas nama</dt><dd>{data.bank.holder}</dd><dt>Berita</dt><dd>{order.id}</dd></dl>}
    {pending.kind === 'cash' && <p className="muted">Bayar tunai di kasir Printora sebesar {money(pending.amount)} dan sebutkan nomor pesanan {order.id}.</p>}
    {(pending.kind === 'bank' || pending.kind === 'cash' || pending.kind === 'other') && <p className="muted">FO akan mengonfirmasi setelah pembayaran diterima. Status ini diperbarui otomatis.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button disabled={busy} onClick={() => call({action: 'cancel', id: pending.id}, 'Permintaan dibatalkan.')}>Ganti metode atau nominal</button></div></div>;

  return <div className="paypanel"><h3>Bayar tagihan</h3><p className="muted">Sisa tagihan {money(rest)}{dueDp > 0 ? `, DP yang diminta ${money(dueDp)}` : ''}.</p>
    <fieldset className="payopts"><legend>Nominal</legend>{options.map((o) => <label key={o.value} className={amount === o.value ? 'on' : ''}><input type="radio" name="amt" checked={amount === o.value} onChange={() => setAmount(o.value)}/><span>{o.label}</span><b>{money(o.value)}</b></label>)}</fieldset>
    <fieldset className="payopts"><legend>Metode</legend>{(data?.methods || []).map((m) => <label key={m} className={method === m ? 'on' : ''}><input type="radio" name="mtd" checked={method === m} onChange={() => setMethod(m)}/><span className="payicon"><Icon kind={kindOf(m)}/></span><span>{m}</span><small>{hint[kindOf(m)]}</small></label>)}</fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <Button disabled={busy || !method || !amount} onClick={async () => { const j = await call({action: 'create', orderId: order.id, method, amount}); if (j?.id) seen.current = j.id; }}>{busy ? 'Memproses…' : 'Lanjutkan'}</Button></div>;
}
