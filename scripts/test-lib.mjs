// Pembantu tes API: sesi bercookie, login, dan pembuatan akun uji oleh Admin.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function envValue(key) {
  if (process.env[key]) return process.env[key];
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(key + '='));
  return line ? line.slice(key.length + 1).trim() : '';
}

/** Klien HTTP dengan cookie sesi sendiri. */
export class Session {
  constructor(base) { this.base = base; this.cookie = ''; this.user = null; }
  async fetch(url, opt = {}) {
    const headers = {Origin: this.base, ...(opt.headers || {})};
    if (this.cookie) headers.Cookie = this.cookie;
    const r = await fetch(url.startsWith('http') ? url : this.base + url, {...opt, headers});
    const set = r.headers.get('set-cookie');
    if (set) { const c = set.split(';')[0]; this.cookie = c.endsWith('=') ? '' : c; }
    return r;
  }
  async json(url, body, opt = {}) {
    const r = await this.fetch(url, {method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body), ...opt});
    return {status: r.status, body: await r.json().catch(() => ({})), headers: r.headers};
  }
  async login(username, password) {
    const r = await this.json('/api/auth/login', {username, password});
    if (r.status === 200) this.user = r.body.user;
    return r;
  }
  upload(name, bytes) {
    return this.fetch('/api/files', {method: 'POST', headers: {'X-File-Name': encodeURIComponent(name), 'Content-Type': 'application/octet-stream'}, body: bytes})
      .then(async r => ({status: r.status, body: await r.json().catch(() => ({}))}));
  }
}

/** Login sebagai Admin awal, lalu buat akun FO, desain, operator, dan dua pelanggan (username unik per jalan). */
export async function bootstrap(base) {
  const tag = Date.now().toString(36);
  const adminUser = envValue('ADMIN_USERNAME') || 'admin', adminPass = envValue('ADMIN_PASSWORD');
  const admin = new Session(base);
  const r = await admin.login(adminUser, adminPass);
  if (r.status !== 200) throw new Error('Login admin gagal (' + r.status + '): atur ADMIN_PASSWORD di .env lalu jalankan npm run db:reset. ' + JSON.stringify(r.body));
  const pass = 'Sandi-' + tag + '-Uji1';
  const defs = {fo: ['fo', 'Front Office Uji'], design: ['designer', 'Desainer Uji'], operator: ['operator', 'Operator Uji'], c1: ['customer', 'Alya Putri'], c2: ['customer', 'Bima Santoso']};
  const S = {admin}, ID = {admin: admin.user.id}, USER = {};
  for (const [key, [role, name]] of Object.entries(defs)) {
    const username = `${key}.${tag}`;
    const c = await admin.json('/api/admin', {action: 'user.create', data: {username, password: pass, name, phone: '081234567890', role}});
    if (c.status !== 200) throw new Error('Gagal membuat ' + key + ': ' + JSON.stringify(c.body));
    const s = new Session(base);
    const l = await s.login(username, pass);
    if (l.status !== 200) throw new Error('Login ' + key + ' gagal: ' + JSON.stringify(l.body));
    S[key] = s; ID[key] = s.user.id; USER[key] = username;
  }
  return {S, ID, USER, pass, tag};
}
