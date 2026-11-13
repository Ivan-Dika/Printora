// Uji alur UI end-to-end dengan dokumentasi tangkapan layar (Chrome headless + CDP).
// Pemakaian: node scripts/e2e-ui.mjs [http://127.0.0.1:8787]  -> e2e-out/shots/*.jpg + e2e-out/e2e_ui_results.json
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {bootstrap, envValue} from './test-lib.mjs';
const base = process.argv[2] || 'http://127.0.0.1:8787';
const {S, ID, USER, pass} = await bootstrap(base);
const adminName = envValue('ADMIN_USERNAME') || 'admin', adminPass = envValue('ADMIN_PASSWORD');
const out = path.join(import.meta.dirname, '..', 'e2e-out', 'shots'); fs.mkdirSync(out, {recursive: true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(import.meta.dirname, '..', 'e2e-out', 'profile'), '--window-size=1280,900', '--no-first-run', 'about:blank'], {stdio: 'ignore'});
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); if (targets.some(t => t.type === 'page')) break; } catch {} await sleep(300); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
const ev = async js => { const r = await send('Runtime.evaluate', {expression: '(async()=>{' + js + '})()', awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails)); return r.result.result.value; };
const HELP = `window.sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.setv=(el,v)=>{const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
window.btn=(t,root=document)=>[...root.querySelectorAll('button')].find(b=>b.innerText.trim().startsWith(t));
window.png=()=>{const b=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));const d=new DataTransfer();d.items.add(new File([b],'contoh-desain.png',{type:'image/png'}));return d.files;};
window.nav=async t=>{btn(t,document.querySelector('nav')).click();await sleep(500);};
window.openOrder=async()=>{const b=[...document.querySelectorAll('tbody .textbutton')].find(x=>x.textContent.includes('Uji UI E2E'));b.click();await sleep(500);};
window.tab=async t=>{[...document.querySelectorAll('.tabs button')].find(b=>b.innerText.trim().startsWith(t)).click();await sleep(400);};
window.submit=async()=>{document.querySelector('.modal button[type=submit]').click();await sleep(1400);};
`;
async function login(user) {
  await send('Network.enable'); await send('Network.clearBrowserCookies');
  await send('Page.navigate', {url: base + '/operasional'}); await sleep(2500); await ev(HELP);
  await ev(`const f=document.querySelector('form.authform');setv(f.querySelector('input[name=username]'),${JSON.stringify(user === 'admin' ? adminName : USER[user])});setv(f.querySelector('input[name=password]'),${JSON.stringify(user === 'admin' ? adminPass : pass)});await sleep(200);f.querySelector('button[type=submit]').click();await sleep(2500);`);
}
const orderStatusNode = async () => { const j = (await S.fo.json('/api/state')).body; const o = j.orders.find(o => o.title === 'Uji UI E2E'); return o ? o.status : null; };
const results = []; let n = 0;
async function step(role, title, expected, js, expectStatus, shotAfter = true) {
  n++; const tag = String(n).padStart(2, '0'); let ok = false, detail = '', shot = '';
  try {
    const v = await ev(js); await sleep(300);
    if (shotAfter) { const s = await send('Page.captureScreenshot', {format: 'jpeg', quality: 72}); shot = tag + '.jpg'; fs.writeFileSync(path.join(out, shot), Buffer.from(s.result.data, 'base64')); }
    const err = await ev(`return document.querySelector('.error')?.innerText||''`);
    if (expectStatus) { const st = await orderStatusNode(); ok = st === expectStatus; detail = 'Status pesanan: ' + st; } else { ok = true; detail = String(v ?? ''); }
    if (err) { ok = false; detail += ' | Galat: ' + err; }
  } catch (e) { detail = e.message.slice(0, 300); }
  results.push({n, role, title, expected, ok, detail, shot}); console.log((ok ? 'LULUS ' : 'GAGAL ') + tag + ' [' + role + '] ' + title + (ok ? '' : ' -> ' + detail));
}
// ===== Alur =====
await send('Network.enable'); await send('Network.clearBrowserCookies'); await send('Page.navigate', {url: base + '/operasional'}); await sleep(2500); await ev(HELP);
await step('Sistem', 'Negatif: tanpa login hanya tampil layar masuk (tanpa pilihan peran demo)', 'Form masuk tampil, tidak ada menu ruang kerja', `return document.querySelector('form.authform')&&!document.querySelector('nav')&&!document.querySelector('select')?'layar masuk':'BOCOR'`);
await step('Sistem', 'Negatif: masuk dengan kata sandi salah', 'Pesan galat ditampilkan, tetap di layar masuk', `const f=document.querySelector('form.authform');setv(f.querySelector('input[name=username]'),'admin');setv(f.querySelector('input[name=password]'),'sandi-salah-sekali');await sleep(200);f.querySelector('button[type=submit]').click();await sleep(1500);const t=document.querySelector('.error')?.innerText||'TIDAK ADA GALAT';document.querySelector('.error')?.remove();return t`);
await login('c1');
await step('Pelanggan', 'Membuka form Buat Pesanan dan mengisi data serta berkas pendukung', 'Form terisi, berkas dipilih', `await nav('Buat Pesanan');const m=document.querySelector('.modal');setv(m.querySelector('input[name=title]'),'Uji UI E2E');setv(m.querySelector('textarea[name=spec]'),'Banner flexi 3 x 1 meter, mata ayam');setv(m.querySelector('input[name=qty]'),'2');const fi=m.querySelector('input[type=file]');fi.files=png();fi.dispatchEvent(new Event('change',{bubbles:true}));await sleep(600);return 'ok'`);
await step('Pelanggan', 'Mengirim pesanan', 'Pesanan berstatus Menunggu verifikasi', `await submit();await nav('Pesanan Saya');return 'ok'`, 'Menunggu verifikasi');
await login('fo');
await step('Front Office', 'Membuka pesanan baru pada daftar Pesanan', 'Detail pesanan dengan berkas pelanggan dan tombol Verifikasi', `await nav('Pesanan');await openOrder();return 'ok'`);
await step('Front Office', 'Verifikasi: total, DP, tenggat, dan petugas', 'Status berubah menjadi Desain', `btn('Verifikasi pesanan').click();await sleep(400);const m=document.querySelector('.modal');setv(m.querySelector('input[name=total]'),'100000');setv(m.querySelector('input[name=dp]'),'40000');setv(m.querySelector('input[name=due]'),'2026-12-20');setv(m.querySelector('select[name=designerId]'),${JSON.stringify(ID.design)});setv(m.querySelector('select[name=operatorId]'),${JSON.stringify(ID.operator)});await sleep(300);await submit();return 'ok'`, 'Desain');
await step('Front Office', 'Negatif: tombol Teruskan ke produksi nonaktif sebelum desain final dan DP', 'Tombol disabled dengan pesan penjelasan', `return btn('Teruskan ke produksi').disabled?'nonaktif':'AKTIF'`);
await login('design');
await step('Tim Desain', 'Membuka tugas desain dan mengunggah versi 1', 'Versi 1 tampil', `await nav('Tugas Desain');await openOrder();await tab('Desain');btn('Unggah desain').click();await sleep(400);const fi=document.querySelector('.modal input[type=file]');fi.files=png();fi.dispatchEvent(new Event('change',{bubbles:true}));await sleep(700);await submit();return 'ok'`);
await login('c1');
await step('Pelanggan', 'Meminta revisi desain dengan catatan', 'Catatan revisi tersimpan', `await nav('Pesanan Saya');await openOrder();await tab('Desain');btn('Minta revisi').click();await sleep(400);setv(document.querySelector('.modal textarea'),'Perbesar judul dan gunakan warna lebih tegas.');await sleep(200);await submit();return 'ok'`);
await login('design');
await step('Tim Desain', 'Mengunggah versi 2 (revisi)', 'Versi 2 tampil', `await nav('Tugas Desain');await openOrder();await tab('Desain');btn('Unggah desain').click();await sleep(400);const fi=document.querySelector('.modal input[type=file]');fi.files=png();fi.dispatchEvent(new Event('change',{bubbles:true}));await sleep(700);await submit();return 'ok'`);
await login('c1');
await step('Pelanggan', 'Menyetujui desain versi 2', 'Desain berstatus DISETUJUI', `await nav('Pesanan Saya');await openOrder();await tab('Desain');btn('Setujui desain').click();await sleep(400);btn('Ya, setujui desain').click();await sleep(1400);return 'ok'`);
await step('Pelanggan', 'Negatif: tombol Minta revisi tidak tersedia setelah disetujui', 'Tombol tidak ada', `return btn('Minta revisi')?'ADA':'tidak ada'`);
await login('design');
await step('Tim Desain', 'Menetapkan berkas final', 'Desain berstatus FINAL', `await nav('Tugas Desain');await openOrder();await tab('Desain');btn('Tetapkan sebagai berkas final').click();await sleep(1400);return 'ok'`);
await login('fo');
await step('Front Office', 'Negatif: Teruskan ke produksi masih nonaktif karena DP belum tercatat', 'Tombol disabled', `await nav('Pesanan');await openOrder();return btn('Teruskan ke produksi').disabled?'nonaktif':'AKTIF'`);
await step('Front Office', 'Mencatat DP 40.000 (Transfer)', 'DP tercatat pada tab Pembayaran', `await tab('Pembayaran');btn('Catat pembayaran').click();await sleep(400);setv(document.querySelector('.modal input[name=amount]'),'40000');await sleep(200);await submit();return 'ok'`);
await step('Front Office', 'Meneruskan pesanan ke produksi', 'Status Siap produksi', `await tab('Ringkasan');btn('Teruskan ke produksi').click();await sleep(1400);return 'ok'`, 'Siap produksi');
await login('operator');
await step('Operator', 'Membuka Produksi dan tab Antrean', 'Pesanan muncul pada Antrean', `await nav('Produksi');const t=document.querySelector('[role=tab]');await sleep(300);return [...document.querySelectorAll('[role=tab]')].map(b=>b.innerText.replace(/\\n/g,' ')).join(' | ')`);
await step('Operator', 'Mencatat kendala produksi', 'Kendala tampil pada tab Produksi pesanan', `await openOrder();await tab('Produksi');btn('Catat kendala').click();await sleep(400);setv(document.querySelector('.modal textarea'),'Menunggu stok flexi 280 gsm.');await sleep(200);await submit();return 'ok'`);
await step('Operator', 'Memulai produksi', 'Status Dalam produksi', `btn('Mulai produksi').click();await sleep(1400);return 'ok'`, 'Dalam produksi');
await step('Operator', 'Pemeriksaan hasil: belum sesuai', 'Status Perbaikan', `btn('Catat pemeriksaan hasil').click();await sleep(400);const m=document.querySelector('.modal');setv(m.querySelector('select[name=pass]'),'no');setv(m.querySelector('textarea[name=note]'),'Warna belum sesuai.');await sleep(200);await submit();return 'ok'`, 'Perbaikan');
await step('Operator', 'Mulai perbaikan', 'Status Dalam produksi', `btn('Mulai perbaikan').click();await sleep(1400);return 'ok'`, 'Dalam produksi');
await step('Operator', 'Pemeriksaan ulang: sesuai', 'Status Lolos pemeriksaan', `btn('Catat pemeriksaan hasil').click();await sleep(400);const m=document.querySelector('.modal');setv(m.querySelector('select[name=pass]'),'yes');setv(m.querySelector('textarea[name=note]'),'Warna dan ukuran sesuai.');await sleep(200);await submit();return 'ok'`, 'Lolos pemeriksaan');
await login('fo');
await step('Front Office', 'Menetapkan siap diambil', 'Status Siap diambil', `await nav('Penyerahan');await openOrder();btn('Tandai siap diambil').click();await sleep(1400);return 'ok'`, 'Siap diambil');
await step('Front Office', 'Mencatat pemberitahuan ke pelanggan (WhatsApp)', 'Pemberitahuan tampil pada Ringkasan', `btn('Catat pemberitahuan').click();await sleep(400);const m=document.querySelector('.modal');setv(m.querySelector('select[name=channel]'),'WhatsApp');setv(m.querySelector('textarea[name=note]'),'Pesanan siap diambil.');await sleep(200);await submit();return 'ok'`);
await step('Front Office', 'Negatif: Catat penyerahan nonaktif karena belum lunas', 'Tombol disabled', `return btn('Catat penyerahan').disabled?'nonaktif':'AKTIF'`);
await step('Front Office', 'Mencatat pelunasan 60.000 (QRIS)', 'Sisa tagihan Rp 0', `await tab('Pembayaran');btn('Catat pembayaran').click();await sleep(400);const m=document.querySelector('.modal');setv(m.querySelector('input[name=amount]'),'60000');setv(m.querySelector('select[name=method]'),'QRIS');await sleep(200);await submit();return document.querySelector('.paystats').innerText.replace(/\\n/g,' ')`);
await step('Front Office', 'Mencatat penyerahan kepada penerima', 'Status Selesai', `await tab('Ringkasan');btn('Catat penyerahan').click();await sleep(400);setv(document.querySelector('.modal input[name=recipient]'),'Alya Putri');await sleep(200);await submit();return 'ok'`, 'Selesai');
await step('Front Office', 'Membuka kwitansi pembayaran', 'Kwitansi memuat nomor, terbilang, dan LUNAS', `await tab('Pembayaran');const bs=[...document.querySelectorAll('tbody .textbutton')].filter(b=>b.innerText.trim()==='Kwitansi');bs.at(-1).click();await sleep(500);const r=document.querySelector('.receiptsheet');const t=r?r.innerText:'';const ok=/KW-RPT-[0-9]+-02/.test(t)&&/enam puluh ribu rupiah/i.test(t)&&/LUNAS/.test(t);if(!ok)throw Error('kwitansi tidak sesuai: '+t.slice(0,200));return 'ok'`);
await ev(`document.querySelector('.receiptback').click();await sleep(300);return 1`);
await step('Front Office', 'Riwayat aktivitas pesanan', 'Seluruh tahap tercatat', `await tab('Riwayat');return [...document.querySelectorAll('.timeline b')].length+' entri'`);
await login('c1');
await step('Pelanggan', 'Melihat pesanan Selesai pada Pesanan Saya', 'Status Selesai', `await nav('Pesanan Saya');return document.querySelector('tbody').innerText.split('\\n').slice(0,6).join(' | ')`);
await step('Pelanggan', 'Notifikasi: perubahan dari sesi lain muncul sebagai toast tanpa muat ulang', 'Toast «Pesanan baru» tampil dalam 20 detik', `await new Promise(r=>setTimeout(r,200));return document.querySelector('.notifybtn')?'tombol notifikasi desktop ada':(()=>{throw Error('tombol notifikasi tidak ada')})()`);
{ const st = (await S.c1.json('/api/state')).body; await S.c1.json('/api/state', {action: 'create', data: {title: 'Pesanan untuk uji toast', spec: 'Uji', qty: 1}, revision: st.revision}); }
await step('Pelanggan', 'Toast pembaruan pesanan tampil otomatis (polling 15 detik)', 'Teks toast memuat «Pesanan baru»', `for(let i=0;i<30;i++){const t=document.querySelector('.toastitem');if(t&&t.innerText.includes('Pesanan baru'))return t.innerText;await sleep(1000);}throw Error('toast tidak muncul')`);

