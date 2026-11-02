import type {ReactElement} from 'react';

/** Pemisah kecil antarinformasi (pengganti karakter titik tengah). */
export const Sep = () => <i className="sep" aria-hidden="true"/>;

export type SampleKind = 'banner' | 'sticker' | 'card' | 'brochure' | 'invite' | 'box' | 'plain';

/** Jenis contoh cetak menurut nama produk; produk baru dari Admin memakai lembar polos. */
export function sampleKind(name: string): SampleKind {
  const n = name.toLowerCase();
  if (/banner|spanduk|baliho|x-?banner/.test(n)) return 'banner';
  if (/stiker|sticker|label/.test(n)) return 'sticker';
  if (/kartu nama|id card|kartu pengenal/.test(n)) return 'card';
  if (/brosur|poster|flyer|leaflet|menu/.test(n)) return 'brochure';
  if (/undangan|kartu ucapan/.test(n)) return 'invite';
  if (/kemasan|box|dus|paket/.test(n)) return 'box';
  return 'plain';
}

const INK = '#171717', ORANGE = '#1E88FF', SOFT = '#e9e4dc';
const Lines = ({x, y, w, n = 3, c = '#c9c3b8'}: {x: number; y: number; w: number; n?: number; c?: string}) =>
  <>{Array.from({length: n}, (_, i) => <rect key={i} x={x} y={y + i * 7} width={i === n - 1 ? w * 0.6 : w} height="3" rx="1.5" fill={c}/>)}</>;

const art: Record<SampleKind, () => ReactElement> = {
  banner: () => <>
    <rect x="30" y="22" width="180" height="92" rx="3" fill="#fff" stroke="#00000022"/>
    <rect x="30" y="22" width="180" height="92" rx="3" fill={ORANGE}/>
    <circle cx="68" cy="68" r="26" fill={INK}/><circle cx="68" cy="68" r="14" fill="#fff"/>
    <rect x="104" y="48" width="86" height="9" rx="2" fill="#fff"/><rect x="104" y="63" width="64" height="9" rx="2" fill="#fff" opacity=".85"/>
    <rect x="104" y="84" width="44" height="12" rx="6" fill={INK}/>
    {[38, 72, 106, 140, 174, 202].map((x) => <circle key={x} cx={x} cy="28" r="2" fill="#fff" stroke="#0003"/>)}
    {[38, 72, 106, 140, 174, 202].map((x) => <circle key={x + 'b'} cx={x} cy="108" r="2" fill="#fff" stroke="#0003"/>)}
    <rect x="62" y="114" width="3" height="22" fill="#8a8a8a"/><rect x="175" y="114" width="3" height="22" fill="#8a8a8a"/>
  </>,
  sticker: () => <>
    <rect x="22" y="18" width="196" height="114" rx="8" fill="#fff" stroke="#00000018"/>
    <circle cx="68" cy="58" r="30" fill="#2f9e5b" stroke="#fff" strokeWidth="4"/>
    <path d="M68 40c10 6 14 14 6 26-4 6-10 8-12 4-4-8-2-22 6-30z" fill="#fff"/>
    <rect x="112" y="30" width="88" height="56" rx="10" fill={ORANGE} stroke="#fff" strokeWidth="4"/>
    <rect x="122" y="44" width="52" height="7" rx="2" fill="#fff"/><rect x="122" y="57" width="36" height="7" rx="2" fill="#fff" opacity=".8"/>
    <rect x="34" y="96" width="62" height="26" rx="13" fill={INK}/><rect x="46" y="106" width="38" height="6" rx="2" fill="#fff"/>
    <rect x="108" y="98" width="38" height="24" rx="4" fill="#2864d8" stroke="#fff" strokeWidth="3"/>
    <circle cx="176" cy="110" r="14" fill="#e0457b" stroke="#fff" strokeWidth="3"/>
  </>,
  card: () => <>
    <g transform="rotate(-6 100 78)"><rect x="40" y="38" width="130" height="78" rx="4" fill="#fff" stroke="#00000022"/>
      <rect x="40" y="38" width="130" height="78" rx="4" fill="#fff"/><rect x="40" y="38" width="130" height="14" rx="4" fill={INK}/>
      <circle cx="60" cy="76" r="10" fill={ORANGE}/><Lines x={78} y={70} w={70} n={3}/><Lines x={52} y={96} w={60} n={2}/></g>
    <g transform="rotate(5 150 88)"><rect x="96" y="54" width="130" height="78" rx="4" fill={INK}/>
      <rect x="112" y="72" width="26" height="26" rx="6" fill={ORANGE}/><rect x="146" y="76" width="62" height="6" rx="2" fill="#fff"/><rect x="146" y="88" width="42" height="5" rx="2" fill="#ffffff88"/>
      <rect x="112" y="110" width="96" height="3" rx="1.5" fill="#ffffff55"/></g>
  </>,
  brochure: () => <>
    <rect x="30" y="16" width="86" height="120" rx="3" fill="#fff" stroke="#00000022"/>
    <rect x="30" y="16" width="86" height="54" rx="3" fill="#2864d8"/><circle cx="73" cy="43" r="16" fill="#ffffff33"/><circle cx="73" cy="43" r="8" fill="#fff"/>
    <rect x="40" y="80" width="56" height="8" rx="2" fill={INK}/><Lines x={40} y={96} w={66} n={4}/>
    <path d="M124 22l52-6 6 116-58 4z" fill="#fff" stroke="#00000022"/>
    <path d="M128 28l44-5 2 40-44 4z" fill={ORANGE}/><Lines x={132} y={74} w={44} n={5}/>
    <rect x="186" y="30" width="30" height="92" rx="2" fill="#fff" stroke="#00000022"/><rect x="186" y="30" width="30" height="30" rx="2" fill="#e0457b"/><Lines x={190} y={68} w={22} n={4}/>
  </>,
  invite: () => <>
    <rect x="36" y="26" width="168" height="100" rx="4" fill="#fff" stroke="#00000022"/>
    <rect x="46" y="36" width="148" height="80" rx="2" fill="none" stroke={ORANGE} strokeWidth="1.5"/>
    <rect x="46" y="36" width="148" height="80" rx="2" fill="none" stroke="#a3204f" strokeWidth=".6" strokeDasharray="3 3" transform="translate(3 3) scale(.95)"/>
    <circle cx="120" cy="58" r="10" fill="none" stroke="#a3204f" strokeWidth="2"/><circle cx="126" cy="58" r="10" fill="none" stroke={ORANGE} strokeWidth="2"/>
    <rect x="86" y="76" width="68" height="7" rx="2" fill={INK}/><rect x="98" y="88" width="44" height="4" rx="2" fill="#a3204f"/><Lines x={92} y={98} w={56} n={2}/>
  </>,
  box: () => <>
    <path d="M70 52l50-20 50 20v56l-50 20-50-20z" fill="#d9a066"/>
    <path d="M70 52l50 20v56L70 108z" fill="#c68a4d"/><path d="M170 52l-50 20v56l50-20z" fill="#e4b27c"/>
    <path d="M70 52l50-20 50 20-50 20z" fill="#efc896"/>
    <circle cx="146" cy="92" r="13" fill="#fff"/><circle cx="146" cy="92" r="7" fill={ORANGE}/>
    <rect x="86" y="84" width="22" height="5" rx="2" fill="#fff" transform="skewY(20)"/>
  </>,
  plain: () => <>
    <rect x="52" y="14" width="136" height="122" rx="3" fill="#fff" stroke="#00000022"/>
    <rect x="64" y="26" width="112" height="46" rx="2" fill={ORANGE} opacity=".9"/><Lines x={64} y={84} w={112} n={5}/>
  </>,
};

