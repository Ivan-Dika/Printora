// Pengaturan aplikasi yang diisi Admin (WhatsApp/WAHA, SMTP, alamat situs). Rahasia (API key, kata sandi SMTP)
// disimpan terenkripsi AES-256-GCM; kunci dari SETTINGS_KEY atau berkas kunci acak di samping folder unggahan.
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ensureReady, pool, uploadDir } from './mysql.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const g = globalThis;

const SECRETS = ['waha_key', 'smtp_pass'];
const FIELDS = ['waha_enabled', 'waha_url', 'waha_session', 'waha_key', 'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'mail_from', 'public_url'];

function masterKey() {
  if (g.__printoraSettingsKey) return g.__printoraSettingsKey;
  let secret = process.env.SETTINGS_KEY || '';
  if (!secret) {
    const file = path.join(path.dirname(uploadDir()), 'settings.key');
    if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 }); }
    secret = fs.readFileSync(file, 'utf8').trim();
  }
  return (g.__printoraSettingsKey = createHash('sha256').update(secret).digest());
}
const seal = (plain) => {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return 'enc1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
};
const open = (stored) => {
  if (!stored.startsWith('enc1:')) return '';
  try {
    const raw = Buffer.from(stored.slice(5), 'base64'), d = createDecipheriv('aes-256-gcm', masterKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; } // kunci berganti: rahasia harus diisi ulang
};

/** Seluruh pengaturan (rahasia sudah didekripsi). Hanya untuk dipakai server. */
export async function getSettings() {
  await ensureReady();
  const [rows] = await pool().query('SELECT k, v FROM settings');
  const s = Object.fromEntries(FIELDS.map((f) => [f, '']));
  for (const r of rows) if (r.k in s) s[r.k] = SECRETS.includes(r.k) ? open(r.v) : r.v;
  return s;
}

/** Pengaturan untuk ditampilkan ke Admin: rahasia tidak pernah dikembalikan, hanya penanda sudah terisi. */
export async function publicSettings() {
  const s = await getSettings();
  const out = { ...s, hasWahaKey: !!s.waha_key, hasSmtpPass: !!s.smtp_pass };
  for (const k of SECRETS) delete out[k];
  return out;
}

const text = (v, max) => String(v ?? '').trim().slice(0, max);
function url(v, label) {
  const s = text(v, 200).replace(/\/+$/, '');
  if (!s) return '';
  let u; try { u = new URL(s); } catch { throw fail(label + ' tidak valid. Contoh: http://localhost:3000'); }
  if (!/^https?:$/.test(u.protocol)) throw fail(label + ' harus diawali http:// atau https://');
  return s;
}

/** Menyimpan pengaturan. Rahasia yang dikosongkan tidak mengubah nilai tersimpan; `clear_waha_key`/`clear_smtp_pass` menghapusnya. */
export async function saveSettings(b) {
  await ensureReady();
  const cur = await getSettings();
  const next = { ...cur };
  next.waha_enabled = b.waha_enabled ? '1' : '0';
  next.waha_url = url(b.waha_url, 'Alamat WAHA');
  next.waha_session = text(b.waha_session, 60) || 'default';
  next.smtp_enabled = b.smtp_enabled ? '1' : '0';
  next.smtp_host = text(b.smtp_host, 120);
  const port = text(b.smtp_port, 5) || '587';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw fail('Port SMTP tidak valid.');
  next.smtp_port = port;
  next.smtp_secure = b.smtp_secure ? '1' : '0';
  next.smtp_user = text(b.smtp_user, 120);
  next.mail_from = text(b.mail_from, 160);
  next.public_url = url(b.public_url, 'Alamat situs');
  if (text(b.waha_key, 200)) next.waha_key = text(b.waha_key, 200); else if (b.clear_waha_key) next.waha_key = '';
  if (text(b.smtp_pass, 200)) next.smtp_pass = text(b.smtp_pass, 200); else if (b.clear_smtp_pass) next.smtp_pass = '';
  if (next.waha_enabled === '1' && !next.waha_url) throw fail('Isi alamat WAHA untuk mengaktifkan WhatsApp.');
  if (next.smtp_enabled === '1') {
    if (!next.smtp_host) throw fail('Isi host SMTP untuk mengaktifkan email.');
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$|^[^<]*<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/.test(next.mail_from)) throw fail('Isi alamat pengirim email yang valid. Contoh: Printora <info@contoh.co.id>');
  }
  const rows = FIELDS.map((f) => [f, SECRETS.includes(f) ? (next[f] ? seal(next[f]) : '') : next[f]]);
  await pool().query('INSERT INTO settings (k, v) VALUES ? ON DUPLICATE KEY UPDATE v = VALUES(v)', [rows]);
}
