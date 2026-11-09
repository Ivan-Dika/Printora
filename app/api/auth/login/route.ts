import {fail, json, sameOrigin, clientIp, isSecure} from '../../../../lib/api';
import {login, sessionCookie} from '../../../../lib/auth.mjs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const raw = await req.text();
    if (raw.length > 2000) return json({error: 'Isian terlalu panjang.'}, 413);
    const b = JSON.parse(raw);
    const {token, user} = await login(b.username, b.password, clientIp(req));
    return json({user}, 200, {'Set-Cookie': sessionCookie(token, isSecure(req))});
  } catch (e) { return fail(e); }
}
