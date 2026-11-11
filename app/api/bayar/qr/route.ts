import {fail, requireUser} from '../../../../lib/api';
import {qrSvg} from '../../../../lib/pay';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await requireUser(req, ['customer']);
    const url = new URL(req.url);
    const svg = await qrSvg(user, url.searchParams.get('id') || '', url.origin);
    return new Response(svg, {headers: {'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});
  } catch (e) { return fail(e); }
}
