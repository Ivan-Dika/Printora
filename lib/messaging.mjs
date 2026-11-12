// Pengiriman pesan ke pelanggan: WhatsApp lewat WAHA (HTTP API) dan email lewat SMTP (nodemailer).
// Pengiriman tidak pernah menggagalkan proses pesanan: galat dicatat di message_log (tanpa isi pesan atau kata sandi).
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { ensureReady, pool, uploadDir } from './mysql.mjs';
import { getSettings } from './settings.mjs';
import { renderHtml, renderPlain, renderWhatsApp } from './mailtpl.mjs';

const TIMEOUT_MS = 10_000;
/** Total ukuran lampiran email; berkas yang melebihi batas ini tidak dilampirkan, hanya ditautkan lewat Ruang Kerja. */
export const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

/** Nomor lokal 08… ke chatId WhatsApp 62…@c.us. */
export function waChatId(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return /^62\d{8,13}$/.test(d) ? d + '@c.us' : null;
}
/** Logo kecil untuk kop email (disematkan inline agar tampil tanpa bergantung pada alamat situs). */
const logoPath = () => { const f = path.join(process.cwd(), 'public', 'brand', 'apple-touch-icon.png'); return fs.existsSync(f) ? f : ''; };
const maskPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length > 4 ? '…' + d.slice(-4) : '…'; };
const maskMail = (m) => { const [u, h] = String(m || '').split('@'); return h ? (u.slice(0, 1) + '…@' + h) : '…'; };

export async function sendWhatsApp(cfg, phone, text) {
  const chatId = waChatId(phone);
  if (!chatId) throw new Error('Nomor WhatsApp tidak valid.');
  const res = await fetch(cfg.waha_url.replace(/\/+$/, '') + '/api/sendText', {
    method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', ...(cfg.waha_key ? { 'X-Api-Key': cfg.waha_key } : {}) },
    body: JSON.stringify({ session: cfg.waha_session || 'default', chatId, text }),
  });
  if (!res.ok) throw new Error('WAHA menjawab HTTP ' + res.status + (res.status === 401 ? ' (API key salah)' : [404, 422].includes(res.status) ? ' (sesi WhatsApp belum aktif: mulai sesi dan pindai QR di dasbor WAHA, lalu cek nama sesi)' : ''));
  // WAHA menjawab sukses begitu pesan diterima antreannya, padahal pengiriman ke WhatsApp bisa gagal sesudahnya (ack -1).
  // Periksa status pesan beberapa kali; hanya galat pasti (ack -1) yang dianggap gagal, sisanya (menunggu/terkirim) dianggap berhasil.
  let id = '';
  try { const j = await res.json(); id = typeof j?.id === 'string' ? j.id : j?.id?._serialized || (j?.key?.id ? `true_${chatId}_${j.key.id}` : ''); } catch { /* tanpa id: lewati pemeriksaan */ }
  if (!id) return;
  const base = cfg.waha_url.replace(/\/+$/, '') + `/api/${encodeURIComponent(cfg.waha_session || 'default')}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(id)}?downloadMedia=false`;
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(5000), headers: cfg.waha_key ? { 'X-Api-Key': cfg.waha_key } : {} });
      if (!r.ok) return;
      const m = await r.json();
      if (m?.ack === -1) throw new Error('WhatsApp menolak mengirim pesan (ack ERROR). Umumnya penerima belum pernah berkirim pesan ke nomor Printora (galat 463) atau nomor pengirim masih baru; minta penerima mengirim pesan lebih dulu.');
      if (typeof m?.ack === 'number' && m.ack >= 1) return;
    } catch (e) { if (/ack ERROR/.test(String(e?.message))) throw e; return; }
  }
}

