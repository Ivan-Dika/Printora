import {transition as domainTransition, visible, type Ctx, type Role, type State, type User} from './domain';
import {mutate, snapshot} from './mysql.mjs';
import {getSessionUser, type SessionUser} from './auth.mjs';
import {activeLists} from './master.mjs';
import {notifyStatusChanges} from './messaging.mjs';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {status, headers: {'Cache-Control': 'no-store', ...headers}});
export const fail = (e: unknown) => {
  const err = e as Error & {status?: number; code?: string};
  if (err.code && /^ER_|ECONNREFUSED|PROTOCOL/.test(err.code)) return json({error: 'Database tidak dapat dijangkau. Pastikan MySQL berjalan.'}, 503);
  return json({error: err.message || 'Terjadi kesalahan.'}, err.status || 400);
};
const httpError = (message: string, status: number) => Object.assign(new Error(message), {status});

/** Permintaan yang mengubah data harus berasal dari asal (origin) yang sama bila header Origin dikirim. */
/**
 * Cek CSRF: header Origin dari peramban harus berasal dari host yang sama dengan yang diminta. Yang dibandingkan hanya host
 * (bukan skema), karena di belakang proxy/tunnel HTTPS aplikasi menerima permintaan lewat http. Peramban tidak dapat memalsukan Origin.
 */
export const sameOrigin = (req: Request) => {
  const o = req.headers.get('origin');
  if (!o) return true;
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host).split(',')[0].trim().toLowerCase();
  try { return new URL(o).host.toLowerCase() === host; } catch { return false; }
};
export const isSecure = (req: Request) => req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:';
/** Entri paling kanan X-Forwarded-For: yang ditambahkan proxy tepercaya (Cloudflare). Entri kiri bisa dikarang klien, jadi tidak dipakai. */
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',').at(-1)!.trim() || 'lokal';

/** Pengguna dari cookie sesi; galat 401 bila belum masuk, 403 bila peran tidak diizinkan. */
export async function requireUser(req: Request, roles?: Role[]): Promise<SessionUser> {
  const u = await getSessionUser(req);
  if (!u) throw httpError('Silakan masuk terlebih dahulu.', 401);
  if (u.mustChange && req.method !== 'GET' && !/^\/api\/(auth|files|pengunjung)(\/|$)/.test(new URL(req.url).pathname)) throw httpError('Ganti kata sandi Anda terlebih dahulu.', 403);
  if (roles && !roles.includes(u.role as Role)) throw httpError('Aksi tidak tersedia untuk peran ini.', 403);
  return u;
}

export const load = () => snapshot();
/** Menyimpan perubahan; setelah berhasil (commit), pelanggan diberi tahu lewat WhatsApp/email bila status pesanannya berubah. */
export async function write(opts: Parameters<typeof mutate>[0]) {
  let seen: {prev: State; next: State} | null = null;
  const res = await mutate({...opts, fn: async (prev: State, conn: Parameters<typeof opts.fn>[1]) => {
    const out = await opts.fn(prev, conn);
    seen = {prev, next: (out as {next?: State}).next ?? (out as State)};
    return out;
  }});
  const s = seen as {prev: State; next: State} | null;
  if (s) void notifyStatusChanges(s.prev, s.next);
  return res;
}

/** Menjalankan aturan domain dengan daftar master aktif (metode pembayaran, saluran pemberitahuan). */
export async function applyTransition(prev: State, userId: string, action: string, data: unknown, extra: Ctx = {}) {
  return domainTransition(prev, userId, action, data, {...(await activeLists()), ...extra});
}

/** Pengguna yang boleh dilihat: FO dan Admin melihat semua; peran lain hanya diri sendiri dan pihak pada pesanan miliknya, tanpa telepon orang lain. */
function usersFor(state: State, u: User): User[] {
  if (u.role === 'fo' || u.role === 'admin') return state.users;
  const ids = new Set<string>([u.id]);
  for (const o of visible(state, u)) {
    [o.customerId, o.designerId, o.operatorId].forEach((id) => id && ids.add(id));
    [...o.history, ...o.payments.map((p) => ({by: p.by})), ...(o.issues || []), ...(o.notifications || [])].forEach((x) => x.by && ids.add(x.by));
  }
  return state.users.filter((x) => ids.has(x.id)).map((x) => (x.id === u.id ? x : {id: x.id, name: x.name, role: x.role, phone: ''}));
}

export function view(state: State, session: SessionUser) {
  const u = state.users.find((x) => x.id === session.id);
  if (!u) throw httpError('Akun tidak ditemukan.', 401);
  return {user: u, users: usersFor(state, u), orders: visible(state, u)};
}
