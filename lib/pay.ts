import crypto from 'node:crypto';
import qrcode from 'qrcode-generator';
import {pool} from './mysql.mjs';
import {activeLists} from './master.mjs';
import {applyTransition, write} from './api';
import {paid, type Order} from './domain';
import type {SessionUser} from './auth.mjs';

// Pembayaran pelanggan: Transfer dan Tunai dikonfirmasi FO; QRIS dibayar lewat halaman yang dibuka dari kode QR.
export type PayKind = 'qr' | 'bank' | 'cash' | 'other';
export type PayRequest = {id: string; orderId: string; customerId: string; method: string; kind: PayKind; amount: number; status: 'pending' | 'paid' | 'cancelled'; created: string};
export const BANK = {bank: process.env.BANK_NAME || 'Bank Printora', number: process.env.BANK_NUMBER || '0000 1234 5678', holder: process.env.BANK_HOLDER || 'Printora Percetakan'};
export const kindOf = (method: string): PayKind => /qris/i.test(method) ? 'qr' : /transfer/i.test(method) ? 'bank' : /tunai|cash/i.test(method) ? 'cash' : 'other';
const err = (message: string, status = 400) => Object.assign(new Error(message), {status});

type Row = {id: string; order_id: string; customer_id: string; method: string; amount: number | string; status: PayRequest['status']; created_at: Date};
const toRequest = (r: Row): PayRequest => ({id: r.id, orderId: r.order_id, customerId: r.customer_id, method: r.method, kind: kindOf(r.method), amount: Number(r.amount), status: r.status, created: new Date(r.created_at).toISOString()});

/** Pelanggan: permintaan miliknya (pending dan 20 terakhir). FO: permintaan yang menunggu konfirmasi. */
/**
 * Pembayaran QRIS di sini adalah SIMULASI: siapa pun yang memegang token permintaan dapat menandainya lunas. Aman hanya untuk
 * demo/uji. Mati kecuali ENABLE_DEMO_PAY=1 diatur eksplisit (hanya untuk demo): QRIS lalu dikonfirmasi FO seperti transfer (atau sambungkan gateway dengan webhook
 * bertanda tangan).
 */
export const demoPayEnabled = () => process.env.ENABLE_DEMO_PAY === '1';

export async function listRequests(user: SessionUser): Promise<{requests: PayRequest[]; methods: string[]; bank: typeof BANK; demo: boolean}> {
  const {methods} = await activeLists();
  const db = pool();
  let rows: Row[] = [];
  if (user.role === 'customer') [rows] = (await db.query('SELECT * FROM payment_requests WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20', [user.id])) as unknown as [Row[]];
  else if (user.role === 'fo') [rows] = (await db.query("SELECT * FROM payment_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50")) as unknown as [Row[]];
  return {requests: rows.map(toRequest), methods, bank: BANK, demo: demoPayEnabled()};
}

export async function createRequest(user: SessionUser, b: {orderId?: string; method?: string; amount?: number}) {
  if (user.role !== 'customer') throw err('Hanya pelanggan yang membuat permintaan pembayaran.', 403);
  const amount = Number(b.amount), method = String(b.method || '');
  if (!Number.isInteger(amount) || amount < 1) throw err('Nominal pembayaran tidak valid.');
  if (!(await activeLists()).methods.includes(method)) throw err('Metode pembayaran tidak tersedia.');
  const out = await write({expectedRevision: null, uploader: user.id, fn: async (prev, conn) => {
    const o = prev.orders.find((x) => x.id === b.orderId && x.customerId === user.id);
    if (!o) throw err('Pesanan tidak ditemukan.', 404);
    if (!o.verified) throw err('Pesanan belum diverifikasi FO, belum ada tagihan.');
    const rest = o.total - paid(o);
    if (rest <= 0) throw err('Tagihan pesanan ini sudah lunas.');
    if (amount > rest) throw err('Nominal melebihi sisa tagihan.');
    await conn.query("UPDATE payment_requests SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'", [o.id]);
    const id = crypto.randomBytes(16).toString('hex');
    await conn.query('INSERT INTO payment_requests (id, order_id, customer_id, method, amount) VALUES (?,?,?,?,?)', [id, o.id, user.id, method, amount]);
    return {next: prev, extra: id};
  }});
  return out.extra as string;
}

