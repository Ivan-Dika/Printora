'use client';
import {Button} from '@/components/ui/button';
import {useState, type FormEvent} from 'react';
import {ArrowLeft, BellRing, Eye, EyeOff, FileCheck2, Lock, ReceiptText, ShieldCheck, User} from 'lucide-react';
import {BRAND} from '../lib/brand';

export type SessionUser = {id: string; username: string; name: string; phone: string; role: string; active: boolean; mustChange?: boolean};

/** Panggilan JSON ke API; galat server dilempar sebagai Error (dengan `status`). */
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: body === undefined ? undefined : {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j as {error?: string}).error || 'Permintaan gagal.'), {status: r.status});
  return j as T;
}

/** Formulir masuk. Akun dibuat oleh Admin; tidak ada pendaftaran mandiri. */
export function AuthForm({onDone, note}: {onDone: (u: SessionUser) => void; note?: string}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setError('');
    try { onDone((await api<{user: SessionUser}>('/api/auth/login', {username: b.username, password: b.password})).user); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const [show, setShow] = useState(false);
  return <form className="authform" onSubmit={submit}>
    <h2>Masuk</h2>
    {note && <p>{note}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <label className="field"><span>Username</span><span className="inputicon"><User size={17} aria-hidden="true"/><input name="username" autoComplete="username" required maxLength={32} autoCapitalize="none" spellCheck={false} autoFocus placeholder="mis. nama.anda1234"/></span></label>
    <label className="field"><span>Kata sandi</span><span className="inputicon"><Lock size={17} aria-hidden="true"/><input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} placeholder="Kata sandi Anda"/>
      <button type="button" className="eyebtn" aria-label={show ? 'Sembunyikan sandi' : 'Tampilkan sandi'} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
    <Button className="shopbtn w-full h-11" type="submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</Button>
  </form>;
}

/** Halaman masuk layar penuh untuk Ruang Kerja: panel merek di kiri (latar etalase), kartu masuk di kanan. */
export function LoginScreen({onDone}: {onDone: (u: SessionUser) => void}) {
  return <div className="loginpage">
    <section className="loginhero">
      <a className="loginbrand" href="/" aria-label="Kembali ke etalase Printora"><img src={BRAND.logoMark} width={46} height={46} alt=""/><b>PRINTORA<small>SISTEM ALUR PERCETAKAN</small></b></a>
      <div className="logincopy">
        <p className="kickerline"><i/> RUANG KERJA</p>
        <h1>Satu tempat untuk setiap pesanan cetak.</h1>
        <p>Pantau pesanan dari verifikasi sampai serah terima, tinjau desain, dan selesaikan pembayaran tanpa bolak-balik pesan.</p>
        <ul className="loginpoints">
          <li><FileCheck2 size={18}/><span><b>Tinjau dan setujui desain</b>Revisi dan persetujuan tercatat rapi.</span></li>
          <li><ReceiptText size={18}/><span><b>Bayar DP dan pelunasan</b>Status tagihan selalu terlihat jelas.</span></li>
          <li><BellRing size={18}/><span><b>Kabar otomatis</b>WhatsApp dan email di setiap tahap penting.</span></li>
        </ul>
      </div>
      <img className="loginart" src="/brand/bg/cara-ilustrasi-v2.webp" alt="" aria-hidden="true"/>
    </section>
    <section className="logincardwrap">
      <div className="logincard">
        <img className="logincardlogo" src={BRAND.logoMark} width={64} height={64} alt=""/>
        <h1>Selamat datang kembali</h1>
        <p className="loginsub">Masuk dengan akun yang Anda terima lewat pesan atau dari Admin.</p>
        <AuthForm onDone={onDone}/>
        <p className="loginhelp"><ShieldCheck size={15}/> Kata sandi sementara wajib diganti saat pertama masuk.</p>
        <a className="loginback" href="/"><ArrowLeft size={15}/> Kembali ke etalase</a>
      </div>
    </section>
  </div>;
}
