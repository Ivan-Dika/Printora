import {fail, json, requireUser, sameOrigin} from '../../../lib/api';
import {adminAct, adminOverview} from '../../../lib/master.mjs';
export const dynamic = 'force-dynamic';

/** Master data dan pengguna: hanya Admin Aplikasi. */
export async function GET(req: Request) {
  try { await requireUser(req, ['admin']); return json(await adminOverview()); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const admin = await requireUser(req, ['admin']);
    const raw = await req.text();
    if (raw.length > 5000) return json({error: 'Isian terlalu panjang.'}, 413);
    const b = JSON.parse(raw);
    await adminAct(admin, String(b.action), b.data || {});
    return json(await adminOverview());
  } catch (e) { return fail(e); }
}
