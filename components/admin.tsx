'use client';
import {Button} from '@/components/ui/button';
import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {Pencil, Plus, Search, X, KeyRound} from 'lucide-react';
import {roles, defaultMethods, defaultChannels} from '../lib/domain';
import {api} from './auth';

type AUser = {id: string; username: string; name: string; phone: string; email: string; role: string; active: boolean; hasLogin: boolean; created: string; lastLogin: string};
type Item = {id: number; name: string; category: string; description: string; hint: string; sample: string; style: string; sort: number; active: boolean};
type Named = {name: string; active: boolean};
type Cfg = {waha_enabled: string; waha_url: string; waha_session: string; hasWahaKey: boolean; smtp_enabled: string; smtp_host: string; smtp_port: string; smtp_secure: string; smtp_user: string; hasSmtpPass: boolean; mail_from: string; public_url: string};
type Msg = {id: number; at: string; channel: string; kind: string; to: string; ok: boolean; error: string};
type Overview = {users: AUser[]; catalog: Item[]; methods: Named[]; channels: Named[]; counts: {orders: number; files: number}; settings: Cfg; messages: Msg[]};
const BUILTIN_METHODS = defaultMethods, BUILTIN_CHANNELS = defaultChannels;
const STYLES = ['banner', 'label', 'card', 'poster', 'invitation'];
const when = (s: string) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Belum pernah');

/** Memuat /api/admin dan menyediakan `act` (POST aksi, hasilnya menggantikan data). */
function useAdmin() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Overview>('/api/admin').then(setData).catch((e) => setError(e.message)); }, []);
  async function act(action: string, body: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(true); setError('');
    try { setData(await api<Overview>('/api/admin', {action, data: body})); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  return {data, error, setError, busy, act};
}

function Modal({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  return <div className="modalback" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}>
    <div className="sectionhead"><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="Tutup dialog"><X size={20}/></button></div>{children}
  </section></div>;
}
const Fld = ({label, children}: {label: string; children: ReactNode}) => <label className="field"><span>{label}</span>{children}</label>;
const formValues = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; };

