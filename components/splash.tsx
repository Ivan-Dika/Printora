'use client';
import {useEffect, useState} from 'react';
import {PrintoraMark} from './printora';

/** Layar muat penuh: logo berdenyut dengan bilah CMYK. Memudar saat `show` false, lalu dilepas dari DOM. */
export function Splash({show, label = 'Memuat…'}: {show: boolean; label?: string}) {
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    if (show) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), 450);
    return () => clearTimeout(t);
  }, [show]);
  if (!mounted) return null;
  return <div className={'splash' + (show ? '' : ' out')} role="status" aria-live="polite">
    <div className="splashbox"><span className="splashring"/><PrintoraMark size={72}/></div>
    <b>Printora</b><small>{label}</small>
    <span className="cmyk"><i/><i/><i/><i/></span>
  </div>;
}
