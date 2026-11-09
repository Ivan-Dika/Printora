// Lapisan database MySQL Printora (Node). Dipakai oleh rute API dan skrip scripts/db.mjs.
// Tidak bergantung pada TypeScript agar skrip CLI dapat memakainya langsung.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { hashPassword } from './password.mjs';

try { process.loadEnvFile(path.resolve(process.cwd(), '.env')); } catch { /* .env opsional; variabel lingkungan tetap dipakai */ }

export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 500;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const uploadDir = () => path.resolve(process.cwd(), process.env.UPLOAD_DIR || './storage/uploads');

const g = globalThis;
export function pool() {
  if (!g.__printoraPool) {
    g.__printoraPool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      database: process.env.MYSQL_DATABASE || 'printora',
      user: process.env.MYSQL_USER || 'printora_app',
      password: process.env.MYSQL_PASSWORD || '',
      waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4', timezone: 'Z', dateStrings: true,
    });
  }
  return g.__printoraPool;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (id TINYINT NOT NULL PRIMARY KEY, revision INT NOT NULL DEFAULT 0, seeded TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) NOT NULL PRIMARY KEY, username VARCHAR(32) NULL UNIQUE, password_hash VARCHAR(255) NULL,
    name VARCHAR(100) NOT NULL, phone VARCHAR(30) NOT NULL, email VARCHAR(120) NULL, must_change TINYINT NOT NULL DEFAULT 0,
    role ENUM('fo','customer','designer','operator','admin') NOT NULL, active TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), last_login_at DATETIME(3) NULL, KEY idx_users_role (role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY, user_id VARCHAR(64) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), expires_at DATETIME(3) NOT NULL,
    KEY idx_sessions_user (user_id), KEY idx_sessions_exp (expires_at), CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS catalog (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, category VARCHAR(40) NOT NULL, description VARCHAR(300) NOT NULL,
    hint VARCHAR(300) NOT NULL, sample VARCHAR(60) NOT NULL, style VARCHAR(20) NOT NULL DEFAULT 'poster', sort INT NOT NULL DEFAULT 0, active TINYINT NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS payment_methods (name VARCHAR(30) NOT NULL PRIMARY KEY, active TINYINT NOT NULL DEFAULT 1, sort INT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS channels (name VARCHAR(30) NOT NULL PRIMARY KEY, active TINYINT NOT NULL DEFAULT 1, sort INT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS files (
    id CHAR(36) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, mime VARCHAR(100) NOT NULL, size BIGINT NOT NULL, path VARCHAR(255) NOT NULL,
    uploader VARCHAR(64) NOT NULL, attached TINYINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_files_orphan (attached, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS settings (k VARCHAR(40) NOT NULL PRIMARY KEY, v TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS message_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), channel VARCHAR(20) NOT NULL, kind VARCHAR(30) NOT NULL,
    recipient VARCHAR(80) NOT NULL, ok TINYINT NOT NULL, error VARCHAR(300) NOT NULL DEFAULT ''
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(20) NOT NULL PRIMARY KEY, customer_id VARCHAR(64) NOT NULL, title VARCHAR(100) NOT NULL, spec TEXT NOT NULL, qty INT NOT NULL,
    created_at DATETIME(3) NOT NULL, due DATE NULL, total BIGINT NOT NULL DEFAULT 0, dp BIGINT NOT NULL DEFAULT 0, verified TINYINT NOT NULL DEFAULT 0,
    designer_id VARCHAR(64) NULL, operator_id VARCHAR(64) NULL, status VARCHAR(30) NOT NULL, qc TEXT NOT NULL, recipient VARCHAR(100) NOT NULL DEFAULT '',
    handover_at DATETIME(3) NULL, request_id VARCHAR(64) NULL UNIQUE, mode VARCHAR(10) NOT NULL DEFAULT 'desain',
    KEY idx_orders_customer (customer_id), KEY idx_orders_status (status), KEY idx_orders_created (created_at),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_orders_designer FOREIGN KEY (designer_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_operator FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS designs (
    id VARCHAR(64) NOT NULL PRIMARY KEY, order_id VARCHAR(20) NOT NULL, version INT NOT NULL, name VARCHAR(150) NOT NULL, file_id CHAR(36) NULL,
    note TEXT NOT NULL, approved TINYINT NOT NULL DEFAULT 0, final TINYINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL,
    KEY idx_designs_order (order_id, version), CONSTRAINT fk_designs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) NOT NULL PRIMARY KEY, order_id VARCHAR(20) NOT NULL, kind VARCHAR(20) NOT NULL, amount BIGINT NOT NULL, method VARCHAR(20) NOT NULL,
    paid_at DATETIME(3) NOT NULL, by_user VARCHAR(64) NOT NULL, KEY idx_payments_order (order_id),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS payment_requests (
    id CHAR(32) NOT NULL PRIMARY KEY, order_id VARCHAR(20) NOT NULL, customer_id VARCHAR(64) NOT NULL, method VARCHAR(20) NOT NULL, amount BIGINT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), paid_at DATETIME(3) NULL,
    KEY idx_payreq_order (order_id, status), CONSTRAINT fk_payreq_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id VARCHAR(64) NOT NULL PRIMARY KEY, order_id VARCHAR(20) NOT NULL, name VARCHAR(150) NOT NULL, file_id CHAR(36) NULL, created_at DATETIME(3) NOT NULL,
    KEY idx_attachments_order (order_id), CONSTRAINT fk_attachments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ...[['revisions', 'text TEXT NOT NULL'], ['issues', 'text TEXT NOT NULL, by_user VARCHAR(64) NOT NULL'],
      ['notifications', 'channel VARCHAR(20) NOT NULL, note TEXT NOT NULL, by_user VARCHAR(64) NOT NULL'],
      ['history', 'text TEXT NOT NULL, by_user VARCHAR(64) NOT NULL']].map(([t, cols]) =>
    `CREATE TABLE IF NOT EXISTS ${t} (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(20) NOT NULL, ${cols}, created_at DATETIME(3) NOT NULL,
      KEY idx_${t}_order (order_id), CONSTRAINT fk_${t}_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`),
];
const TABLES = ['message_log', 'settings', 'sessions', 'payment_requests', 'history', 'notifications', 'issues', 'revisions', 'attachments', 'payments', 'designs', 'orders', 'files', 'catalog', 'payment_methods', 'channels', 'users', 'meta'];

// ISO 8601 <-> DATETIME(3) (UTC). Tanggal saja (YYYY-MM-DD) dianggap tengah malam UTC.
const toSql = (iso) => { if (!iso) return null; const s = String(iso); return (s.length === 10 ? s + ' 00:00:00.000' : s.replace('T', ' ').replace('Z', '')).slice(0, 23); };
const fromSql = (s) => (s ? String(s).replace(' ', 'T') + (String(s).length === 23 ? 'Z' : '') : '');
const fileRef = (id) => (id ? '/api/files/' + id : '');
const fileId = (ref) => { const m = /^\/api\/files\/([0-9a-f-]{36})$/.exec(ref || ''); return m ? m[1] : null; };
const flag = (v) => (v ? 1 : 0);

async function dropAll() {
  const conn = await pool().getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of TABLES) await conn.query(`DROP TABLE IF EXISTS ${t}`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally { conn.release(); }
  const dir = uploadDir();
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true, recursive: true });
}

export async function migrate() {
  const db = pool();
  // Skema lama (tanpa login) hanya berisi data contoh; dibuang dan dibuat ulang.
  const [[legacy]] = await db.query(`SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users') AS has_users,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username') AS has_username`);
  if (legacy.has_users && !legacy.has_username) await dropAll();
  for (const sql of SCHEMA) await db.query(sql);
  // Kolom tambahan untuk basis data yang dibuat sebelum pesanan publik (ditambahkan bila belum ada).
  const addColumn = async (table, column, ddl) => {
    const [[c]] = await db.query('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
    if (!c.n) await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  };
  await addColumn('users', 'email', 'VARCHAR(120) NULL');
  await addColumn('users', 'must_change', 'TINYINT NOT NULL DEFAULT 0');
  await addColumn('orders', 'mode', "VARCHAR(10) NOT NULL DEFAULT 'desain'");
  await addColumn('orders', 'print_file', 'VARCHAR(64) NULL');
  await db.query('INSERT IGNORE INTO meta (id, revision, seeded) VALUES (1, 0, 0)');
  fs.mkdirSync(uploadDir(), { recursive: true });
}

/** Membaca seluruh keadaan (pengguna + pesanan beserta anak-anaknya) dari satu koneksi. */
export async function readState(conn) {
  const [userRows] = await conn.query('SELECT id, username, name, phone, email, must_change, role, active FROM users ORDER BY created_at, id');
  const users = userRows.map((u) => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, ...(u.username ? { username: u.username } : {}), ...(u.email ? { email: u.email } : {}), ...(u.must_change ? { mustChange: true } : {}), active: !!u.active }));
  const [rows] = await conn.query('SELECT * FROM orders ORDER BY created_at DESC, LENGTH(id) DESC, id DESC');
  const [files] = await conn.query('SELECT id, mime, size FROM files WHERE id IN (SELECT file_id FROM designs WHERE file_id IS NOT NULL UNION SELECT file_id FROM attachments WHERE file_id IS NOT NULL)');
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const group = async (table, order = 'id') => { const [r] = await conn.query(`SELECT * FROM ${table} ORDER BY ${order}`); const m = new Map(); for (const x of r) { if (!m.has(x.order_id)) m.set(x.order_id, []); m.get(x.order_id).push(x); } return m; };
  const [designs, payments, attachments, revisions, issues, notifications, history] = await Promise.all([
    group('designs', 'version'), group('payments', 'paid_at, id'), group('attachments', 'created_at, id'), group('revisions'), group('issues'), group('notifications'), group('history'),
  ]);
  const withFile = (x, extra) => { const f = fileMap.get(x.file_id); return { ...extra, file: fileRef(x.file_id), ...(f ? { mime: f.mime, size: Number(f.size) } : {}) }; };
  const orders = rows.map((o) => ({
    id: o.id, customerId: o.customer_id, title: o.title, spec: o.spec, qty: o.qty, created: fromSql(o.created_at), due: o.due || '', total: Number(o.total), dp: Number(o.dp),
    mode: o.mode === 'cetak' ? 'cetak' : 'desain', ...(o.print_file ? { printFile: o.print_file } : {}), verified: !!o.verified, designerId: o.designer_id || '', operatorId: o.operator_id || '', status: o.status,
    designs: (designs.get(o.id) || []).map((d) => withFile(d, { id: d.id, version: d.version, name: d.name, note: d.note, approved: !!d.approved, final: !!d.final, created: fromSql(d.created_at) })),
    payments: (payments.get(o.id) || []).map((p) => ({ id: p.id, kind: p.kind, amount: Number(p.amount), method: p.method, date: fromSql(p.paid_at), by: p.by_user })),
    revisions: (revisions.get(o.id) || []).map((r) => ({ text: r.text, date: fromSql(r.created_at) })),
    qc: o.qc, recipient: o.recipient, handoverDate: fromSql(o.handover_at),
    attachments: (attachments.get(o.id) || []).map((a) => withFile(a, { id: a.id, name: a.name, date: fromSql(a.created_at) })),
    issues: (issues.get(o.id) || []).map((i) => ({ text: i.text, date: fromSql(i.created_at), by: i.by_user })),
    notifications: (notifications.get(o.id) || []).map((n) => ({ channel: n.channel, note: n.note, date: fromSql(n.created_at), by: n.by_user })),
    history: (history.get(o.id) || []).map((h) => ({ text: h.text, date: fromSql(h.created_at), by: h.by_user })),
    ...(o.request_id ? { requestId: o.request_id } : {}),
  }));
  return { users, orders };
}

async function saveOrder(conn, o) {
  await conn.query(
    `INSERT INTO orders (id, customer_id, title, spec, qty, created_at, due, total, dp, verified, designer_id, operator_id, status, qc, recipient, handover_at, request_id, mode, print_file)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE customer_id=VALUES(customer_id), title=VALUES(title), spec=VALUES(spec), qty=VALUES(qty), due=VALUES(due), total=VALUES(total), dp=VALUES(dp),
       verified=VALUES(verified), designer_id=VALUES(designer_id), operator_id=VALUES(operator_id), status=VALUES(status), qc=VALUES(qc), recipient=VALUES(recipient), handover_at=VALUES(handover_at), mode=VALUES(mode), print_file=VALUES(print_file)`,
    [o.id, o.customerId, o.title, o.spec, o.qty, toSql(o.created), o.due || null, o.total, o.dp, flag(o.verified), o.designerId || null, o.operatorId || null, o.status, o.qc || '', o.recipient || '', toSql(o.handoverDate), o.requestId || null, o.mode === 'cetak' ? 'cetak' : 'desain', o.mode === 'cetak' ? (o.printFile || null) : null]);
  for (const t of ['designs', 'payments', 'attachments', 'revisions', 'issues', 'notifications', 'history']) await conn.query(`DELETE FROM ${t} WHERE order_id = ?`, [o.id]);
  const bulk = async (sql, rows) => { if (rows.length) await conn.query(sql, [rows]); };
  await bulk('INSERT INTO designs (id, order_id, version, name, file_id, note, approved, final, created_at) VALUES ?', o.designs.map((d) => [d.id, o.id, d.version, d.name, fileId(d.file), d.note || '', flag(d.approved), flag(d.final), toSql(d.created)]));
  await bulk('INSERT INTO payments (id, order_id, kind, amount, method, paid_at, by_user) VALUES ?', o.payments.map((p) => [p.id, o.id, p.kind, p.amount, p.method, toSql(p.date), p.by]));
  await bulk('INSERT INTO attachments (id, order_id, name, file_id, created_at) VALUES ?', (o.attachments || []).map((a) => [a.id, o.id, a.name, fileId(a.file), toSql(a.date)]));
  await bulk('INSERT INTO revisions (order_id, text, created_at) VALUES ?', o.revisions.map((r) => [o.id, r.text, toSql(r.date)]));
  await bulk('INSERT INTO issues (order_id, text, by_user, created_at) VALUES ?', (o.issues || []).map((i) => [o.id, i.text, i.by, toSql(i.date)]));
  await bulk('INSERT INTO notifications (order_id, channel, note, by_user, created_at) VALUES ?', (o.notifications || []).map((n) => [o.id, n.channel, n.note || '', n.by, toSql(n.date)]));
  await bulk('INSERT INTO history (order_id, text, by_user, created_at) VALUES ?', o.history.map((h) => [o.id, h.text, h.by, toSql(h.date)]));
}

async function writeDiff(conn, prev, next) {
  const prevUsers = new Map(prev.users.map((u) => [u.id, JSON.stringify(u)]));
  for (const u of next.users) if (prevUsers.get(u.id) !== JSON.stringify(u)) await conn.query('INSERT INTO users (id, name, phone, role) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone)', [u.id, u.name, u.phone, u.role]);
  const prevOrders = new Map(prev.orders.map((o) => [o.id, JSON.stringify(o)]));
  for (const o of [...next.orders].reverse()) if (prevOrders.get(o.id) !== JSON.stringify(o)) await saveOrder(conn, o);
}

/** Memastikan berkas yang baru dirujuk benar-benar ada, milik pengunggah, dan belum dipakai; lalu menandainya terpakai. */
async function claimFiles(conn, prev, next, uploader) {
  // Setiap rancangan/lampiran BARU (id belum ada sebelumnya) harus merujuk berkas yang belum terpasang; satu berkas hanya untuk satu rujukan.
  const items = (s) => s.orders.flatMap((o) => [...o.designs, ...(o.attachments || [])]);
  const known = new Set(items(prev).map((x) => x.id));
  for (const item of items(next)) {
    if (known.has(item.id)) continue;
    const id = fileId(item.file);
    if (!id) continue;
    const [[f]] = await conn.query('SELECT id, attached, uploader FROM files WHERE id = ? FOR UPDATE', [id]);
    if (!f || f.attached || f.uploader !== uploader) throw Object.assign(new Error('Berkas tidak ditemukan atau sudah dipakai. Unggah ulang berkas.'), { status: 400 });
    await conn.query('UPDATE files SET attached = 1 WHERE id = ?', [id]);
  }
}

const DEFAULT_CATALOG = [
  ['Banner & Spanduk', 'Promosi', 'Untuk promosi toko, acara, dan informasi di ruang terbuka.', 'Ukuran banner, bahan, dan finishing mata ayam', 'RUANG\nKREASI', 'banner'],
  ['Stiker & Label', 'Kemasan', 'Identitas produk untuk kemasan kopi, botol, dan paket usaha.', 'Bentuk label, ukuran, bahan, dan laminasi', 'KOPI\nSENJA', 'label'],
  ['Kartu Nama', 'Identitas', 'Perkenalkan usaha dan bagikan kontak lewat kartu cetak.', 'Ukuran kartu, jenis kertas, serta cetak satu atau dua sisi', 'studio\ntitik.', 'card'],
  ['Brosur & Poster', 'Promosi', 'Sampaikan menu, program, atau agenda dalam lembar cetak.', 'Ukuran, jenis kertas, sisi cetak, dan lipatan', 'TEMU\nRASA', 'poster'],
  ['Undangan', 'Acara', 'Rangkai informasi acara dalam undangan dengan pilihan lipatan.', 'Ukuran, jenis kertas, lipatan, dan tema acara', 'Satu\nCerita', 'invitation'],
];

/** Data awal sekali saja: master data bawaan dan satu akun Admin. Tidak ada pesanan atau pengguna contoh. */
export async function seedIfEmpty() {
  const db = pool();
  let password = process.env.ADMIN_PASSWORD, generated = false;
  if (!password) { password = randomBytes(9).toString('base64url'); generated = true; }
  const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const hash = await hashPassword(password);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[m]] = await conn.query('SELECT seeded FROM meta WHERE id = 1 FOR UPDATE');
    if (!m.seeded) {
      await conn.query('INSERT INTO users (id, username, password_hash, name, phone, role) VALUES (?,?,?,?,?,?)', ['admin-1', username, hash, 'Admin Aplikasi', '', 'admin']);
      await conn.query('INSERT INTO catalog (name, category, description, hint, sample, style, sort) VALUES ?', [DEFAULT_CATALOG.map((c, i) => [...c, i])]);
      await conn.query('INSERT INTO payment_methods (name, sort) VALUES ?', [['Tunai', 'Transfer', 'QRIS'].map((n, i) => [n, i])]);
      await conn.query('INSERT INTO channels (name, sort) VALUES ?', [['Telepon', 'WhatsApp', 'Tatap muka'].map((n, i) => [n, i])]);
      await conn.query('UPDATE meta SET seeded = 1, revision = revision + 1 WHERE id = 1');
      if (generated) {
        const file = path.join(path.dirname(uploadDir()), 'admin-initial-password.txt');
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        fs.rmSync(file, { force: true });
        fs.writeFileSync(file, `username: ${username}\npassword: ${password}\n`, { mode: 0o600 });
        console.log(`[printora] Akun admin dibuat. Kata sandi awal ada di ${file}`);
      }
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

/** Migrasi + data awal, sekali per proses. */
export function ensureReady() {
  if (!g.__printoraReady) g.__printoraReady = (async () => { await migrate(); await seedIfEmpty(); })().catch((e) => { g.__printoraReady = undefined; throw e; });
  return g.__printoraReady;
}

export async function snapshot() {
  await ensureReady();
  const conn = await pool().getConnection();
  try { const state = await readState(conn); const [[m]] = await conn.query('SELECT revision FROM meta WHERE id = 1'); return { state, revision: m.revision }; } finally { conn.release(); }
}

/**
 * Satu perubahan atomik. Transaksi mengunci baris meta sehingga penulis berurutan;
 * `expectedRevision` yang tidak cocok menghasilkan galat 409 (data sudah berubah).
 * `fn(prev)` mengembalikan keadaan berikutnya; `uploader` (id pengguna sesi) memverifikasi kepemilikan berkas baru.
 */
export async function mutate({ expectedRevision, uploader, fn }) {
  await ensureReady();
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const [[m]] = await conn.query('SELECT revision FROM meta WHERE id = 1 FOR UPDATE');
    if (expectedRevision != null && m.revision !== expectedRevision) throw Object.assign(new Error('Data berubah. Muat ulang lalu coba lagi.'), { status: 409 });
    const prev = await readState(conn);
    const out = await fn(prev, conn);
    const next = out.next ?? out;
    await claimFiles(conn, prev, next, uploader);
    await writeDiff(conn, prev, next);
    await conn.query('UPDATE meta SET revision = revision + 1 WHERE id = 1');
    const state = await readState(conn);
    await conn.commit();
    return { state, revision: m.revision + 1, extra: out.extra };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

export async function removeStaleUploads() {
  const db = pool();
  const [rows] = await db.query('SELECT id, path FROM files WHERE attached = 0 AND created_at < (UTC_TIMESTAMP(3) - INTERVAL 1 DAY) LIMIT 200');
  for (const r of rows) { try { fs.unlinkSync(r.path); } catch { /* sudah hilang */ } await db.query('DELETE FROM files WHERE id = ? AND attached = 0', [r.id]); }
}

/** Menghapus seluruh tabel dan berkas, lalu membuat ulang skema dan data awal (master data + akun Admin). */
export async function reset() {
  await dropAll();
  g.__printoraReady = undefined;
  await ensureReady();
}
