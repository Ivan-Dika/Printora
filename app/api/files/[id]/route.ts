import fs from 'node:fs';
import {Readable} from 'node:stream';
import {fail, json, requireUser} from '../../../../lib/api';
import {kindOf} from '../../../../lib/files';
import {pool} from '../../../../lib/mysql.mjs';

export const dynamic = 'force-dynamic';

/** Unduh/pratinjau berkas. Hanya PNG/JPG/WebP/PDF yang terverifikasi ditampilkan inline; lainnya selalu diunduh. */
export async function GET(req: Request, ctx: {params: Promise<{id: string}>}) {
  try {
    const user = await requireUser(req);
    const {id} = await ctx.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({error: 'Berkas tidak ditemukan.'}, 404);
    const [rows] = await pool().query('SELECT name, mime, size, path, uploader FROM files WHERE id = ?', [id]);
    const f = (rows as {name: string; mime: string; size: number; path: string; uploader: string}[])[0];
    if (!f || !fs.existsSync(f.path)) return json({error: 'Berkas tidak ditemukan.'}, 404);
    // Akses: pengunggah, FO/Admin, atau pihak yang terkait dengan pesanan yang memuat berkas ini.
    if (f.uploader !== user.id && user.role !== 'fo' && user.role !== 'admin') {
      const [own] = await pool().query(
        `SELECT 1 FROM orders o WHERE (o.customer_id = ? OR o.designer_id = ? OR o.operator_id = ?)
         AND o.id IN (SELECT order_id FROM designs WHERE file_id = ? UNION SELECT order_id FROM attachments WHERE file_id = ?) LIMIT 1`, [user.id, user.id, user.id, id, id]);
      if (!(own as unknown[]).length) return json({error: 'Berkas tidak ditemukan.'}, 404);
    }
    const inline = !!kindOf(f.name)?.inline;
    const disposition = (inline ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(f.name);
    return new Response(Readable.toWeb(fs.createReadStream(f.path)) as unknown as ReadableStream, {headers: {
      'Content-Type': f.mime, 'Content-Length': String(f.size), 'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': f.mime === 'application/pdf' && inline ? "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'" : "default-src 'none'; sandbox", 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'private, max-age=3600',
    }});
  } catch (e) { return fail(e); }
}
