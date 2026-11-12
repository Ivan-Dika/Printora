// Menyalakan Cloudflare Quick Tunnel (layanan "tunnel" di docker-compose.yml) lalu menyimpan alamat barunya
// ke pengaturan "Alamat situs" aplikasi, supaya tautan di WhatsApp/email selalu benar.
//   npm run tunnel          nyalakan tunnel (alamat lama dipakai bila kontainer sudah jalan) dan sinkronkan
//   npm run tunnel -- --new paksa alamat baru (kontainer dibuat ulang) dan sinkronkan
//   npm run tunnel -- --stop matikan tunnel
// Butuh Docker, .env.docker, dan aplikasi yang sedang jalan di http://127.0.0.1:8787 (ubah dengan APP_URL).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = process.env.APP_URL || 'http://127.0.0.1:8787';
const args = process.argv.slice(2);

const envFile = path.join(root, '.env.docker');
if (!fs.existsSync(envFile)) { console.error('Berkas .env.docker tidak ditemukan.'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const compose = (...a) => spawnSync('docker', ['compose', '--env-file', '.env.docker', '--profile', 'tunnel', ...a], {cwd: root, encoding: 'utf8'});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (args.includes('--stop')) { const r = compose('stop', 'tunnel'); process.stdout.write(r.stderr || r.stdout); console.log('Tunnel dimatikan. "Alamat situs" di pengaturan tidak diubah.'); process.exit(r.status ?? 0); }

const up = compose('up', '-d', ...(args.includes('--new') ? ['--force-recreate'] : []), 'tunnel');
if (up.status !== 0) { console.error(up.stderr || up.stdout); process.exit(1); }

// Alamat terbaru dicari di log kontainer (bisa beberapa detik setelah mulai).
let url = '';
for (let i = 0; i < 40 && !url; i++) {
  const logs = compose('logs', '--no-log-prefix', 'tunnel');
  const m = [...(logs.stdout + logs.stderr).matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)].at(-1);
  if (m) url = m[0]; else await sleep(1500);
}
if (!url) { console.error('Alamat tunnel belum muncul. Cek: docker compose --env-file .env.docker logs tunnel'); process.exit(1); }

// Simpan ke pengaturan lewat API Admin (pengaturan lain dipertahankan; rahasia yang dikosongkan tidak berubah).
async function api(p, body, cookie) {
  const r = await fetch(appUrl + p, {method: body ? 'POST' : 'GET', headers: {Origin: appUrl, ...(body ? {'Content-Type': 'application/json'} : {}), ...(cookie ? {Cookie: cookie} : {})}, body: body ? JSON.stringify(body) : undefined});
  return {r, json: await r.json().catch(() => ({}))};
}
const login = await api('/api/auth/login', {username: env.ADMIN_USERNAME || 'admin', password: env.ADMIN_PASSWORD});
if (login.r.status !== 200) { console.error('Login admin gagal (' + login.r.status + '). Alamat tunnel: ' + url + ' (isi manual di Pengaturan).'); process.exit(1); }
const cookie = login.r.headers.get('set-cookie').split(';')[0];
const cur = (await api('/api/admin', null, cookie)).json.settings || {};
if (cur.public_url === url) { console.log('Alamat situs sudah sesuai: ' + url); process.exit(0); }
const save = await api('/api/admin', {action: 'settings.save', data: {...cur, public_url: url, waha_enabled: cur.waha_enabled === '1', smtp_enabled: cur.smtp_enabled === '1', smtp_secure: cur.smtp_secure === '1'}}, cookie);
if (save.r.status !== 200) { console.error('Gagal menyimpan pengaturan: ' + JSON.stringify(save.json)); process.exit(1); }
console.log('Tunnel aktif: ' + url + '\nAlamat situs di pengaturan sudah diperbarui' + (cur.public_url ? ' (sebelumnya ' + cur.public_url + ').' : '.'));