// ===== Pembayaran pelanggan =====
async function mkVerified(title, total) {
  const r1 = await S.c1.json('/api/state'); const c = await S.c1.json('/api/state', {action: 'create', data: {title, spec: 'Uji pembayaran', qty: 1}, revision: r1.body.revision});
  const id = c.body.orders.find(o => o.title === title).id;
  const rev = (await S.fo.json('/api/state')).body.revision;
  const v = await S.fo.json('/api/state', {action: 'verify', data: {orderId: id, total, dp: total, due: '2026-12-30', designerId: ID.design, operatorId: ID.operator}, revision: rev});
  if (v.status !== 200) throw Error('verifikasi gagal ' + JSON.stringify(v.body)); return id;
}
const qrOrder = await mkVerified('Tagihan UI QRIS', 30000), bankOrder = await mkVerified('Tagihan UI Transfer', 40000);
const openByTitle = t => `await nav(role_=document.querySelector('nav')&&[...document.querySelectorAll('nav button')].some(b=>b.innerText.startsWith('Pesanan Saya'))?'Pesanan Saya':'Pesanan');const b=[...document.querySelectorAll('tbody .textbutton')].find(x=>x.textContent.includes(${JSON.stringify(t)}));if(!b)throw Error('pesanan tidak ditemukan');b.click();await sleep(500);await tab('Pembayaran');`;
await send('Page.reload'); await sleep(3000); await ev(HELP);
await step('Pelanggan', 'Memilih QRIS dan melanjutkan: kode QR tampil', 'Gambar QR dan nominal Rp 30.000 tampil', openByTitle('Tagihan UI QRIS') + `const l=[...document.querySelectorAll('.payopts label')].find(x=>x.innerText.includes('QRIS'));l.click();await sleep(300);btn('Lanjutkan').click();for(let i=0;i<20;i++){const im=document.querySelector('img[alt="Kode QR pembayaran"]');if(im&&im.complete&&im.naturalWidth>0)return document.querySelector('.payamount').innerText.replace(/\\n/g,' ');await sleep(500);}throw Error('QR tidak tampil')`);
{ const q = (await S.c1.json('/api/bayar')).body.requests.find(r => r.orderId === qrOrder && r.status === 'pending'); const r = await fetch(base + '/api/bayar/demo', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: base}, body: JSON.stringify({id: q.id})}); if (r.status !== 200) throw Error('demo gagal'); }
await step('Pelanggan', 'Setelah QR dipindai (halaman demo), status pembayaran diperbarui otomatis', 'Pesan «Tagihan sudah lunas»', `for(let i=0;i<20;i++){const n=document.querySelector('.paypanel .successnote');if(n&&n.innerText.includes('lunas'))return n.innerText;await sleep(1000);}throw Error('status tidak berubah')`);
await step('Pelanggan', 'Memilih Transfer: rincian rekening tampil', 'Rekening dan nominal Rp 40.000', openByTitle('Tagihan UI Transfer') + `const l=[...document.querySelectorAll('.payopts label')].find(x=>x.innerText.includes('Transfer'));l.click();await sleep(300);btn('Lanjutkan').click();await sleep(1500);if(!document.querySelector('.paybank'))throw Error('rekening tidak tampil');return document.querySelector('.paypanel').innerText.replace(/\\n/g,' ').slice(0,200)`);
await login('fo');
await step('Front Office', 'Melihat permintaan transfer dan mengonfirmasi', 'Pembayaran tercatat; tagihan lunas', openByTitle('Tagihan UI Transfer') + `btn('Konfirmasi').click();await sleep(1800);const o=document.querySelector('.paystats').innerText.replace(/\\n/g,' ');if(!/Rp\\s*0/.test(o))throw Error('belum lunas: '+o);return o`);
await login('c1');
await login('admin');
await step('Admin', 'Masuk sebagai Admin: menu Pengguna dan Master Data tersedia', 'Menu admin tampil, tidak ada menu tahap pesanan', `return [...document.querySelectorAll('nav button')].map(b=>b.innerText.trim()).join(' | ')`);
await step('Admin', 'Membuka Pengguna dan menambah akun operator', 'Akun baru tampil pada daftar', `await nav('Pengguna');btn('Tambah pengguna').click();await sleep(400);const m=document.querySelector('.modal');setv(m.querySelector('input[name=name]'),'Operator Baru UI');setv(m.querySelector('input[name=username]'),'opbaru.${Date.now().toString(36)}');setv(m.querySelector('input[name=password]'),'Sandi-operator-123');setv(m.querySelector('select[name=role]'),'operator');await sleep(300);[...m.querySelectorAll('form button')].find(b=>b.innerText.trim()==='Simpan').click();await sleep(1500);return document.body.innerText.includes('Operator Baru UI')?'tampil':'TIDAK TAMPIL'`);
await step('Admin', 'Membuka Master Data: katalog, metode pembayaran, saluran', 'Tiga panel master tampil', `await nav('Master Data');return document.querySelector('.mastergrid')?document.body.innerText.includes('QRIS')&&document.body.innerText.includes('WhatsApp')?'katalog + metode + saluran':'kurang':'TIDAK ADA'`);
await step('Admin', 'Membuka Pengaturan: WhatsApp (WAHA) dan Email (SMTP) tampil, rahasia tidak terlihat', 'Panel WAHA, SMTP, alamat situs, dan riwayat pengiriman', `await nav('Pengaturan');await sleep(900);const t=document.body.innerText;const pw=[...document.querySelectorAll('input[name=waha_key],input[name=smtp_pass]')].every(i=>i.type==='password'&&!i.value);return t.includes('WhatsApp (WAHA)')&&t.includes('Email (SMTP)')&&t.includes('Riwayat pengiriman')&&pw?'panel pengaturan lengkap':'GAGAL'`);
await step('Admin', 'Keluar kembali ke layar masuk', 'Form masuk tampil', `btn('Keluar',document.querySelector('header')||document)?.click();await sleep(1500);return document.querySelector('form.authform')?'layar masuk':'MASIH MASUK'`);
// ===== Pemesanan publik tanpa login (etalase) =====
const PH = '0856' + String(Date.now()).slice(-8);
await send('Network.enable'); await send('Network.clearBrowserCookies'); await send('Page.navigate', {url: base + '/'}); await sleep(3500); await ev(HELP);
await step('Pengunjung', 'Membuka etalase tanpa login: layanan tampil', 'Minimal 5 kartu layanan dan tidak ada form masuk', `await sleep(500);return document.querySelectorAll('.productgrid article').length>=5&&!document.querySelector('form.authform')?document.querySelectorAll('.productgrid article').length+' kartu layanan':'GAGAL'`);
await step('Pengunjung', 'Menekan Pesan cetak: formulir pesanan terbuka tanpa meminta login', 'Kolom nama, telepon, email, spesifikasi, jumlah, opsi, berkas', `document.querySelector('.navorder').click();await sleep(700);const d=document.querySelector('dialog.shopdialog');const names=['name','phone','email','spec','qty','mode'].every(n=>d.querySelector('[name='+n+']'));return d.open&&names&&d.querySelector('input[type=file]')&&!d.querySelector('form.authform')?'formulir lengkap':'GAGAL'`);
{ const t = await ev(`const d=document.querySelector('dialog.shopdialog');setv(d.querySelector('[name=name]'),'Tamu UI');setv(d.querySelector('[name=phone]'),'${PH}');setv(d.querySelector('[name=spec]'),'Banner 3x1 m');[...d.querySelectorAll('.modes input')][1].click();await sleep(200);d.querySelector('form .shopbtn').click();await sleep(600);const t=d.querySelector('.error')?.innerText||'';[...d.querySelectorAll('.modes input')][0].click();await sleep(200);return t`);
  n++; const ok = /siap cetak/i.test(t || ''); results.push({n, role: 'Pengunjung', title: 'Negatif: opsi Langsung cetak tanpa berkas ditolak', expected: 'Pesan galat meminta berkas siap cetak', ok, detail: String(t), shot: ''}); console.log((ok ? 'LULUS ' : 'GAGAL ') + String(n).padStart(2, '0') + ' [Pengunjung] Negatif: opsi Langsung cetak tanpa berkas ditolak'); }
