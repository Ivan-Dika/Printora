import {fail, json} from '../../../../lib/api';
import {getSessionUser} from '../../../../lib/auth.mjs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try { return json({user: await getSessionUser(req)}); } catch (e) { return fail(e); }
}
