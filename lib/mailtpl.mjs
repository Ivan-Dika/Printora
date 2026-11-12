// Templat pesan Printora. Satu data "notice" dirender menjadi tiga bentuk yang konsisten: email HTML, email teks (cadangan), dan WhatsApp.
// Fungsi murni tanpa efek samping sehingga mudah diuji.
//
// notice = {
//   heading,                       judul pesan, mis. "Desain siap ditinjau"
//   name,                          nama penerima
//   intro?,                        kalimat pembuka
//   order?: {id, title},           penanda pesanan
//   lines?: string[],              poin-poin pembaruan
//   details?: [label, value][],    rincian (tabel)
//   credentials?: {username, password},
//   files?: {name, note?}[],       berkas yang dilampirkan / tersedia di Ruang Kerja
//   cta?: {label, url} | null,     tombol tautan
//   footer?,                       catatan kecil di bawah
// }
const C = { navy: '#0f2347', blue: '#007bff', blueDark: '#0056d2', paper: '#f3f8ff', line: '#dbe6f5', muted: '#5b6b86', white: '#ffffff' };
const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";

export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tautan hanya http(s) agar tidak menjadi vektor skema berbahaya. */
const safeUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');

export function renderHtml(n, opt = {}) {
  const cta = n.cta && safeUrl(n.cta.url) ? n.cta : null;
  const rows = (n.details || []).map(([k, v]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:13px;width:42%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.navy};font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(v)}</td></tr>`).join('');
  const lines = (n.lines || []).map((l) =>
    `<tr><td style="padding:5px 12px 5px 0;vertical-align:top;color:${C.blue};font-size:16px;line-height:20px">&#9679;</td><td style="padding:5px 0;color:${C.navy};font-size:15px;line-height:22px">${escapeHtml(l)}</td></tr>`).join('');
  const files = (n.files || []).map((f) =>
    `<tr><td style="padding:6px 0;color:${C.navy};font-size:14px"><span style="display:inline-block;background:${C.paper};border:1px solid ${C.line};border-radius:6px;padding:6px 10px">&#128206; ${escapeHtml(f.name)}${f.note ? ` <span style="color:${C.muted};font-size:12px">${escapeHtml(f.note)}</span>` : ''}</span></td></tr>`).join('');
  const cred = n.credentials
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:${C.paper};border:1px dashed ${C.blue};border-radius:8px"><tr><td style="padding:14px 16px;font-family:${FONT}"><div style="font-size:12px;letter-spacing:1px;color:${C.blueDark};font-weight:700">AKSES MASUK RUANG KERJA</div><div style="font-size:14px;color:${C.navy};margin-top:8px">Username: <b style="font-family:Consolas,monospace">${escapeHtml(n.credentials.username)}</b></div><div style="font-size:14px;color:${C.navy};margin-top:4px">Kata sandi sementara: <b style="font-family:Consolas,monospace">${escapeHtml(n.credentials.password)}</b></div><div style="font-size:12px;color:${C.muted};margin-top:8px">Ganti kata sandi saat pertama masuk. Jangan bagikan pesan ini.</div></td></tr></table>`
    : '';
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px"><tr><td style="background:${C.blue};border-radius:8px"><a href="${escapeHtml(safeUrl(cta.url))}" style="display:inline-block;padding:13px 24px;color:${C.white};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(cta.label)}</a></td></tr></table>`
    : '';
  const orderBadge = n.order
    ? `<div style="margin:0 0 14px"><span style="display:inline-block;background:${C.navy};color:${C.white};font-size:12px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:5px">${escapeHtml(n.order.id)}</span> <span style="color:${C.navy};font-size:15px;font-weight:600;margin-left:6px">${escapeHtml(n.order.title)}</span></div>`
    : '';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(n.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(n.intro || n.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.white};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
<tr><td style="background:${C.navy};padding:22px 28px;font-family:${FONT}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${opt.logoSrc ? `<img src="${escapeHtml(opt.logoSrc)}" width="38" height="38" alt="" style="display:inline-block;width:38px;height:38px;border-radius:9px;background:#fff;vertical-align:middle">` : `<span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:${C.blue};color:${C.white};font-weight:800;font-size:18px;border-radius:8px;vertical-align:middle">P</span>`} <span style="color:${C.white};font-size:20px;font-weight:700;letter-spacing:-.3px;vertical-align:middle;margin-left:8px">Printora</span></td><td align="right" style="color:#9db4dc;font-size:12px;letter-spacing:1.5px">PERCETAKAN</td></tr></table></td></tr>
<tr><td style="height:4px;background:${C.blue};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:${FONT}">
<h1 style="margin:0 0 6px;font-size:22px;line-height:28px;color:${C.navy};letter-spacing:-.4px">${escapeHtml(n.heading)}</h1>
<p style="margin:0 0 18px;color:${C.muted};font-size:15px;line-height:23px">Halo <b style="color:${C.navy}">${escapeHtml(n.name)}</b>${n.intro ? ', ' + escapeHtml(n.intro) : ','}</p>
${orderBadge}
${lines ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px">${lines}</table>` : ''}
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-top:1px solid ${C.line}">${rows}</table>` : ''}
${files ? `<div style="margin:18px 0 0;font-size:12px;letter-spacing:1px;color:${C.blueDark};font-weight:700">BERKAS</div><table role="presentation" cellpadding="0" cellspacing="0">${files}</table>` : ''}
${cred}${button}
</td></tr>
<tr><td style="padding:22px 28px 26px;font-family:${FONT}"><div style="border-top:1px solid ${C.line};padding-top:16px;color:${C.muted};font-size:12px;line-height:19px">${escapeHtml(n.footer || 'Pesan otomatis dari Printora. Mohon tidak membalas email ini.')}</div></td></tr>
</table></td></tr></table></body></html>`;
}

/** Email teks polos: cadangan untuk klien tanpa HTML. */
export function renderPlain(n) {
  const out = [n.heading, '', `Halo ${n.name}${n.intro ? ', ' + n.intro : ','}`];
  if (n.order) out.push('', `${n.order.id} - ${n.order.title}`);
  if ((n.lines || []).length) out.push('', ...n.lines.map((l) => '- ' + l));
  if ((n.details || []).length) out.push('', ...n.details.map(([k, v]) => `${k}: ${v}`));
  if ((n.files || []).length) out.push('', 'Berkas:', ...n.files.map((f) => '- ' + f.name + (f.note ? ` (${f.note})` : '')));
  if (n.credentials) out.push('', `Username: ${n.credentials.username}`, `Kata sandi sementara: ${n.credentials.password}`, '(Ganti kata sandi saat pertama masuk. Jangan bagikan pesan ini.)');
  if (n.cta && safeUrl(n.cta.url)) out.push('', `${n.cta.label}: ${n.cta.url}`);
  out.push('', n.footer || 'Pesan otomatis dari Printora.');
  return out.join('\n');
}

/**
 * Format WhatsApp: judul tebal, nama tebal, poin berbutir, rincian "Label: nilai", tautan di baris sendiri, catatan miring.
 * Memakai *tebal* dan _miring_ milik WhatsApp.
 */
export function renderWhatsApp(n) {
  const wa = (s) => String(s ?? '').replace(/[*_~`]/g, '');
  const out = [`*Printora* | ${wa(n.heading)}`, '', `Halo *${wa(n.name)}*${n.intro ? ', ' + wa(n.intro) : ','}`];
  if (n.order) out.push('', `*${wa(n.order.id)}* - ${wa(n.order.title)}`);
  if ((n.lines || []).length) out.push('', ...n.lines.map((l) => '- ' + wa(l)));
  if ((n.details || []).length) out.push('', ...n.details.map(([k, v]) => `${wa(k)}: *${wa(v)}*`));
  if ((n.files || []).length) out.push('', 'Berkas tersedia di Ruang Kerja:', ...n.files.map((f) => '- ' + wa(f.name)));
  if (n.credentials) out.push('', 'Akses masuk Ruang Kerja:', `Username: ${n.credentials.username}`, `Kata sandi sementara: ${n.credentials.password}`, '_Ganti kata sandi saat pertama masuk. Jangan bagikan pesan ini._');
  if (n.cta && safeUrl(n.cta.url)) out.push('', `Detail di Ruang Kerja: ${n.cta.url}`);
  else if (n.cta) out.push('', 'Detail dapat dilihat di Ruang Kerja (menu Masuk di situs Printora).');
  out.push('', `_${wa(n.footer || 'Pesan otomatis dari Printora.')}_`);
  return out.join('\n');
}