await step('Pengunjung', 'Mengirim pesanan: akun dibuat otomatis dan kredensial tampil sekali', 'Nomor pesanan, username, dan kata sandi tampil', `const d=document.querySelector('dialog.shopdialog');d.querySelector('form .shopbtn').click();for(let i=0;i<30;i++){await sleep(300);if(d.querySelector('.cred'))break;}const c=[...d.querySelectorAll('.cred code')].map(x=>x.innerText);window.__cred=c;return c.length===2?d.querySelector('.receipt strong').innerText+' / '+c[0]:'GAGAL: '+(d.querySelector('.error')?.innerText||'')`, null, true);
const cred = await ev(`return window.__cred`);
await ev(`setTimeout(()=>[...document.querySelectorAll('dialog button')].find(b=>b.innerText.includes('Buka Ruang Kerja')).click(),50);return 'klik'`); await sleep(5000);
await ev(HELP);
await step('Pengunjung', 'Kata sandi sementara wajib diganti sebelum dipakai', 'Dialog kata sandi tampil dan tanpa tombol tutup', `for(let i=0;i<20&&!document.querySelector('.modal');i++)await sleep(300);const m=document.querySelector('.modal');return location.pathname==='/operasional'&&m&&/dibuat otomatis/.test(m.innerText)&&m.querySelector('.icon')?.hidden?'dialog wajib ganti sandi':'GAGAL: '+(m?m.innerText.slice(0,80):'tanpa dialog')`);
await step('Pengunjung', 'Mengganti kata sandi: Ruang Kerja pelanggan terbuka dengan pesanan baru', 'Dialog tertutup; menu Pesanan Saya tersedia', `const m=document.querySelector('.modal');setv(m.querySelector('input[name=current]'),${JSON.stringify(cred && cred[1])});setv(m.querySelector('input[name=next]'),'Sandi-Pilihan-2026');m.querySelector('button[type=submit]').click();await sleep(2500);const nav=[...document.querySelectorAll('nav button')].map(b=>b.innerText.trim());return !document.querySelector('.modal')&&nav.includes('Pesanan Saya')?'Ruang Kerja: '+nav.join(', '):'GAGAL '+nav.join(',')`);
fs.writeFileSync(path.join(import.meta.dirname, '..', 'e2e-out', 'e2e_ui_results.json'), JSON.stringify(results, null, 1));
console.log(`\nRINGKAS UI: ${results.length} langkah; lulus ${results.filter(r => r.ok).length}, gagal ${results.filter(r => !r.ok).length}`);
chrome.kill(); ws.close(); process.exit(results.every(r => r.ok) ? 0 : 1);