export function AdminUsers({meId}: {meId: string}) {
  const {data, error, setError, busy, act} = useAdmin();
  const [query, setQuery] = useState(''), [role, setRole] = useState('Semua');
  const [modal, setModal] = useState<{kind: 'create' | 'edit' | 'password'; user?: AUser} | null>(null);
  const close = () => { setModal(null); setError(''); };
  const users = (data?.users || []).filter((u) => (role === 'Semua' || u.role === role) && (u.name + u.username + u.phone + u.email).toLowerCase().includes(query.toLowerCase()));
  const u = modal?.user;
  return <>
    <div className="pagehead"><div><h1>Pengguna</h1><p>Akun, peran, status aktif, dan kata sandi.</p></div><Button onClick={() => setModal({kind: 'create'})}><Plus size={17}/> Tambah pengguna</Button></div>
    {error && !modal && <div className="error" role="alert">{error}</div>}
    <section className="panel orderspanel">
      <div className="toolbar"><Search size={18}/><input aria-label="Cari pengguna" placeholder="Cari nama, username, telepon, atau email…" value={query} onChange={(e) => setQuery(e.target.value)}/>
        <select aria-label="Filter peran" value={role} onChange={(e) => setRole(e.target.value)}><option>Semua</option>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="tablewrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Status</th><th>Login terakhir</th><th/></tr></thead><tbody>
        {users.map((x) => <tr key={x.id}><td><b>{x.name}</b><small>{x.phone || 'Tanpa telepon'}{x.email ? ' · ' + x.email : ''}</small></td><td>{x.username || <small>Tanpa akun masuk</small>}</td><td>{roles[x.role as keyof typeof roles]}</td>
          <td><span className={'mini' + (x.active ? '' : ' off')}>{x.active ? 'AKTIF' : 'NONAKTIF'}</span></td><td>{when(x.lastLogin)}</td>
          <td className="actioncell"><button className="linkbutton" onClick={() => setModal({kind: 'edit', user: x})}><Pencil size={14}/> Ubah</button><button className="linkbutton" onClick={() => setModal({kind: 'password', user: x})}><KeyRound size={14}/> Kata sandi</button></td></tr>)}
      </tbody></table>{data && !users.length && <p className="emptytext">Tidak ada pengguna yang cocok.</p>}</div>
      <div className="tablefoot">{users.length} pengguna ditampilkan</div>
    </section>
    {modal?.kind === 'create' && <Modal title="Tambah pengguna" onClose={close}><form onSubmit={async (e) => { const v = formValues(e); if (await act('user.create', v)) close(); }}>
      {error && <p className="error" role="alert">{error}</p>}
      <Fld label="Nama"><input name="name" required maxLength={100}/></Fld><Fld label="Nomor telepon"><input name="phone" type="tel" maxLength={30}/></Fld><Fld label="Email (untuk notifikasi)"><input name="email" type="email" maxLength={120} autoCapitalize="none" placeholder="nama@contoh.com"/></Fld>
      <Fld label="Peran"><select name="role" defaultValue="fo">{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Fld>
      <Fld label="Username"><input name="username" required minLength={3} maxLength={32} autoCapitalize="none"/></Fld>
      <Fld label="Kata sandi awal (min. 8 karakter)"><input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></Fld>
      <div className="actions"><button type="button" onClick={close}>Batal</button><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button></div></form></Modal>}
    {modal?.kind === 'edit' && u && <Modal title={'Ubah ' + u.name} onClose={close}><form onSubmit={async (e) => { const v = formValues(e); if (await act('user.update', {id: u.id, name: v.name, phone: v.phone, email: v.email, role: v.role, username: v.username, active: v.active === 'on'})) close(); }}>
      {error && <p className="error" role="alert">{error}</p>}
      <Fld label="Nama"><input name="name" defaultValue={u.name} required maxLength={100}/></Fld><Fld label="Nomor telepon"><input name="phone" type="tel" defaultValue={u.phone} maxLength={30}/></Fld><Fld label="Email (untuk notifikasi)"><input name="email" type="email" defaultValue={u.email} maxLength={120} autoCapitalize="none" placeholder="nama@contoh.com"/></Fld>
      <Fld label="Peran"><select name="role" defaultValue={u.role} disabled={u.id === meId}>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Fld>
      <Fld label="Username"><input name="username" defaultValue={u.username} placeholder="Kosong = tanpa akun masuk" maxLength={32} autoCapitalize="none"/></Fld>
      <label className="field checkrow"><span><input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === meId}/> Akun aktif (dapat masuk)</span></label>
      <small>Peran tidak dapat diubah bila pengguna sudah terkait dengan pesanan; nonaktifkan akun lalu buat akun baru.</small>
      <div className="actions"><button type="button" onClick={close}>Batal</button><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button></div></form></Modal>}
    {modal?.kind === 'password' && u && <Modal title={'Atur kata sandi ' + u.name} onClose={close}><form onSubmit={async (e) => { const v = formValues(e); if (await act('user.password', {id: u.id, password: v.password, username: v.username})) close(); }}>
      {error && <p className="error" role="alert">{error}</p>}
      {!u.username && <Fld label="Username baru"><input name="username" required minLength={3} maxLength={32} autoCapitalize="none"/></Fld>}
      <Fld label="Kata sandi baru (min. 8 karakter)"><input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></Fld>
      <small>Semua sesi aktif pengguna ini akan diakhiri. Sampaikan kata sandi baru secara langsung.</small>
      <div className="actions"><button type="button" onClick={close}>Batal</button><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button></div></form></Modal>}
  </>;
}

