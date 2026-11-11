import {fail, json, sameOrigin} from '../../../../lib/api';
import {demoInfo, demoPay} from '../../../../lib/pay';

export const dynamic = 'force-dynamic';

// Pembayaran QRIS: dibuka dari ponsel tanpa login, dilindungi token acak 128-bit milik satu permintaan pembayaran.
export async function GET(req: Request) {
  try { return json(await demoInfo(new URL(req.url).searchParams.get('id') || '')); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const b = JSON.parse(await req.text());
    await demoPay(String(b.id || ''));
    return json(await demoInfo(String(b.id)));
  } catch (e) { return fail(e); }
}
