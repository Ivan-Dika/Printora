import {Fragment} from 'react';
import {ChevronRight, Lock, Flag} from 'lucide-react';
import {ADMIN_TASKS, FAQ, PHASES, STEPS, roleName} from '../lib/flow';
import {roles, type Order, type Role} from '../lib/domain';
import {BRAND} from '../lib/brand';

/** Lambang merek dari berkas aset (lihat lib/brand.ts); ganti berkasnya untuk mengubah logo. */
export function PrintoraMark({size = 24}: {size?: number}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="brandlogo" src={BRAND.logoMark} width={size} height={size} alt="" aria-hidden="true"/>;
}

/** Alur ringkas tujuh fase; bila `orders` diberikan, tampil jumlah pesanan per fase. */
export function Pipeline({orders, role}: {orders?: Order[]; role: Role}) {
  return <div className="pipeline" aria-label="Alur pesanan Printora">{PHASES.map((p, i) => {
    const count = orders?.filter(o => p.test(o)).length;
    return <div key={p.key} className={p.roles.includes(role) ? 'mine' : ''}>
      <span className="num">{i + 1}</span><b>{p.title}</b><small>{p.who}</small><small>{p.desc}</small>
      {count !== undefined && <span className="count">{count} pesanan</span>}
    </div>;
  })}</div>;
}

export function Guide({role}: {role: Role}) {
  const mine = STEPS.filter(s => s.role === role);
  const Step = ({s}: {s: typeof STEPS[number]}) => <div className={s.role === role ? 'mine' : ''}>
    <span className="n">{s.n}</span>
    <div><b><span className={'rolechip' + (s.role === role ? ' o' : '')}>{roleName(s.role)}</span>{s.title}</b>
      <p>{s.detail}</p>
      <div className="meta"><span className="path"><b>Menu</b>{s.where.split(' → ').map((x, i) => <Fragment key={i}>{i > 0 && <ChevronRight size={12}/>}{x}</Fragment>)}</span>{s.gate && <span className="gate"><Lock size={12}/>{s.gate}</span>}<span className="after"><Flag size={12}/>{s.after}</span></div></div>
  </div>;
  return <>
    <div className="pagehead"><div><h1>Panduan</h1><p>Alur pesanan dan tugas {roles[role]}.</p></div></div>
    <section className="panel"><h2>Alur pesanan</h2><p className="muted">Tujuh fase. Fase yang melibatkan peran Anda ({roles[role]}) diberi bingkai biru.</p><div style={{marginTop: 16}}><Pipeline role={role}/></div></section>
    <section className="panel" style={{marginTop: 22}}><h2>Tugas Anda sebagai {roles[role]}</h2>{role === 'admin' ? <><p className="muted">{ADMIN_TASKS.length} tugas pengelolaan aplikasi.</p><div className="howto">{ADMIN_TASKS.map(([t, w, d], i) => <div key={t} className="mine"><span className="n">{i + 1}</span><div><b>{t}</b><p>{d}</p><div className="meta"><span>Menu: {w}</span></div></div></div>)}</div></> : <><p className="muted">{mine.length} langkah. Sistem hanya mengizinkan Anda bertindak bila syaratnya terpenuhi.</p><div className="howto">{mine.map(s => <Step key={s.n} s={s}/>)}</div></>}</section>
    <section className="panel" style={{marginTop: 22}}><h2>Urutan lengkap dari awal sampai akhir</h2><p className="muted">Seluruh peran, berurutan. Langkah Anda berlatar biru.</p><div className="howto">{STEPS.map(s => <Step key={s.n} s={s}/>)}</div></section>
    <section className="panel" style={{marginTop: 22}}><h2>Pertanyaan umum</h2><div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
  </>;
}