function NamedList({title, hint, kind, items, builtin, act, busy}: {title: string; hint: string; kind: 'method' | 'channel'; items: Named[]; builtin: string[]; act: (a: string, b?: Record<string, unknown>) => Promise<boolean>; busy: boolean}) {
  return <section className="panel"><h2>{title}</h2><p className="muted">{hint}</p>
    <form className="inlineform" onSubmit={async (e) => { const form = e.currentTarget; const v = formValues(e); if (await act(kind + '.add', {name: v.name})) form.reset(); }}>
      <input name="name" placeholder={'Tambah ' + title.toLowerCase() + '…'} required maxLength={30} aria-label={'Nama ' + title}/><Button disabled={busy}><Plus size={15}/> Tambah</Button></form>
    <div className="namedlist">{items.map((i) => <div key={i.name}><span className={i.active ? '' : 'inactive'}>{i.name}{builtin.includes(i.name) && <small> · bawaan</small>}</span>
      <button className="linkbutton" disabled={busy} onClick={() => act(kind + '.toggle', {name: i.name, active: !i.active})}>{i.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
      {!builtin.includes(i.name) && <button className="linkbutton danger" disabled={busy} onClick={() => { if (confirm('Hapus "' + i.name + '"? Data transaksi lama tetap menyimpan namanya.')) void act(kind + '.delete', {name: i.name}); }}>Hapus</button>}</div>)}</div>
  </section>;
}

export function AdminMaster() {
  const {data, error, setError, busy, act} = useAdmin();
  const [edit, setEdit] = useState<Item | 'new' | null>(null);
  const close = () => { setEdit(null); setError(''); };
  const it = edit && edit !== 'new' ? edit : null;
  return <>
    <div className="pagehead"><div><h1>Master data</h1><p>Katalog etalase, metode pembayaran, dan saluran pemberitahuan.</p></div><Button onClick={() => setEdit('new')}><Plus size={17}/> Tambah produk</Button></div>
    {error && !edit && <div className="error" role="alert">{error}</div>}
    <section className="panel orderspanel"><div className="sectionhead"><div><h2>Katalog layanan</h2><p className="muted">Produk yang tampil di etalase. Produk nonaktif disembunyikan, tidak dihapus dari pesanan lama.</p></div></div>
      <div className="tablewrap"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Urutan</th><th>Status</th><th/></tr></thead><tbody>
        {(data?.catalog || []).map((c) => <tr key={c.id}><td><b>{c.name}</b><small>{c.description}</small></td><td>{c.category}</td><td>{c.sort}</td><td><span className={'mini' + (c.active ? '' : ' off')}>{c.active ? 'AKTIF' : 'NONAKTIF'}</span></td>
          <td className="actioncell"><button className="linkbutton" onClick={() => setEdit(c)}><Pencil size={14}/> Ubah</button></td></tr>)}
      </tbody></table></div></section>
    <div className="mastergrid">{data && <><NamedList title="Metode pembayaran" hint="Dipilih FO saat mencatat pembayaran." kind="method" items={data.methods} builtin={BUILTIN_METHODS} act={act} busy={busy}/><NamedList title="Saluran pemberitahuan" hint="Dipilih FO saat mencatat pemberitahuan ke pelanggan." kind="channel" items={data.channels} builtin={BUILTIN_CHANNELS} act={act} busy={busy}/></>}</div>
    {edit && <Modal title={it ? 'Ubah produk' : 'Tambah produk'} onClose={close}><form onSubmit={async (e) => { const v = formValues(e); if (await act('catalog.save', {id: it?.id, name: v.name, category: v.category, description: v.description, hint: v.hint, sample: v.sample, style: v.style, sort: Number(v.sort), active: v.active === 'on'})) close(); }}>
      {error && <p className="error" role="alert">{error}</p>}
      <Fld label="Nama produk"><input name="name" defaultValue={it?.name} required maxLength={100}/></Fld>
      <div className="formgrid"><Fld label="Kategori"><input name="category" defaultValue={it?.category} required maxLength={40} list="kategori"/></Fld><Fld label="Urutan"><input name="sort" type="number" defaultValue={it?.sort ?? (data?.catalog.length || 0)}/></Fld></div>
      <datalist id="kategori">{['Promosi', 'Kemasan', 'Identitas', 'Acara'].map((k) => <option key={k} value={k}/>)}</datalist>
      <Fld label="Deskripsi"><textarea name="description" defaultValue={it?.description} required maxLength={300}/></Fld>
      <Fld label="Petunjuk pengisian spesifikasi"><input name="hint" defaultValue={it?.hint} required maxLength={300}/></Fld>
      <input type="hidden" name="sample" defaultValue={it?.sample || 'Produk'}/><input type="hidden" name="style" defaultValue={it?.style || 'poster'}/>
      <label className="field checkrow"><span><input type="checkbox" name="active" defaultChecked={it?.active ?? true}/> Tampilkan di etalase</span></label>
      <div className="actions">{it && <button type="button" className="danger" disabled={busy} onClick={async () => { if (confirm('Hapus produk "' + it.name + '" dari katalog?') && await act('catalog.delete', {id: it.id})) close(); }}>Hapus</button>}<button type="button" onClick={close}>Batal</button><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button></div></form></Modal>}
  </>;
}

/** Pengaturan pengiriman pesan: WhatsApp (WAHA), email (SMTP), dan alamat situs untuk tautan di pesan. */
export function AdminSettings() {
  const {data, error, busy, act} = useAdmin();
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<{channel: string; ok: boolean; msg: string} | null>(null);
  const c = data?.settings;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaved(false);
    const f = new FormData(e.currentTarget), v = Object.fromEntries(f) as Record<string, string>;
    const ok = await act('settings.save', {...v, waha_enabled: f.has('waha_enabled'), smtp_enabled: f.has('smtp_enabled'), smtp_secure: f.has('smtp_secure'), clear_waha_key: f.has('clear_waha_key'), clear_smtp_pass: f.has('clear_smtp_pass')});
    if (ok) setSaved(true);
  }
  async function runTest(channel: string) {
    const to = (document.getElementById('test-' + channel) as HTMLInputElement | null)?.value.trim() || '';
    if (!to) { setTest({channel, ok: false, msg: 'Isi tujuan uji lebih dulu.'}); return; }
    setTest({channel, ok: true, msg: 'Mengirim…'});
    const ok = await act('settings.test', {channel, to});
    setTest({channel, ok, msg: ok ? 'Terkirim. Periksa perangkat penerima.' : ''});
  }
  return <>
    <div className="pagehead"><div><h1>Pengaturan</h1><p>Saluran pengiriman info pesanan dan akses masuk ke pelanggan. Kredensial hanya diisi di sini dan disimpan terenkripsi.</p></div></div>
    {error && <div className="error" role="alert">{error}</div>}{saved && !error && <div className="successnote">Pengaturan disimpan.</div>}
    {c && <form key={JSON.stringify(c)} onSubmit={save} className="settingsform">
      <section className="panel"><div className="sectionhead"><div><h2>WhatsApp (WAHA)</h2><p className="muted">Layanan WAHA berjalan terpisah (mis. Docker). Gunakan nomor khusus percetakan, bukan nomor pribadi: WhatsApp dapat memblokir nomor yang dianggap spam.</p></div></div>
        <label className="field checkrow"><span><input type="checkbox" name="waha_enabled" defaultChecked={c.waha_enabled === '1'}/> Aktifkan pengiriman WhatsApp</span></label>
        <div className="formgrid"><Fld label="Alamat WAHA"><input name="waha_url" defaultValue={c.waha_url} placeholder="http://localhost:3000" maxLength={200}/></Fld><Fld label="Nama sesi"><input name="waha_session" defaultValue={c.waha_session || 'default'} maxLength={60}/></Fld></div>
        <Fld label={'API key' + (c.hasWahaKey ? ' (tersimpan; kosongkan untuk tidak mengubah)' : '')}><input name="waha_key" type="password" autoComplete="new-password" maxLength={200} placeholder={c.hasWahaKey ? '••••••••' : 'Opsional'}/></Fld>
        {c.hasWahaKey && <label className="field checkrow"><span><input type="checkbox" name="clear_waha_key"/> Hapus API key tersimpan</span></label>}
        <div className="testrow"><input id="test-whatsapp" placeholder="Nomor tujuan uji, mis. 081234567890" maxLength={20}/><button type="button" disabled={busy} onClick={() => runTest('whatsapp')}>Kirim uji WhatsApp</button></div>
        {test?.channel === 'whatsapp' && test.ok && <small className="uploaded">{test.msg}</small>}
      </section>
      <section className="panel"><div className="sectionhead"><div><h2>Email (SMTP)</h2><p className="muted">Port 587 memakai STARTTLS; centang SSL/TLS langsung untuk port 465.</p></div></div>
        <label className="field checkrow"><span><input type="checkbox" name="smtp_enabled" defaultChecked={c.smtp_enabled === '1'}/> Aktifkan pengiriman email</span></label>
        <div className="formgrid"><Fld label="Host SMTP"><input name="smtp_host" defaultValue={c.smtp_host} placeholder="smtp.contoh.co.id" maxLength={120}/></Fld><Fld label="Port"><input name="smtp_port" defaultValue={c.smtp_port || '587'} inputMode="numeric" maxLength={5}/></Fld></div>
        <label className="field checkrow"><span><input type="checkbox" name="smtp_secure" defaultChecked={c.smtp_secure === '1'}/> SSL/TLS langsung (port 465)</span></label>
        <div className="formgrid"><Fld label="Username SMTP"><input name="smtp_user" defaultValue={c.smtp_user} autoComplete="off" maxLength={120}/></Fld><Fld label={'Kata sandi SMTP' + (c.hasSmtpPass ? ' (tersimpan)' : '')}><input name="smtp_pass" type="password" autoComplete="new-password" maxLength={200} placeholder={c.hasSmtpPass ? '••••••••' : ''}/></Fld></div>
        {c.hasSmtpPass && <label className="field checkrow"><span><input type="checkbox" name="clear_smtp_pass"/> Hapus kata sandi SMTP tersimpan</span></label>}
        <Fld label="Alamat pengirim"><input name="mail_from" defaultValue={c.mail_from} placeholder="Printora <info@contoh.co.id>" maxLength={160}/></Fld>
        <div className="testrow"><input id="test-email" type="email" placeholder="Email tujuan uji" maxLength={120}/><button type="button" disabled={busy} onClick={() => runTest('email')}>Kirim uji email</button></div>
        {test?.channel === 'email' && test.ok && <small className="uploaded">{test.msg}</small>}
      </section>
      <section className="panel"><div className="sectionhead"><div><h2>Alamat situs</h2><p className="muted">Dipakai untuk tautan Ruang Kerja di pesan. Kosongkan untuk memakai alamat tempat pelanggan memesan.</p></div></div>
        <Fld label="Alamat publik"><input name="public_url" defaultValue={c.public_url} placeholder="https://printora.contoh.co.id" maxLength={200}/></Fld></section>
      <div className="actions"><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button></div>
    </form>}
    <section className="panel orderspanel"><div className="sectionhead"><div><h2>Riwayat pengiriman</h2><p className="muted">15 pengiriman terakhir. Isi pesan dan kata sandi tidak disimpan.</p></div></div>
      <div className="tablewrap"><table><thead><tr><th>Waktu</th><th>Saluran</th><th>Jenis</th><th>Tujuan</th><th>Hasil</th></tr></thead><tbody>
        {(data?.messages || []).map((m) => <tr key={m.id}><td>{when(m.at)}</td><td>{m.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</td><td>{m.kind}</td><td>{m.to}</td><td><span className={'mini' + (m.ok ? '' : ' off')}>{m.ok ? 'TERKIRIM' : 'GAGAL'}</span>{!m.ok && <small>{m.error}</small>}</td></tr>)}
        {data && !data.messages.length && <tr><td colSpan={5}>Belum ada pengiriman.</td></tr>}
      </tbody></table></div></section>
  </>;
}