/** Gambar contoh media cetak. Tanpa teks; warna latar mengikuti nada kategori (--tone-bg). */
export function PrintSample({kind, className}: {kind: SampleKind; className?: string}) {
  const A = art[kind];
  return <svg className={'printsample ' + (className || '')} viewBox="0 0 240 150" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <g stroke="#17171755" strokeWidth=".8" fill="none"><path d="M8 4v8M4 8h8M232 4v8M228 8h8M8 138v8M4 142h8M232 138v8M228 142h8"/></g>
    <g fill={SOFT} opacity="0"><rect width="1" height="1"/></g>
    <g style={{filter: 'drop-shadow(0 4px 6px #17171722)'}}><A/></g>
    <g><rect x="196" y="140" width="6" height="6" fill="#00b7e6"/><rect x="204" y="140" width="6" height="6" fill="#e6007e"/><rect x="212" y="140" width="6" height="6" fill="#ffd400"/><rect x="220" y="140" width="6" height="6" fill="#171717"/></g>
  </svg>;
}

/** Kolase contoh cetak untuk hero etalase. */
export function PrintCollage() {
  return <div className="collage" aria-hidden="true">
    {(['banner', 'card', 'sticker', 'invite'] as SampleKind[]).map((k, i) => <div key={k} className={'collageitem c' + i + ' i' + i}><PrintSample kind={k}/></div>)}
  </div>;
}

/** Foto contoh produk (aset visual etalase). Produk tanpa foto khusus memakai gambar contoh vektor. */
export function productPhoto(name: string): string | null {
  const k = sampleKind(name);
  if (k === 'banner') return '/brand/produk/banner.webp';
  if (k === 'sticker') return '/brand/produk/stiker.webp';
  if (k === 'card') return '/brand/produk/kartu-nama.webp';
  if (k === 'invite') return '/brand/produk/undangan.webp';
  if (k === 'brochure') return /poster/i.test(name) ? '/brand/produk/brosur-modern.webp' : '/brand/produk/brosur-promo.webp';
  return null;
}

export function ProductPhoto({name}: {name: string}) {
  const src = productPhoto(name);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="productphoto" src={src} alt={name} loading="lazy" decoding="async"/> : <PrintSample kind={sampleKind(name)}/>;
}
