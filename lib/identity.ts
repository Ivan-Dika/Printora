// Normalisasi identitas pelanggan (telepon dan email) untuk pemesanan publik.

/** Nomor telepon Indonesia ke bentuk lokal "08…"; null bila tidak valid. */
export function normalizePhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!d) return null;
  d = d.replace(/^\+/, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8')) d = '0' + d;
  return /^08\d{7,12}$/.test(d) ? d : null;
}

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  return e && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Kata sandi acak 10 karakter tanpa karakter yang mudah tertukar (0/O, 1/l/I). */
export function randomPassword(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 10), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function usernameBase(name: string): string {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '').slice(0, 12);
  return s.length >= 2 ? s : 'pelanggan';
}
