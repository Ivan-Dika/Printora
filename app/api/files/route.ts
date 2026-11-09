import fs from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import {finished} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {fail, json, requireUser, sameOrigin} from '../../../lib/api';
import {cleanName, kindOf} from '../../../lib/files';
import {MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, pool, removeStaleUploads, uploadDir} from '../../../lib/mysql.mjs';

export const dynamic = 'force-dynamic';

/**
 * Unggah berkas mentah sebagai aliran (streaming) hingga 500 MB: isi dikirim sebagai body permintaan,
 * ditulis bertahap ke disk (memori tetap kecil), nama lewat header X-File-Name (URL-encoded).
 */
export async function POST(req: Request) {
  const tooBig = () => json({error: `Ukuran berkas maksimal ${MAX_UPLOAD_MB} MB.`}, 413);
  let tmp = '';
  try {
    if (!sameOrigin(req)) return json({error: 'Origin tidak valid'}, 403);
    const uploader = (await requireUser(req, ['customer', 'fo', 'designer'])).id;
    const name = cleanName(decodeURIComponent(req.headers.get('x-file-name') || ''));
    const kind = name ? kindOf(name) : null;
    if (!kind) return json({error: 'Jenis berkas tidak didukung. Gunakan PNG, JPG, WebP, PDF, TIFF, ZIP, PSD, AI, EPS, atau CDR.'}, 415);
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > MAX_UPLOAD_BYTES) return tooBig();
    if (!req.body) return json({error: 'Berkas kosong.'}, 400);

    const id = randomUUID(), dir = uploadDir(), final = path.join(dir, id);
    fs.mkdirSync(dir, {recursive: true});
    tmp = final + '.part';
    const out = fs.createWriteStream(tmp);
    // Tanpa pendengar galat, penulisan yang tertunda setelah destroy() dapat mematikan seluruh proses server.
    let writeError: Error | null = null;
    out.on('error', (err) => { writeError = err; });
    let size = 0, head = Buffer.alloc(0);
    try {
      for await (const chunk of req.body as unknown as AsyncIterable<Uint8Array>) {
        if (writeError) throw writeError;
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) { out.destroy(); if (!out.closed) await once(out, 'close'); fs.rmSync(tmp, {force: true}); tmp = ''; return tooBig(); }
        if (head.length < 1024) head = Buffer.concat([head, Buffer.from(chunk.subarray(0, 1024 - head.length))]);
        if (!out.write(chunk)) await once(out, 'drain');
      }
      out.end();
      await finished(out);
      if (writeError) throw writeError;
    } catch (e) { out.destroy(); if (!out.closed) await once(out, 'close').catch(() => {}); throw e; }
    if (size === 0) { fs.rmSync(tmp, {force: true}); tmp = ''; return json({error: 'Berkas kosong.'}, 400); }
    if (!kind.magic(head)) { fs.rmSync(tmp, {force: true}); tmp = ''; return json({error: 'Isi berkas tidak sesuai dengan jenisnya.'}, 415); }
    fs.renameSync(tmp, final);
    tmp = '';
    await pool().query('INSERT INTO files (id, name, mime, size, path, uploader) VALUES (?,?,?,?,?,?)', [id, name, kind.mime, size, final, uploader]);
    removeStaleUploads().catch(() => {});
    return json({id, name, mime: kind.mime, size}, 201);
  } catch (e) {
    if (tmp) fs.rmSync(tmp, {force: true});
    return fail(e);
  }
}
