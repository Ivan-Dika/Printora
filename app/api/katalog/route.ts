import {fail, json} from '../../../lib/api';
import {activeCatalog} from '../../../lib/master.mjs';
export const dynamic = 'force-dynamic';

/** Katalog layanan aktif untuk etalase (publik, hanya baca). */
export async function GET() {
  try { return json({items: await activeCatalog()}); } catch (e) { return fail(e); }
}
