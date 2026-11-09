// Master data (katalog layanan, metode pembayaran, saluran pemberitahuan) dan manajemen pengguna oleh Admin.
import { randomBytes } from 'node:crypto';
import { ensureReady, pool } from './mysql.mjs';
import { checkPassword, checkText, checkUsername, hashPassword } from './password.mjs';
import { publicSettings, saveSettings } from './settings.mjs';
import { recentMessages, testChannel } from './messaging.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const ROLES = ['fo', 'customer', 'designer', 'operator', 'admin'];
const STYLES = ['banner', 'label', 'card', 'poster', 'invitation'];
// Metode pembayaran dan saluran pemberitahuan bawaan: boleh dinonaktifkan, tidak boleh dihapus (dipakai alur dan tampilan lama).
export const BUILTIN = { payment_methods: ['Tunai', 'Transfer', 'QRIS'], channels: ['Telepon', 'WhatsApp', 'Tatap muka'] };
const checkEmail = (v) => { const e = String(v ?? '').trim().toLowerCase(); if (!e) return ''; if (e.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw fail('Alamat email tidak valid.'); return e; };

const catalogRow = (c) => ({ id: c.id, name: c.name, category: c.category, description: c.description, hint: c.hint, sample: c.sample, style: c.style, sort: c.sort, active: !!c.active });

export async function activeCatalog() {
  await ensureReady();
  const [rows] = await pool().query('SELECT * FROM catalog WHERE active = 1 ORDER BY sort, id');
  return rows.map(catalogRow);
}
export async function activeLists() {
  await ensureReady();
  const [methods] = await pool().query('SELECT name FROM payment_methods WHERE active = 1 ORDER BY sort, name');
  const [channels] = await pool().query('SELECT name FROM channels WHERE active = 1 ORDER BY sort, name');
  return { methods: methods.map((m) => m.name), channels: channels.map((c) => c.name) };
}

export async function adminOverview() {
  await ensureReady();
  const db = pool();
  const [users] = await db.query('SELECT id, username, name, phone, email, role, active, created_at, last_login_at, password_hash IS NOT NULL AS has_login FROM users ORDER BY FIELD(role, "admin","fo","designer","operator","customer"), name');
  const [catalog] = await db.query('SELECT * FROM catalog ORDER BY sort, id');
  const [methods] = await db.query('SELECT name, active, sort FROM payment_methods ORDER BY sort, name');
  const [channels] = await db.query('SELECT name, active, sort FROM channels ORDER BY sort, name');
  const [[counts]] = await db.query('SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM files) AS files');
  return {
    users: users.map((u) => ({ id: u.id, username: u.username || '', name: u.name, phone: u.phone, email: u.email || '', role: u.role, active: !!u.active, hasLogin: !!u.has_login, created: u.created_at, lastLogin: u.last_login_at || '' })),
    catalog: catalog.map(catalogRow),
    methods: methods.map((m) => ({ name: m.name, active: !!m.active })),
    channels: channels.map((c) => ({ name: c.name, active: !!c.active })),
    counts,
    settings: await publicSettings(),
    messages: await recentMessages(),
  };
}

async function activeAdmins(db, exceptId = '') {
  const [[r]] = await db.query("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", [exceptId]);
  return r.n;
}

async function userAction(db, actor, action, b) {
  if (action === 'user.create') {
    const role = String(b.role);
    if (!ROLES.includes(role)) throw fail('Peran tidak valid.');
    const username = checkUsername(b.username);
    checkPassword(b.password);
    const id = 'u-' + randomBytes(8).toString('hex');
    try { await db.query('INSERT INTO users (id, username, password_hash, name, phone, email, role) VALUES (?,?,?,?,?,?,?)', [id, username, await hashPassword(b.password), checkText(b.name, 'Nama', 100), String(b.phone || '').trim().slice(0, 30), checkEmail(b.email) || null, role]); }
    catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail('Username sudah dipakai.', 409); throw e; }
    return;
  }
  const [[target]] = await db.query('SELECT id, role, active, username FROM users WHERE id = ?', [String(b.id || '')]);
  if (!target) throw fail('Pengguna tidak ditemukan.', 404);
  if (action === 'user.update') {
    const role = b.role === undefined ? target.role : String(b.role);
    if (!ROLES.includes(role)) throw fail('Peran tidak valid.');
    const active = b.active === undefined ? !!target.active : !!b.active;
    if (target.id === actor.id && (role !== target.role || !active)) throw fail('Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.');
    if (target.role === 'admin' && (role !== 'admin' || !active) && (await activeAdmins(db, target.id)) < 1) throw fail('Harus tersisa minimal satu Admin aktif.');
    if (role !== target.role) {
      const [[used]] = await db.query('SELECT COUNT(*) n FROM orders WHERE customer_id = ? OR designer_id = ? OR operator_id = ?', [target.id, target.id, target.id]);
      if (used.n) throw fail('Peran tidak dapat diubah karena pengguna sudah terkait dengan pesanan. Nonaktifkan akun dan buat akun baru.');
    }
    const username = b.username === undefined || b.username === '' ? target.username : checkUsername(b.username);
    try { await db.query('UPDATE users SET name = ?, phone = ?, email = ?, role = ?, active = ?, username = ? WHERE id = ?', [checkText(b.name, 'Nama', 100), String(b.phone || '').trim().slice(0, 30), checkEmail(b.email) || null, role, active ? 1 : 0, username || null, target.id]); }
    catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail('Username sudah dipakai.', 409); throw e; }
    if (!active) await db.query('DELETE FROM sessions WHERE user_id = ?', [target.id]);
    return;
  }
  if (action === 'user.password') {
    checkPassword(b.password);
    const username = target.username || checkUsername(b.username);
    try { await db.query('UPDATE users SET password_hash = ?, username = ? WHERE id = ?', [await hashPassword(b.password), username, target.id]); }
    catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail('Username sudah dipakai.', 409); throw e; }
    await db.query('DELETE FROM sessions WHERE user_id = ?', [target.id]);
    return;
  }
  throw fail('Aksi tidak dikenal.');
}

