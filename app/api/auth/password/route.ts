import {fail, json, requireUser, sameOrigin} from '../../../../lib/api';
import {changePassword} from '../../../../lib/auth.mjs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const user = await requireUser(req);
    const raw = await req.text();
    if (raw.length > 2000) return json({error: 'Isian terlalu panjang.'}, 413);
    const b = JSON.parse(raw);
    await changePassword(req, user, b.current, b.next);
    return json({ok: true});
  } catch (e) { return fail(e); }
}