export async function sendEmail(cfg, to, subject, text, html, attachments = []) {
  const port = Number(cfg.smtp_port) || 587;
  const t = nodemailer.createTransport({
    host: cfg.smtp_host, port, secure: cfg.smtp_secure === '1' || port === 465,
    auth: cfg.smtp_user ? { user: cfg.smtp_user, pass: cfg.smtp_pass } : undefined,
    connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
  });
  const send = () => t.sendMail({ from: cfg.mail_from, to, subject, text, ...(html ? { html } : {}), ...(attachments.length ? { attachments } : {}) });
  // Satu kali ulang untuk galat jaringan sesaat (koneksi SMTP kadang terputus saat banyak email berurutan).
  try { try { await send(); } catch (e) { if (!['ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'ECONNECTION'].includes(e.code)) throw e; await new Promise((r) => setTimeout(r, 1500)); await send(); } } finally { t.close(); }
}

/**
 * Menyiapkan lampiran email dari rujukan berkas aplikasi ("/api/files/<uuid>"). Berkas dilampirkan selama total ukurannya
 * tidak melebihi MAX_ATTACH_BYTES; sisanya hanya disebut dan dapat dibuka di Ruang Kerja. Mengembalikan daftar berkas
 * berketerangan untuk templat dan lampiran untuk nodemailer.
 */
export async function prepareFiles(files = []) {
  const shown = [], attachments = [];
  let total = 0;
  for (const f of files) {
    const id = String(f.file || '').split('/').pop();
    let row = null;
    if (/^[0-9a-f-]{36}$/.test(id)) { try { [[row]] = await pool().query('SELECT path, mime, size FROM files WHERE id = ?', [id]); } catch { row = null; } }
    const abs = row ? path.join(uploadDir(), path.basename(row.path || id)) : '';
    if (row && Number(row.size) + total <= MAX_ATTACH_BYTES && fs.existsSync(abs)) {
      total += Number(row.size); attachments.push({ filename: f.name, path: abs, contentType: row.mime });
      shown.push({ name: f.name, note: 'terlampir' });
    } else shown.push({ name: f.name, note: 'terlalu besar untuk dilampirkan, buka di Ruang Kerja' });
  }
  return { shown, attachments };
}

async function log(channel, kind, to, ok, error = '') {
  if (!ok) console.error(`[pesan] gagal ${channel}/${kind}: ${String(error).slice(0, 200)}`); // jejak di log kontainer; rincian di message_log
  try { await pool().query('INSERT INTO message_log (channel, kind, recipient, ok, error) VALUES (?,?,?,?,?)', [channel, kind, to, ok ? 1 : 0, String(error).slice(0, 300)]); } catch { /* pencatatan tidak boleh mengganggu */ }
}

/**
 * Mengirim pesan ke satu kontak lewat saluran yang aktif. `msg` memuat `notice` (data templat; dirender menjadi WhatsApp, email HTML,
 * dan email teks) atau cukup `text` untuk pesan polos. Mengembalikan saluran yang dituju; hasil pengiriman dicatat di message_log.
 */
export async function notifyContact({ phone, email }, msg, { wait = false } = {}) {
  await ensureReady();
  const cfg = await getSettings();
  const targets = [];
  const useWa = cfg.waha_enabled === '1' && cfg.waha_url && waChatId(phone);
  const useMail = cfg.smtp_enabled === '1' && cfg.smtp_host && email;
  let wa = msg.text, plain = msg.text, html = '', attachments = [];
  if (msg.notice) {
    const notice = { ...msg.notice };
    if (useMail && notice.files?.length) { const f = await prepareFiles(notice.files); notice.files = f.shown; attachments = f.attachments; }
    else if (notice.files?.length) notice.files = notice.files.map((x) => ({ name: x.name }));
    wa = renderWhatsApp(notice); plain = renderPlain(notice); html = renderHtml(notice, logoPath() ? { logoSrc: 'cid:printora-logo' } : {});
  }
  if (useWa) targets.push(['whatsapp', maskPhone(phone), () => sendWhatsApp(cfg, phone, wa)]);
  if (useMail) targets.push(['email', maskMail(email), () => sendEmail(cfg, email, msg.subject, plain, html, html && logoPath() ? [...attachments, { filename: 'printora.png', path: logoPath(), cid: 'printora-logo', contentDisposition: 'inline' }] : attachments)]);
  const run = Promise.all(targets.map(async ([channel, to, send]) => {
    try { await send(); await log(channel, msg.kind, to, true); } catch (e) { await log(channel, msg.kind, to, false, e.name === 'TimeoutError' ? 'Waktu habis: server tidak menjawab (pesan mungkin tetap terkirim)' : (e.cause?.code || e.code || e.message)); }
  }));
  if (wait) await run; else run.catch(() => {});
  return targets.map((t) => t[0]);
}

/** Uji kirim dari pengaturan Admin: galat dikembalikan apa adanya agar Admin dapat memperbaiki pengaturan. */
export async function testChannel(channel, to) {
  await ensureReady();
  const cfg = await getSettings();
  const text = 'Pesan uji dari Printora. Jika Anda menerima pesan ini, pengaturan pengiriman sudah benar.';
  try {
    if (channel === 'whatsapp') {
      if (!cfg.waha_url) throw new Error('Isi dan simpan alamat WAHA lebih dulu.');
      await sendWhatsApp(cfg, to, text);
    } else if (channel === 'email') {
      if (!cfg.smtp_host) throw new Error('Isi dan simpan host SMTP lebih dulu.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) throw new Error('Alamat email tujuan tidak valid.');
      await sendEmail(cfg, to, 'Uji pengiriman Printora', text);
    } else throw new Error('Saluran tidak dikenal.');
  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'Waktu habis: server tidak menjawab.' : (e.cause?.code ? e.message + ' (' + e.cause.code + ')' : e.message);
    await log(channel, 'uji', channel === 'whatsapp' ? maskPhone(to) : maskMail(to), false, msg);
    throw Object.assign(new Error('Uji kirim gagal: ' + msg), { status: 502 });
  }
  await log(channel, 'uji', channel === 'whatsapp' ? maskPhone(to) : maskMail(to), true);
}

export async function recentMessages(limit = 15) {
  await ensureReady();
  const [rows] = await pool().query('SELECT id, created_at, channel, kind, recipient, ok, error FROM message_log ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map((r) => ({ id: r.id, at: r.created_at, channel: r.channel, kind: r.kind, to: r.recipient, ok: !!r.ok, error: r.error }));
}

const rp = (n) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);
const paidOf = (o) => (o.payments || []).reduce((s, p) => s + p.amount, 0);
const modeLabel = (m) => (m === 'cetak' ? 'Langsung cetak' : 'Desain dulu oleh Tim Desain');
const ctaFor = (base) => ({ label: 'Buka Ruang Kerja', url: base ? `${base}/operasional` : '' });

/** Data pesan untuk pelanggan baru: info pesanan beserta akses masuk. Dirender oleh notifyContact. */
export function orderCreatedNotice({ name, orderId, product, qty, mode, username, password, base }) {
  return {
    heading: 'Pesanan Anda kami terima', name, intro: 'terima kasih, pesanan Anda di Printora sudah masuk dan menunggu verifikasi.',
    order: { id: orderId, title: product },
    details: [['Jumlah', `${qty} pcs`], ['Pengerjaan', modeLabel(mode)]],
    credentials: { username, password }, cta: ctaFor(base),
  };
}
/** Teks WhatsApp dari orderCreatedNotice (dipertahankan untuk pemanggil lama dan pengujian). */
export const orderCreatedText = (o) => renderWhatsApp(orderCreatedNotice(o));

const fileOf = (x) => ({ file: x.file, name: x.name });
const activeStaff = (users, role) => users.filter((u) => u.role === role && u.active !== false);

/**
 * Pemberitahuan dari satu perubahan: membandingkan keadaan sebelum dan sesudah. Fungsi murni (tanpa pengiriman), sehingga dapat diuji.
 * Penerima mengikuti peran, sama dengan lonceng di aplikasi:
 *   pelanggan : verifikasi, desain siap (berkas terlampir), pembayaran, produksi, siap diambil, selesai
 *   FO        : pesanan baru, berkas dari pelanggan (terlampir), desain disetujui/final, pembayaran dari pelanggan, lolos pemeriksaan, perbaikan
 *   desainer  : penugasan, revisi diminta, desain disetujui
 *   operator  : pesanan masuk antrean (berkas produksi terlampir)
 * Aksi pelaku sendiri tidak dinotifikasi kembali kepadanya. Hasil diurutkan: petugas lebih dulu, pelanggan terakhir.
 */
export function statusNotices(prev, next, base = '') {
  const staffOut = [], custOut = [];
  const cta = ctaFor(base);
  const push = (list, user, kind, notice, subject) => {
    if (!user) return;
    const full = { name: user.name, cta, ...notice };
    list.push({ contact: { phone: user.phone || '', email: user.email || '' }, kind, subject: subject || `${full.heading}: ${full.order?.id || ''} - Printora`, notice: full, text: renderWhatsApp(full) });
  };
  for (const n of next.orders) {
    const p = prev.orders.find((x) => x.id === n.id);
    const order = { id: n.id, title: n.title };
    const c = next.users.find((u) => u.id === n.customerId);
    if (!p) {
      for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'pesanan-masuk', {
        heading: 'Pesanan baru masuk', order, intro: 'ada pesanan baru yang menunggu verifikasi.',
        details: [['Pelanggan', c?.name || '-'], ['Jumlah', `${n.qty} pcs`], ['Pengerjaan', modeLabel(n.mode)], ['Spesifikasi', String(n.spec || '').slice(0, 160)]],
      });
      continue;
    }
    const designer = next.users.find((u) => u.id === n.designerId);
    const operator = next.users.find((u) => u.id === n.operatorId);
    const sisa = Math.max(0, n.total - paidOf(n));
    const lastDesign = (n.designs || []).at(-1), prevLast = (p.designs || []).at(-1);

    // ---- pelanggan ----
    const lines = [], details = []; let kind = '', files = [];
    const add = (k, text) => { kind = kind || k; lines.push(text); };
    if (!p.verified && n.verified) { add('verifikasi', `Pesanan sudah diverifikasi. Total ${rp(n.total)}, DP ${rp(n.dp)}, tenggat ${n.due}.`); details.push(['Total biaya', rp(n.total)], ['DP', rp(n.dp)], ['Tenggat', n.due]); }
    if ((n.designs || []).length > (p.designs || []).length) { add('desain', `Desain versi ${n.designs.length} siap Anda tinjau. Silakan setujui atau minta revisi di Ruang Kerja.`); files = [fileOf(lastDesign)]; }
    if ((n.payments || []).length > (p.payments || []).length) {
      const last = n.payments.at(-1);
      add('pembayaran', `Pembayaran ${rp(last.amount)} (${last.method}) kami terima. ${sisa > 0 ? 'Sisa tagihan ' + rp(sisa) + '.' : 'Tagihan sudah lunas.'} Kwitansi dapat dicetak dari tab Pembayaran di Ruang Kerja.`);
      details.push(['No. kwitansi', `KW-${n.id}-${String(n.payments.length).padStart(2, '0')}`], ['Dibayar', rp(last.amount)], ['Metode', last.method], ['Sisa tagihan', sisa > 0 ? rp(sisa) : 'Lunas']);
    }
    if (p.status !== n.status) {
      if (n.status === 'Siap produksi') add('produksi', 'Pesanan masuk antrean produksi.');
      else if (n.status === 'Dalam produksi' && p.status !== 'Perbaikan') add('produksi', 'Pesanan Anda mulai diproduksi.');
      else if (n.status === 'Dalam produksi') add('produksi', 'Perbaikan selesai dan pesanan kembali diproduksi.');
      else if (n.status === 'Perbaikan') add('produksi', 'Hasil pemeriksaan mutu belum lolos, pesanan sedang diperbaiki.');
      else if (n.status === 'Siap diambil') { add('siap-diambil', `Pesanan siap diambil.${paidOf(n) < n.total ? ' Mohon lunasi sisa ' + rp(sisa) + ' saat pengambilan.' : ''}`); if (sisa > 0) details.push(['Sisa tagihan', rp(sisa)]); }
      else if (n.status === 'Selesai') add('selesai', 'Pesanan sudah diserahkan. Terima kasih telah memesan di Printora.');
    }
    if (lines.length) {
      const HEAD = { verifikasi: 'Pesanan diverifikasi', desain: 'Desain siap ditinjau', pembayaran: 'Pembayaran diterima', produksi: 'Pesanan diproses', 'siap-diambil': 'Pesanan siap diambil', selesai: 'Pesanan selesai' };
      push(custOut, c, kind, { heading: HEAD[kind] || 'Pembaruan pesanan', intro: 'berikut pembaruan pesanan Anda.', order, lines, details, files }, `Pesanan ${n.id}: ${lines[0].split('.')[0]} - Printora`);
    }

    // ---- petugas ----
    if (!p.verified && n.verified && n.mode !== 'cetak') push(staffOut, designer, 'tugas-desain', { heading: 'Tugas desain baru', order, intro: 'Anda ditugaskan pada pesanan ini.', lines: ['Silakan unggah versi desain pertama di Ruang Kerja.'], details: [['Jumlah', `${n.qty} pcs`], ['Tenggat', n.due], ['Spesifikasi', String(n.spec || '').slice(0, 160)]] });
    if ((n.revisions || []).length > (p.revisions || []).length) push(staffOut, designer, 'revisi', { heading: 'Revisi desain diminta', order, intro: 'pelanggan meminta revisi desain.', lines: [`Catatan pelanggan: ${n.revisions.at(-1).text}`, 'Unggah versi revisi di Ruang Kerja.'] });
    if (lastDesign?.approved && !prevLast?.approved) {
      push(staffOut, designer, 'disetujui', { heading: 'Desain disetujui', order, intro: 'pelanggan menyetujui desain.', lines: [`Desain versi ${lastDesign.version} disetujui. Silakan tetapkan sebagai berkas final.`] });
      for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'disetujui', { heading: 'Desain disetujui pelanggan', order, intro: 'desain sudah disetujui.', lines: [n.dp - paidOf(n) > 0 ? `DP belum terpenuhi (kurang ${rp(n.dp - paidOf(n))}). Pelanggan dapat membayar lewat Ruang Kerja.` : 'DP sudah terpenuhi. Menunggu berkas final dari Tim Desain.'] });
    }
    if (lastDesign?.final && !prevLast?.final) for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'final', { heading: 'Berkas final siap', order, intro: 'berkas final sudah ditetapkan.', lines: [paidOf(n) >= n.dp ? 'DP terpenuhi. Pesanan dapat diteruskan ke produksi.' : `Menunggu DP (kurang ${rp(n.dp - paidOf(n))}).`] });
    if ((n.attachments || []).length > (p.attachments || []).length) {
      const added = n.attachments.slice((p.attachments || []).length);
      for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'berkas', { heading: 'Berkas dari pelanggan', order, intro: `pelanggan ${c?.name || ''} mengirim berkas untuk pesanan ini.`.replace('  ', ' '), lines: [n.mode === 'cetak' ? 'Pesanan Langsung cetak: periksa berkas lalu tetapkan berkas cetak final.' : 'Berkas pendukung untuk Tim Desain.'], files: added.map(fileOf) });
    }
    if ((n.payments || []).length > (p.payments || []).length) {
      const last = n.payments.at(-1), payer = next.users.find((u) => u.id === last.by);
      if (payer?.role === 'customer') for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'bayar-pelanggan', { heading: 'Pembayaran dari pelanggan', order, intro: 'pelanggan membayar lewat aplikasi.', details: [['Nominal', rp(last.amount)], ['Metode', last.method], ['Sisa tagihan', sisa > 0 ? rp(sisa) : 'Lunas']] });
    }
    if (p.status !== n.status) {
      if (n.status === 'Siap produksi') {
        const pf = n.mode === 'cetak' ? (n.attachments || []).find((a) => a.id === n.printFile) : (n.designs || []).find((d) => d.final);
        push(staffOut, operator, 'antrean', { heading: 'Pesanan masuk antrean produksi', order, intro: 'ada pesanan siap dikerjakan.', details: [['Jumlah', `${n.qty} pcs`], ['Tenggat', n.due], ['Spesifikasi', String(n.spec || '').slice(0, 160)]], files: pf ? [fileOf(pf)] : [] });
      }
      if (n.status === 'Lolos pemeriksaan') for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'lolos', { heading: 'Hasil cetak lolos pemeriksaan', order, intro: 'pesanan siap diserahkan.', lines: ['Silakan tandai pesanan siap diambil dan beri tahu pelanggan.'] });
      if (n.status === 'Perbaikan') for (const fo of activeStaff(next.users, 'fo')) push(staffOut, fo, 'perbaikan', { heading: 'Pesanan masuk perbaikan', order, intro: 'hasil cetak belum lolos pemeriksaan.', lines: [`Catatan: ${n.qc || '-'}`] });
    }
  }
  return [...staffOut, ...custOut];
}

/** Mengirim pemberitahuan setelah perubahan tersimpan. Berurutan (petugas dahulu, pelanggan terakhir). Tidak pernah melempar galat. */
export async function notifyStatusChanges(prev, next) {
  try {
    const cfg = await getSettings();
    const base = cfg.public_url || process.env.PUBLIC_URL || '';
    for (const m of statusNotices(prev, next, base)) await notifyContact(m.contact, { kind: m.kind, subject: m.subject, notice: m.notice }, { wait: true });
  } catch { /* notifikasi tidak boleh menggagalkan proses */ }
}
