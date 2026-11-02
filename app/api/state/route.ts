import {applyTransition, fail, json, load, requireUser, sameOrigin, view, write} from '../../../lib/api';
import {activeLists} from '../../../lib/master.mjs';
export const dynamic = 'force-dynamic';

// Pengguna selalu berasal dari sesi (cookie), tidak pernah dari isi permintaan.
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const {state, revision} = await load();
    return json({...view(state, user), revision, master: await activeLists()});
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Origin tidak valid'}, 403);
    const user = await requireUser(req);
    const raw = await req.text();
    if (raw.length > 20000) return json({error: 'Isian terlalu besar. Berkas diunggah lewat /api/files.'}, 413);
    const b = JSON.parse(raw);
    if (!Number.isInteger(b.revision)) return json({error: 'Revisi tidak valid. Muat ulang halaman.'}, 400);
    const {state, revision} = await write({
      expectedRevision: b.revision, uploader: user.id,
      fn: (prev) => applyTransition(prev, user.id, String(b.action), b.data || {}),
    });
    return json({...view(state, user), revision, master: await activeLists()});
  } catch (e) { return fail(e); }
}
