import {fail, json, sameOrigin, isSecure} from '../../../../lib/api';
import {clearedCookie, logout} from '../../../../lib/auth.mjs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    await logout(req);
    return json({ok: true}, 200, {'Set-Cookie': clearedCookie(isSecure(req))});
  } catch (e) { return fail(e); }
}
