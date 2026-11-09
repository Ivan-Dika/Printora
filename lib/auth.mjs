// Autentikasi: login username/kata sandi, sesi berbasis cookie HttpOnly (token acak; yang disimpan hanya hash SHA-256-nya).
import { createHash, randomBytes } from 'node:crypto';
import { ensureReady, pool } from './mysql.mjs';
import { DUMMY_HASH, checkPassword, checkText, checkUsername, hashPassword, verifyPassword } from './password.mjs';

export const COOKIE = 'printora_session';
export const SESSION_HOURS = 12;
const g = globalThis;
const sha = (token) => createHash('sha256').update(token).digest('hex');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Pembatas laju sederhana di memori proses (cukup untuk satu server; ganti dengan penyimpanan bersama bila diskalakan).
const buckets = (g.__printoraBuckets ??= new Map());
export function throttle(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.until < now) { buckets.set(key, { n: 1, until: now + windowMs }); return; }
  if (b.n >= max) throw fail('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', 429);
  b.n += 1;
}
const clearThrottle = (key) => buckets.delete(key);

export function parseCookie(header, name = COOKIE) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}
export const sessionCookie = (token, secure) => `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure ? '; Secure' : ''}`;
export const clearedCookie = (secure) => `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

const publicUser = (u) => ({ id: u.id, username: u.username || '', name: u.name, phone: u.phone, role: u.role, active: !!u.active, mustChange: !!u.must_change });

export async function startSession(userId) {
  const token = randomBytes(32).toString('hex');
  const db = pool();
  await db.query('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP(3)');
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP(3) + INTERVAL ? HOUR)', [sha(token), userId, SESSION_HOURS]);
  await db.query('UPDATE users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?', [userId]);
  return token;
}

export async function login(username, password, ip = '') {
  await ensureReady();
  const name = String(username || '').trim().toLowerCase();
  if (!name || typeof password !== 'string' || !password || password.length > 128) throw fail('Isi username dan kata sandi.');
  const key = `login|${ip}|${name}`;
  throttle(key, 8, 10 * 60 * 1000);
  // Batas per akun tanpa IP: tetap berlaku bila penyerang memalsukan alamat IP. Tidak direset oleh login berhasil.
  throttle(`login|user|${name}`, 40, 60 * 60 * 1000);
  const [[u]] = await pool().query('SELECT id, username, password_hash, name, phone, role, active, must_change FROM users WHERE username = ?', [name]);
  const ok = await verifyPassword(password, u?.password_hash || DUMMY_HASH);
  if (!u || !u.password_hash || !ok || !u.active) throw fail('Username atau kata sandi salah.', 401);
  clearThrottle(key);
  return { token: await startSession(u.id), user: publicUser(u) };
}

export async function getSessionUser(req) {
  const token = parseCookie(req.headers.get('cookie'));
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  await ensureReady();
  const [[u]] = await pool().query(
    `SELECT u.id, u.username, u.name, u.phone, u.role, u.active, u.must_change FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.active = 1`, [sha(token)]);
  return u ? publicUser(u) : null;
}

export async function logout(req) {
  const token = parseCookie(req.headers.get('cookie'));
  if (/^[0-9a-f]{64}$/.test(token)) await pool().query('DELETE FROM sessions WHERE token_hash = ?', [sha(token)]);
}

export async function changePassword(req, user, current, next) {
  checkPassword(next);
  const [[u]] = await pool().query('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  if (!(await verifyPassword(String(current || ''), u?.password_hash || DUMMY_HASH)) || !u?.password_hash) throw fail('Kata sandi saat ini salah.', 403);
  await pool().query('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?', [await hashPassword(next), user.id]);
  // Akhiri sesi lain milik pengguna ini; sesi yang sedang dipakai dipertahankan.
  await pool().query('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [user.id, sha(parseCookie(req.headers.get('cookie')))]);
}
