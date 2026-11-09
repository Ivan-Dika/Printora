export type Uploaded = {id: string; name: string; mime: string; size: number};

/** Unggah berkas besar (hingga 500 MB) sebagai body mentah ke /api/files dengan laporan kemajuan (XHR, bukan base64/JSON). */
export function uploadFile(file: File, onProgress: (percent: number) => void): Promise<Uploaded> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body: {error?: string} & Partial<Uploaded> = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* respons bukan JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.id) resolve(body as Uploaded);
      else reject(new Error(body.error || 'Gagal mengunggah berkas (' + xhr.status + ').'));
    };
    xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah. Coba lagi.'));
    xhr.send(file);
  });
}