async function listAction(db, table, label, action, b) {
  const name = checkText(b.name, label, 30);
  if (action.endsWith('.add')) {
    try { await db.query(`INSERT INTO ${table} (name, sort) VALUES (?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM (SELECT sort FROM ${table}) t))`, [name]); }
    catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail(`${label} sudah ada.`, 409); throw e; }
    return;
  }
  const [[row]] = await db.query(`SELECT name, active FROM ${table} WHERE name = ?`, [name]);
  if (!row) throw fail(`${label} tidak ditemukan.`, 404);
  if (action.endsWith('.toggle')) {
    const active = !!b.active;
    if (!active) { const [[r]] = await db.query(`SELECT COUNT(*) n FROM ${table} WHERE active = 1 AND name <> ?`, [name]); if (r.n < 1) throw fail(`Minimal satu ${label.toLowerCase()} harus aktif.`); }
    await db.query(`UPDATE ${table} SET active = ? WHERE name = ?`, [active ? 1 : 0, name]);
    return;
  }
  if (action.endsWith('.delete')) {
    if (BUILTIN[table]?.includes(row.name)) throw fail(`${label} bawaan "${row.name}" tidak dapat dihapus. Nonaktifkan saja bila tidak dipakai.`);
    if (row.active) { const [[r]] = await db.query(`SELECT COUNT(*) n FROM ${table} WHERE active = 1 AND name <> ?`, [name]); if (r.n < 1) throw fail(`Minimal satu ${label.toLowerCase()} harus aktif.`); }
    await db.query(`DELETE FROM ${table} WHERE name = ?`, [name]);
    return;
  }
  throw fail('Aksi tidak dikenal.');
}

async function catalogAction(db, action, b) {
  if (action === 'catalog.delete') { await db.query('DELETE FROM catalog WHERE id = ?', [Number(b.id)]); return; }
  const style = String(b.style || 'poster');
  if (!STYLES.includes(style)) throw fail('Gaya contoh tidak valid.');
  const row = [checkText(b.name, 'Nama produk', 100), checkText(b.category, 'Kategori', 40), checkText(b.description, 'Deskripsi', 300), checkText(b.hint, 'Petunjuk spesifikasi', 300), checkText(String(b.sample ?? '').replace(/\r/g, ''), 'Teks contoh', 60), style, Number.isInteger(Number(b.sort)) ? Number(b.sort) : 0, b.active === false ? 0 : 1];
  try {
    if (b.id) await db.query('UPDATE catalog SET name=?, category=?, description=?, hint=?, sample=?, style=?, sort=?, active=? WHERE id=?', [...row, Number(b.id)]);
    else await db.query('INSERT INTO catalog (name, category, description, hint, sample, style, sort, active) VALUES (?,?,?,?,?,?,?,?)', row);
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail('Nama produk sudah ada.', 409); throw e; }
}

export async function adminAct(actor, action, b = {}) {
  await ensureReady();
  const db = pool();
  if (action === 'settings.save') return saveSettings(b);
  if (action === 'settings.test') return testChannel(String(b.channel || ''), String(b.to || ''));
  if (action.startsWith('user.')) return userAction(db, actor, action, b);
  if (action.startsWith('catalog.')) return catalogAction(db, action, b);
  if (action.startsWith('method.')) return listAction(db, 'payment_methods', 'Metode pembayaran', action, b);
  if (action.startsWith('channel.')) return listAction(db, 'channels', 'Saluran pemberitahuan', action, b);
  throw fail('Aksi tidak dikenal.');
}