export async function cancelRequest(user: SessionUser, id: string) {
  const [res] = await pool().query("UPDATE payment_requests SET status = 'cancelled' WHERE id = ? AND status = 'pending' AND (customer_id = ? OR ? = 'fo')", [id, user.id, user.role]);
  if (!(res as {affectedRows: number}).affectedRows) throw err('Permintaan tidak ditemukan atau sudah diproses.', 404);
}

/** Menerapkan pembayaran dari permintaan ke pesanan dalam satu transaksi. */
async function settle(id: string, actor: (r: Row, o: Order) => string, gateway: boolean, accept: (r: Row) => void) {
  await write({expectedRevision: null, uploader: 'system', fn: async (prev, conn) => {
    const [[r]] = (await conn.query('SELECT * FROM payment_requests WHERE id = ? FOR UPDATE', [id])) as unknown as [[Row | undefined]];
    if (!r) throw err('Permintaan pembayaran tidak ditemukan.', 404);
    if (r.status !== 'pending') throw err(r.status === 'paid' ? 'Pembayaran ini sudah diterima.' : 'Permintaan pembayaran sudah dibatalkan.', 409);
    accept(r);
    const o = prev.orders.find((x) => x.id === r.order_id);
    if (!o) throw err('Pesanan tidak ditemukan.', 404);
    let next;
    try { next = await applyTransition(prev, actor(r, o), 'pay', {orderId: r.order_id, amount: Number(r.amount), method: r.method}, {gateway}); }
    catch (e) { await conn.query("UPDATE payment_requests SET status = 'cancelled' WHERE id = ?", [id]); await conn.commit(); await conn.beginTransaction(); throw err('Tagihan sudah berubah, buat permintaan pembayaran baru.', 409); }
    await conn.query("UPDATE payment_requests SET status = 'paid', paid_at = UTC_TIMESTAMP(3) WHERE id = ?", [id]);
    return {next};
  }});
}

/** FO mengonfirmasi transfer atau tunai yang sudah diterima. */
export const confirmRequest = (user: SessionUser, id: string) => {
  if (user.role !== 'fo') throw err('Aksi tidak tersedia untuk peran ini.', 403);
  return settle(id, () => user.id, false, (r) => { if (kindOf(r.method) === 'qr' && demoPayEnabled()) throw err('Pembayaran QRIS diterima otomatis setelah kode dipindai.'); });
};

/** Halaman bayar QRIS: informasi dan pembayaran lewat token. Tanpa login karena dibuka dari ponsel. */
export async function demoInfo(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) throw err('Kode pembayaran tidak dikenali.', 404);
  const [[r]] = (await pool().query('SELECT r.status, r.amount, r.method, r.order_id, o.title FROM payment_requests r JOIN orders o ON o.id = r.order_id WHERE r.id = ?', [token])) as unknown as [[{status: string; amount: number | string; method: string; order_id: string; title: string} | undefined]];
  if (!r) throw err('Kode pembayaran tidak dikenali.', 404);
  return {status: r.status, amount: Number(r.amount), orderId: r.order_id, title: r.title, method: r.method, demo: demoPayEnabled()};
}
export async function demoPay(token: string) {
  if (!demoPayEnabled()) throw err('Pembayaran simulasi dinonaktifkan. Bayar sesuai arahan FO; FO akan mengonfirmasi setelah dana diterima.', 403);
  await demoInfo(token);
  await settle(token, (r) => r.customer_id, true, (r) => { if (kindOf(r.method) !== 'qr') throw err('Metode ini tidak dibayar lewat QR.'); });
}

/** QR (SVG) yang berisi alamat halaman pembayaran. Hanya pemilik permintaan yang boleh melihat. */
export async function qrSvg(user: SessionUser, id: string, origin: string) {
  const [[r]] = (await pool().query('SELECT customer_id, status FROM payment_requests WHERE id = ?', [id])) as unknown as [[{customer_id: string; status: string} | undefined]];
  if (!r || r.customer_id !== user.id) throw err('Permintaan tidak ditemukan.', 404);
  const base = (process.env.PUBLIC_URL || origin).replace(/\/$/, '');
  const qr = qrcode(0, 'M'); qr.addData(`${base}/bayar/${id}`); qr.make();
  return qr.createSvgTag({cellSize: 6, margin: 2, scalable: true});
}
