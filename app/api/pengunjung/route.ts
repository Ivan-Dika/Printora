import {applyTransition, fail, json, load, requireUser, sameOrigin, write} from '../../../lib/api';
import type {State} from '../../../lib/domain';

export const dynamic = 'force-dynamic';

// Etalase pelanggan: hanya untuk akun berperan Pelanggan yang sudah masuk (sesi cookie).
function customerView(state: State, id: string) {
  const customer = state.users.find((u) => u.id === id);
  return {customer: customer ? {name: customer.name, phone: customer.phone} : null, orders: state.orders.filter((o) => o.customerId === id)};
}
export async function GET(req: Request) {
  try {
    const user = await requireUser(req, ['customer']);
    return json(customerView((await load()).state, user.id));
  } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({error: 'Permintaan tidak valid.'}, 403);
    const user = await requireUser(req, ['customer']);
    const raw = await req.text();
    if (raw.length > 12000) return json({error: 'Isian terlalu panjang.'}, 413);
    const body = JSON.parse(raw), id = user.id;
    const {state, extra} = await write({
      expectedRevision: null, uploader: id,
      fn: async (prev) => {
        if (body.action === 'create') {
          if (!/^[a-zA-Z0-9-]{16,64}$/.test(body.requestId || '')) throw Error('Silakan buka kembali formulir pesanan.');
          const dup = prev.orders.find((o) => o.customerId === id && o.requestId === body.requestId);
          if (dup) return {next: prev, extra: dup.id};
          const next = await applyTransition(prev, id, 'create', {title: body.title, spec: body.spec, qty: body.qty, mode: body.mode});
          next.orders[0].requestId = body.requestId;
          return {next, extra: next.orders[0].id};
        }
        if (body.action === 'attach') {
          if (!prev.orders.some((o) => o.id === body.orderId && o.customerId === id)) throw Object.assign(new Error('Pesanan tidak ditemukan.'), {status: 404});
          return {next: await applyTransition(prev, id, 'attach', {orderId: body.orderId, file: body.file, fileName: body.fileName}), extra: body.orderId};
        }
        if (body.action === 'revision' || body.action === 'approve') {
          const order = prev.orders.find((o) => o.id === body.orderId && o.customerId === id);
          const design = order?.designs.at(-1);
          if (!design || design.id !== body.designId || design.approved) throw Error('Versi desain berubah. Muat ulang pesanan untuk meninjau versi terbaru.');
          return {next: await applyTransition(prev, id, body.action, {orderId: body.orderId, note: body.note}), extra: body.orderId};
        }
        throw Object.assign(Error('Aksi pelanggan tidak tersedia.'), {status: 403});
      },
    });
    return json({...customerView(state, id), orderId: extra});
  } catch (e) { return fail(e); }
}
