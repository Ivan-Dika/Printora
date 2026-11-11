import {fail, json, requireUser, sameOrigin} from '../../../lib/api';
import {cancelRequest, confirmRequest, createRequest, listRequests} from '../../../lib/pay';

export const dynamic = 'force-dynamic';

/** Permintaan pembayaran: pelanggan membuat dan membatalkan; FO mengonfirmasi transfer atau tunai. */
export async function GET(req: Request) {
  try { return json(await listRequests(await requireUser(req, ['customer', 'fo']))); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const user = await requireUser(req, ['customer', 'fo']);
    const raw = await req.text();
    if (raw.length > 2000) return json({error: 'Isian terlalu panjang.'}, 413);
    const b = JSON.parse(raw);
    let id = '';
    if (b.action === 'create') id = await createRequest(user, b);
    else if (b.action === 'cancel') await cancelRequest(user, String(b.id));
    else if (b.action === 'confirm') await confirmRequest(user, String(b.id));
    else return json({error: 'Aksi tidak dikenal.'}, 400);
    return json({...(await listRequests(user)), id});
  } catch (e) { return fail(e); }
}
