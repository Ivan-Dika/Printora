import {randomBytes, randomUUID} from 'node:crypto';
import {applyTransition, clientIp, fail, isSecure, json, sameOrigin, write} from '../../../lib/api';
import {sessionCookie, startSession, throttle} from '../../../lib/auth.mjs';
import {activeCatalog} from '../../../lib/master.mjs';
import {hashPassword} from '../../../lib/password.mjs';
import {getSettings} from '../../../lib/settings.mjs';
import {notifyContact, orderCreatedNotice} from '../../../lib/messaging.mjs';
import {normalizeEmail, normalizePhone, randomPassword, usernameBase} from '../../../lib/identity';
import type {State, User} from '../../../lib/domain';

export const dynamic = 'force-dynamic';
const bad = (message: string, status = 400) => Object.assign(new Error(message), {status});

/**
 * Pemesanan publik tanpa login. Satu permintaan: membuat akun Pelanggan (username dan kata sandi acak, wajib diganti saat masuk pertama),
 * menyimpan pesanan, dan membuka sesi. Telepon/email yang sudah terdaftar ditolak (pelanggan diminta masuk) agar tidak ada yang
 * dapat menumpang ke akun orang lain hanya dengan mengetik nomornya. Kata sandi hanya dikembalikan sekali di respons ini.
 */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const raw = await req.text();
    if (raw.length > 8000) return json({error: 'Isian terlalu panjang.'}, 413);
    let b: Record<string, unknown>;
    try { b = JSON.parse(raw); } catch { throw bad('Permintaan tidak valid.'); }
    if (b.website) throw bad('Permintaan tidak valid.'); // jebakan bot: kolom tersembunyi harus kosong
    const name = String(b.name ?? '').trim();
    if (name.length < 2 || name.length > 100) throw bad('Nama wajib diisi (2-100 karakter).');
    const phone = String(b.phone ?? '').trim() ? normalizePhone(b.phone) : '';
    const email = String(b.email ?? '').trim() ? normalizeEmail(b.email) : '';
    if (phone === null) throw bad('Nomor telepon tidak valid. Contoh: 081234567890.');
    if (email === null) throw bad('Alamat email tidak valid.');
    if (!phone && !email) throw bad('Isi nomor telepon atau email (salah satu atau keduanya).');
    const mode = b.mode === 'cetak' ? 'cetak' : b.mode === 'desain' ? 'desain' : '';
    if (!mode) throw bad('Pilih opsi: langsung cetak atau desain dulu oleh Tim Desain.');
    if (typeof b.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(b.requestId)) throw bad('Silakan buka kembali formulir pesanan.');
    const product = String(b.product ?? '');
    if (!(await activeCatalog()).some((p) => p.name === product)) throw bad('Pilih tipe pesanan dari daftar layanan.');

    // Pembatas laju: per IP, per identitas, dan keseluruhan, agar formulir publik tidak dipakai membanjiri pesan.
    throttle('pesan|ip|' + clientIp(req), 6, 3600_000);
    throttle('pesan|id|' + (phone || email), 3, 3600_000);
    throttle('pesan|semua', 300, 3600_000);

    const {extra} = await write({
      expectedRevision: null, uploader: 'publik',
      fn: async (prev: State, conn) => {
        const taken = prev.users.some((u) => (phone && u.phone && normalizePhone(u.phone) === phone) || (email && u.email === email));
        if (taken) throw bad('Nomor telepon atau email ini sudah terdaftar. Silakan masuk dengan akun Anda, atau hubungi percetakan bila lupa kata sandi.', 409);
        const id = randomUUID(), password = randomPassword(randomBytes(10));
        let username = '';
        for (let i = 0; i < 20 && !username; i++) {
          const cand = usernameBase(name) + String(1000 + (randomBytes(2).readUInt16BE() % 9000));
          const [rows] = await conn.query('SELECT COUNT(*) n FROM users WHERE username = ?', [cand]);
          if (!(rows as {n: number}[])[0].n) username = cand;
        }
        if (!username) throw bad('Akun belum dapat dibuat. Coba lagi.', 503);
        await conn.query('INSERT INTO users (id, username, password_hash, name, phone, email, must_change, role) VALUES (?,?,?,?,?,?,1,?)',
          [id, username, await hashPassword(password), name, phone || '', email || null, 'customer']);
        const user: User = {id, name, phone: phone || '', role: 'customer', username, ...(email ? {email} : {}), mustChange: true, active: true};
        const withUser: State = {...prev, users: [...prev.users, user]};
        const next = await applyTransition(withUser, id, 'create', {title: product, spec: b.spec, qty: b.qty, mode});
        next.orders[0].requestId = b.requestId as string;
        return {next, extra: {userId: id, username, password, orderId: next.orders[0].id}};
      },
    });
    const r = extra as {userId: string; username: string; password: string; orderId: string};
    const token = await startSession(r.userId);
    // Info pesanan dan akses masuk dikirim lewat saluran yang diaktifkan Admin (WhatsApp/email); kegagalan tidak membatalkan pesanan.
    const cfg = await getSettings();
    // Tautan dalam pesan hanya dari alamat yang dikonfigurasi (Admin/PUBLIC_URL), tidak pernah dari header permintaan (anti link-poisoning).
    const base = cfg.public_url || process.env.PUBLIC_URL || '';
    const notice = orderCreatedNotice({name, orderId: r.orderId, product, qty: b.qty, mode, username: r.username, password: r.password, base});
    const channels = await notifyContact({phone: phone || '', email: email || ''}, {kind: 'pesanan-baru', subject: 'Pesanan ' + r.orderId + ' diterima - Printora', notice});
    return json({orderId: r.orderId, username: r.username, password: r.password, sentTo: channels}, 201, {'Set-Cookie': sessionCookie(token, isSecure(req))});
  } catch (e) { return fail(e); }
}
