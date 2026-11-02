'use client';
import { AuthForm, api, type SessionUser } from '../components/auth';
import { ToastHost } from '../components/notify';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ClipboardList, Menu, PackageCheck, Palette, ShieldCheck, X } from 'lucide-react';
import { PrintoraMark } from '../components/printora';
import { catClass } from '../lib/catalog-ui';
import { ProductPhoto, Sep } from '../components/printsample';
import { Splash } from '../components/splash';
import { uploadFile } from '../lib/upload';
import { ACCEPT_ATTR, ACCEPT_LABEL, MAX_UPLOAD_MB_UI, formatSize, kindOf } from '../lib/files';
import './storefront.css';

type Product = {id:number;name:string;category:string;description:string;hint:string;sample:string;style:string};
type Panel='order'|'receipt'|'login'|null;
type Receipt={orderId:string;username?:string;password?:string;uploadError?:string;fileName?:string;sentTo?:string[]};

export default function Storefront(){
  const [panel,setPanel]=useState<Panel>(null);
  const [products,setProducts]=useState<Product[]>([]);
  const [me,setMe]=useState<SessionUser|null>(null);
  const [product,setProduct]=useState('');
  const [mode,setMode]=useState<'desain'|'cetak'>('desain');
  const [picked,setPicked]=useState<File|null>(null);
  const [pct,setPct]=useState<number|null>(null);
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [error,setError]=useState('');
  const [exists,setExists]=useState(false);
  const [busy,setBusy]=useState(false);
  const [filter,setFilter]=useState('Semua');const [ready,setReady]=useState(false);const [menu,setMenu]=useState(false);
  const requestId=useRef('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;if(panel&&!el?.open)el?.showModal();if(!panel&&el?.open)el.close();},[panel]);
  useEffect(()=>{
    api<{items:Product[]}>('/api/katalog').then(r=>{setProducts(r.items);setProduct(p=>p||r.items[0]?.name||'');}).catch(()=>{}).finally(()=>setReady(true));
    api<{user:SessionUser|null}>('/api/auth/me').then(r=>setMe(r.user)).catch(()=>{});
  },[]);
  const workspace=()=>{window.location.href='/operasional';};
  function openOrder(name:string){setProduct(name);setError('');setExists(false);setPicked(null);setPct(null);setMode('desain');requestId.current=crypto.randomUUID();setPanel('order');}
  // Memesan tidak memerlukan login; akun pelanggan dibuat otomatis saat pesanan disimpan.
  function order(name=products[0]?.name||''){if(me&&me.role!=='customer'){setError('');setPanel('login');return;}openOrder(name);}
  function history(){if(me)workspace();else{setError('');setPanel('login');}}
  function authed(){workspace();}
  async function leave(){await api('/api/auth/logout',{}).catch(()=>{});setMe(null);setPanel(null);}
  function pick(f?:File){setError('');setPicked(null);if(!f)return;if(f.size>MAX_UPLOAD_MB_UI*1048576){setError('Ukuran berkas maksimal '+MAX_UPLOAD_MB_UI+' MB.');return;}if(!kindOf(f.name)){setError('Gunakan '+ACCEPT_LABEL+'.');return;}setPicked(f);}
  /** Mengunggah berkas pilihan lalu melampirkannya ke pesanan; kegagalan tidak membatalkan pesanan. */
  async function attach(orderId:string):Promise<string|undefined>{
    if(!picked)return undefined;
    try{setPct(0);const up=await uploadFile(picked,setPct);await api('/api/pengunjung',{action:'attach',orderId,file:up.id,fileName:up.name});return undefined;}
    catch(e){return (e as Error).message;}finally{setPct(null);}
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;
    if(mode==='cetak'&&!picked){setError('Opsi langsung cetak memerlukan berkas siap cetak.');return;}
    setBusy(true);setError('');setExists(false);
    try{
      let orderId:string,username:string|undefined,password:string|undefined,sentTo:string[]|undefined;
      if(me?.role==='customer'){
        const r=await api<{orderId:string}>('/api/pengunjung',{action:'create',requestId:requestId.current,title:product,spec:f.spec,qty:f.qty,mode});
        orderId=r.orderId;
      }else{
        const r=await api<{orderId:string;username:string;password:string;sentTo:string[]}>('/api/pesan',{name:f.name,phone:f.phone,email:f.email,product,spec:f.spec,qty:f.qty,mode,requestId:requestId.current,website:f.website});
        orderId=r.orderId;username=r.username;password=r.password;sentTo=r.sentTo;
        setMe((await api<{user:SessionUser|null}>('/api/auth/me')).user);
      }
      const uploadError=await attach(orderId);
      setReceipt({orderId,username,password,uploadError,fileName:picked?.name,sentTo});setPanel('receipt');
    }catch(err){const x=err as Error&{status?:number};setError(x.message);setExists(x.status===409);}
    finally{setBusy(false);}
  }
  const chosen=products.find(p=>p.name===product)||products[0];
  const guest=!(me&&me.role==='customer');
  return <div className="store"><header className="shopnav"><a href="/" className="shopbrand"><PrintoraMark size={24}/><b>Printora<small>SISTEM ALUR PERCETAKAN</small></b></a><button className="navtoggle" aria-label="Menu" aria-expanded={menu} onClick={()=>setMenu(m=>!m)}>{menu?<X size={20}/>:<Menu size={20}/>}</button><nav aria-label="Navigasi pengunjung" className={menu?'open':''} onClick={()=>setMenu(false)}><a href="#beranda" className="active">Beranda</a><a href="#layanan">Layanan</a><a href="#cara">Cara pesan</a><button onClick={history}>Pesanan saya</button>{me?<><span className="shopuser">{me.name}</span><button onClick={workspace}>Ruang kerja</button><button onClick={leave}>Keluar</button></>:<button onClick={()=>{setError('');setPanel('login');}}>Masuk</button>}</nav><button className="shopbtn navorder" onClick={()=>order()}>Pesan cetak <ArrowUpRight size={16}/></button></header>
  <main><section id="beranda" className="shophero"><div className="herocopy"><h1>Cetak lebih mudah, cepat, dan <em>profesional.</em></h1><p>Printora membantu Anda memesan banner, stiker, kartu nama, brosur, dan undangan dengan alur yang jelas: pilih produk, pantau tahapnya, lalu ambil hasilnya.</p><div className="herolinks"><a className="shopbtn" href="#layanan">Lihat layanan <ArrowRight size={17}/></a><button onClick={()=>order()}>Mulai pesanan <ArrowUpRight size={15}/></button></div></div><div className="heroart"><img className="herologo" src="/brand/logo-mark.png" alt="" width={420} height={420}/><ul className="heroperks">{['Proses cepat dan transparan','Kualitas cetak terbaik','Dukungan profesional'].map(t=><li key={t}><CheckCircle2 size={20}/>{t}</li>)}</ul></div></section>
<section id="layanan" className="catalog"><div className="cataloghead"><h2>Layanan</h2></div><div className="chips">{['Semua','Promosi','Kemasan','Identitas','Acara'].map(f=><button key={f} aria-pressed={f===filter} onClick={()=>setFilter(f)}>{f}</button>)}</div>
  {!products.length&&<p>Belum ada layanan yang ditampilkan.</p>}<div className="productgrid">{products.filter(p=>filter==='Semua'||p.category===filter).map(p=><article key={p.name}><div className={'producticon '+catClass(p.category)}><ProductPhoto name={p.name}/></div><div className="productcopy"><span className={'catlabel '+catClass(p.category)}>{p.category}</span><h3>{p.name}</h3><p>{p.description}</p><button onClick={()=>order(p.name)}>Pesan produk ini <ArrowUpRight size={15}/></button></div></article>)}</div></section>
  <section id="cara" className="how"><h2>Cara memesan</h2><div className="howwrap"><ol className="howlist">{[[ClipboardList,'Ajukan pesanan','Anda','Isi formulir pesanan: nama, kontak, spesifikasi, jumlah, dan berkas. Akun dibuat otomatis.'],[ShieldCheck,'Verifikasi dan DP','Front Office','FO memeriksa spesifikasi, lalu menetapkan biaya, DP, dan tenggat.'],[Palette,'Tinjau desain','Anda dan Tim Desain','Setujui desain atau minta revisi di Ruang Kerja. Produksi dimulai setelah desain final disetujui dan DP tercatat.'],[PackageCheck,'Ambil hasil cetak','Front Office','Saat berstatus Siap diambil, lunasi sisa tagihan lalu terima hasil cetak.']].map(([Ic,t,w,d],i)=>{const I=Ic as typeof ClipboardList;return <li key={t as string}><b>0{i+1}</b><span className="howicon"><I size={26}/></span><div><h3>{t as string}</h3><p>{d as string}</p></div><small className="who">{w as string}</small></li>;})}</ol><img className="howart" src="/brand/bg/cara-ilustrasi-v2.webp" alt="" loading="lazy"/></div>
  <div className="faqshop">{[['Bagaimana saya memantau pesanan?','Buka Pesanan saya. Setiap pesanan menampilkan tahap, langkah berikutnya, biaya, dan desain yang perlu Anda tinjau.'],['Kapan produksi dimulai?','Setelah desain final Anda setujui dan DP yang ditetapkan FO tercatat.'],['Bisakah saya meminta revisi desain?','Bisa, selama desain belum Anda setujui. Setelah disetujui, desain dikunci.'],['Apakah ada pemberitahuan otomatis?','Belum. FO menghubungi Anda langsung saat pesanan siap diambil.']].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section></main>
  <footer className="shopfooter"><a href="/" className="footbrand"><img src="/brand/logo-mark.png" alt="" width={44} height={44}/><b>PRINTORA<small>SISTEM ALUR PERCETAKAN</small></b></a><nav aria-label="Tautan bawah"><a href="#beranda">Beranda</a><a href="#layanan">Layanan</a><button onClick={history}>Pesanan saya</button><a href="#cara">Bantuan</a></nav><div className="foottag"><b>Cetak lebih mudah, bersama PRINTORA</b><i/></div></footer>
  <ToastHost/><Splash show={!ready} label="Menyiapkan etalase…"/>
  <dialog ref={dialog} className="shopdialog" onCancel={e=>{if(busy)e.preventDefault();else setPanel(null);}}><div className="dialogbar"><span>Printora</span><button aria-label="Tutup" disabled={busy} onClick={()=>setPanel(null)}><X size={18}/></button></div>
  {error&&<p role="alert" className="error">{error}{exists&&<> <button type="button" className="subtle" onClick={()=>{setError('');setExists(false);setPanel('login');}}>Masuk ke akun</button></>}</p>}
  {panel==='login'&&(me&&me.role!=='customer'?<section><h2>Gunakan akun pelanggan</h2><p>Anda masuk sebagai staf. Memesan dari etalase memakai akun Pelanggan, jadi buka Ruang Kerja atau keluar lebih dulu.</p><button className="shopbtn" onClick={workspace}>Buka Ruang Kerja</button> <button onClick={leave}>Keluar</button></section>:<AuthForm onDone={authed} note="Masuk dengan username dan kata sandi yang Anda terima saat memesan. Belum punya akun? Cukup pesan, akun dibuat otomatis."/>)}
  {panel==='order'&&<form key={requestId.current} onSubmit={submit}><h2>Pesan cetak</h2><p>{guest?'Tanpa login. Akun dibuat otomatis setelah pesanan disimpan, lalu Anda diarahkan ke Ruang Kerja.':'Atas nama '+me?.name+'.'} FO memeriksa kebutuhan Anda sebelum menetapkan harga dan DP.</p>
  {guest&&<><label>Nama<input name="name" maxLength={100} required autoComplete="name" placeholder="Nama Anda atau usaha"/></label><div className="contactfields"><label>No. telepon / WhatsApp<input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="081234567890"/></label><label>Email<input name="email" type="email" maxLength={120} autoComplete="email" placeholder="nama@email.com"/></label></div><small className="hintline">Isi salah satu atau keduanya. Info pesanan dan akses masuk dikirim ke kontak ini.</small><input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp"/></>}
  <label>Tipe pesanan<select value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option key={p.name}>{p.name}</option>)}</select></label>
  <label>Spesifikasi<textarea name="spec" maxLength={2000} required placeholder={chosen?.hint}/></label>
  <label>Jumlah<input name="qty" type="number" min="1" step="1" max="1000000000" defaultValue="1" required/></label>
  <fieldset className="modes"><legend>Opsi pengerjaan</legend><label className={mode==='desain'?'on':''}><input type="radio" name="mode" checked={mode==='desain'} onChange={()=>setMode('desain')}/><b>Desain dulu</b><small>Tim Desain membuatkan desain, Anda menyetujui sebelum cetak.</small></label><label className={mode==='cetak'?'on':''}><input type="radio" name="mode" checked={mode==='cetak'} onChange={()=>setMode('cetak')}/><b>Langsung cetak</b><small>Berkas Anda sudah siap cetak.</small></label></fieldset>
  <label>Berkas {mode==='cetak'?'siap cetak':'(opsional: logo, sketsa, contoh)'}<input type="file" accept={ACCEPT_ATTR} onChange={e=>pick(e.target.files?.[0])}/></label>{picked&&<small className="uploaded"><Check size={13}/> {picked.name} <Sep/> {formatSize(picked.size)}</small>}{pct!==null&&<div className="uploadbar" role="progressbar" aria-valuenow={pct}><i style={{width:pct+'%'}}/><span>Mengunggah… {pct}%</span></div>}<small className="hintline">{ACCEPT_LABEL} <Sep/> Maksimal {MAX_UPLOAD_MB_UI} MB</small>
  <button className="shopbtn" disabled={busy}>{busy?(pct!==null?'Mengunggah berkas…':'Menyimpan…'):'Simpan pesanan'} <ArrowRight size={16}/></button></form>}
  {panel==='receipt'&&receipt&&<section className="receipt"><Check/><h2>Pesanan diterima</h2><strong>{receipt.orderId}</strong><p>Pesanan Anda menunggu verifikasi FO. Biaya, DP, dan tenggat muncul setelah spesifikasi diperiksa.</p>
  {receipt.password&&<div className="cred"><b>Akses masuk Anda</b><dl><dt>Username</dt><dd><code>{receipt.username}</code></dd><dt>Kata sandi</dt><dd><code>{receipt.password}</code></dd></dl><small>Catat sekarang: kata sandi hanya tampil sekali. Saat pertama masuk, Anda diminta menggantinya.</small>{!!receipt.sentTo?.length&&<small className="sentnote">Info pesanan dan akses ini juga dikirim ke {receipt.sentTo.map(c=>c==='whatsapp'?'WhatsApp':'email').join(' dan ')} Anda.</small>}</div>}
  {receipt.uploadError&&<p className="error" role="alert">Pesanan tersimpan, tetapi berkas belum terunggah: {receipt.uploadError} Unggah ulang dari Ruang Kerja.</p>}
  <button className="shopbtn" onClick={workspace}>Buka Ruang Kerja <ArrowRight size={16}/></button></section>}</dialog></div>;
}
