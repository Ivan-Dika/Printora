// Hash dan validasi kredensial (hanya modul bawaan Node: scrypt + perbandingan waktu-konstan).
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), want.length);
  return key.length === want.length && timingSafeEqual(key, want);
}

/** Hash tiruan untuk menyamakan waktu respons saat username tidak ada. */
export const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw Object.assign(new Error('Kata sandi harus 8 sampai 128 karakter.'), { status: 400 });
  return password;
}

export function checkUsername(value) {
  const name = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(name)) throw Object.assign(new Error('Username 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.'), { status: 400 });
  return name;
}

export function checkText(value, label, max) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw Object.assign(new Error(`${label} wajib diisi (maks. ${max} karakter).`), { status: 400 });
  return text;
}
