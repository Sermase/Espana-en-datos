import type { CSSProperties, ReactNode } from 'react'
import resumen from '../resumen.json'

/**
 * Micrográfico de cada tarjeta de tema: un dibujo pequeño que explica el dato de un vistazo (el anillo del agua
 * se llena hasta el % de los embalses, la batería de Coches hasta el % de enchufables). Sale de src/resumen.json.
 * Las animaciones son CSS: arrancan cuando la tarjeta entra en pantalla (.is-vista) y se quedan quietas con
 * reducir movimiento.
 */
const R = resumen as unknown as Record<string, Record<string, unknown>>
const n = (t: string, k: string) => Number(R[t]?.[k] ?? 0)
const par = (t: string, k: string) => (R[t]?.[k] as [string, number] | undefined)?.[1] ?? 0
const lim = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

export function Micro({ id, c }: { id: string; c: string }) {
  const S = (p: { children: ReactNode }) => <svg viewBox="0 0 96 76" className="micro" aria-hidden>{p.children}</svg>
  const barX = (x: number, y: number, w: number, h: number, fill: string, d = 0, op = 1, der = false) =>
    <rect x={x} y={y} width={Math.max(0, w)} height={h} rx={3} fill={fill} fillOpacity={op} className={der ? 'mi-x-der' : 'mi-x'} style={{ '--d': `${d}s` } as CSSProperties} />
  const fondo = (y: number, h = 9) => <rect x={10} y={y} width={76} height={h} rx={3} fill="rgba(255,255,255,.06)" />
  switch (id) {
    case 'poblacion': {
      const ws = [8, 15, 24, 32, 36, 34, 28, 20, 12]
      return <S>{ws.map((w, i) => <g key={i}>
        {barX(47 - w, 6 + i * 7.2, w, 4.8, '#60a5fa', i * .04, .72, true)}
        {barX(49, 6 + i * 7.2, w + (i < 3 ? 3 : 0), 4.8, c, i * .04, .88)}
      </g>)}</S>
    }
    case 'seguridad': return <S>
      <defs><linearGradient id="mi-rad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c} stopOpacity="0" /><stop offset="1" stopColor={c} stopOpacity=".45" /></linearGradient></defs>
      {[29, 19, 9].map(r => <circle key={r} cx="48" cy="38" r={r} fill="none" stroke={c} strokeOpacity=".2" />)}
      <g className="mi-radar"><path d="M48 38 L48 9 A29 29 0 0 1 73 23 Z" fill="url(#mi-rad)" /><line x1="48" y1="38" x2="48" y2="9" stroke={c} strokeWidth="1.4" /></g>
      <circle cx="62" cy="27" r="2.2" fill={c} /><circle cx="35" cy="48" r="1.8" fill={c} fillOpacity=".7" /><circle cx="48" cy="38" r="2.2" fill="#fff" />
    </S>
    case 'igualdad': {
      const m = Math.max(n('igualdad', 'brecha'), n('igualdad', 'ue'), 1) * 1.25, es = (n('igualdad', 'brecha') / m) * 76
      return <S>{fondo(20, 10)}{barX(10, 20, es, 10, c, .1)}{fondo(46, 10)}{barX(10, 46, (n('igualdad', 'ue') / m) * 76, 10, '#64748b', .22)}
        <text x="10" y="15" className="mi-t">España</text><text x="10" y="41" className="mi-t">UE</text></S>
    }
    case 'economia': {
      const v = [par('economia', 'pib'), par('economia', 'ipc'), par('economia', 'paro')], m = Math.max(...v.map(Math.abs), 1) * 1.15
      return <S>{v.map((x, i) => <g key={i}>{fondo(14 + i * 19)}{barX(10, 14 + i * 19, (Math.abs(x) / m) * 76, 9, c, .08 + i * .1, 1 - i * .2)}</g>)}</S>
    }
    case 'vivienda': return <S>
      <line x1="8" y1="64" x2="88" y2="64" stroke="rgba(255,255,255,.1)" />
      {[[14, 22, .3], [38, 33, .5], [64, 46, .75]].map(([x, h, o], i) => <rect key={i} x={x} y={64 - h} width={16 + i * 2} height={h} rx="2" fill={c} fillOpacity={o} className="mi-y" style={{ '--d': `${.06 + i * .09}s` } as CSSProperties} />)}
      <path d="M14 36 L44 24 L82 10 M74 9 L83 10 L79 18" fill="none" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mi-traza" />
    </S>
    case 'comercio': {
      const m = Math.max(n('comercio', 'exp'), n('comercio', 'imp'), 1)
      return <S>{barX(10, 20, (n('comercio', 'exp') / m) * 70, 11, c, .1)}{barX(10, 45, (n('comercio', 'imp') / m) * 70, 11, '#4f9cf9', .22, .85)}
        <text x="10" y="15" className="mi-t">vende</text><text x="10" y="40" className="mi-t">compra</text></S>
    }
    case 'hogares': {
      const a = lim(n('hogares', 'ahorro') / 100, 0, .5) * 78
      return <S>{barX(8, 31, 78 - a, 14, c, .1, .65)}{barX(86 - a, 31, a, 14, '#3df5b0', .25)}
        <text x="8" y="26" className="mi-t">gasta</text><text x="86" y="60" className="mi-t" textAnchor="end">ahorra</text></S>
    }
    case 'sanidad': {
      const u = ((R.sanidad?.ultimas as number[] | undefined) ?? []).slice(-12), m = n('sanidad', 'media') || 1, w = 84 / Math.max(1, u.length)
      const d = 'M6 46' + u.map((v, i) => { const x = 6 + i * w, h = lim(6 + (v / m - .85) * 110, 5, 34); return `H${x + w * .35}l${w * .12} 4l${w * .14} ${-h - 4}l${w * .16} ${h + 10}l${w * .1} -10H${x + w}` }).join('')
      return <S><path d={d} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" className="mi-ecg" pathLength={100} /><circle cx="90" cy="46" r="2.6" fill="#fff" className="mi-latido" /></S>
    }
    case 'turismo': return <S>
      {['M10 14 Q 34 10, 48 40', 'M86 14 Q 62 12, 48 40', 'M82 66 Q 62 60, 48 40'].map((d, i) => <g key={i}>
        <path id={`mi-tu${i}`} d={d} fill="none" stroke={c} strokeOpacity=".35" strokeWidth="1.3" />
        <circle r="2.4" fill={c} className="mi-viaje" style={{ offsetPath: `path('${d}')`, animationDelay: `${i * .8}s` } as CSSProperties} />
      </g>)}
      <circle cx="48" cy="40" r="8" fill={c} fillOpacity=".16" /><circle cx="48" cy="40" r="3.8" fill={c} />
    </S>
    case 'cuentas': {
      const m = Math.max(n('cuentas', 'gasto'), n('cuentas', 'ingreso'), 1), hi = (n('cuentas', 'ingreso') / m) * 50, hg = (n('cuentas', 'gasto') / m) * 50
      return <S><line x1="12" y1="64" x2="84" y2="64" stroke="rgba(255,255,255,.12)" />
        <rect x="20" y={64 - hi} width="22" height={hi} rx="3" fill={c} fillOpacity=".78" className="mi-y" style={{ '--d': '.1s' } as CSSProperties} />
        <rect x="54" y={64 - hg} width="22" height={hg} rx="3" fill="#ff7b7b" fillOpacity=".72" className="mi-y" style={{ '--d': '.22s' } as CSSProperties} />
        <text x="31" y="74" className="mi-t" textAnchor="middle">ingresa</text><text x="65" y="74" className="mi-t" textAnchor="middle">gasta</text></S>
    }
    case 'impuestos': return <S><line x1="8" y1="64" x2="88" y2="64" stroke="rgba(255,255,255,.1)" />
      {[18, 26, 34, 42, 52].map((h, i) => <rect key={i} x={12 + i * 15} y={64 - h} width="10" height={h} rx="2" fill={c} fillOpacity={.38 + i * .14} className="mi-y" style={{ '--d': `${.06 + i * .07}s` } as CSSProperties} />)}</S>
    case 'subvenciones': {
      const ns = [[16, 18], [80, 18], [12, 42], [84, 42], [24, 64], [72, 64]]
      return <S>{ns.map(([x, y], i) => <line key={i} x1="48" y1="38" x2={x} y2={y} stroke={c} strokeOpacity=".22" />)}
        <circle cx="48" cy="38" r="5" fill="none" stroke={c} className="mi-onda" />
        {ns.map(([x, y], i) => <circle key={`p${i}`} cx={x} cy={y} r="3" fill={c} fillOpacity=".75" />)}<circle cx="48" cy="38" r="5" fill={c} /></S>
    }
    case 'agua': {
      const f = lim(n('agua', 'a') / (n('agua', 'c') || 1)), r = 27, L = 2 * Math.PI * r, wy = 60 - 44 * f
      return <S>
        <defs><clipPath id="mi-agua"><circle cx="48" cy="38" r="22" /></clipPath></defs>
        <circle cx="48" cy="38" r={r} fill="none" stroke={c} strokeOpacity=".16" strokeWidth="4.5" />
        <g clipPath="url(#mi-agua)"><g className="mi-ola"><path d={`M 0 ${wy} Q 12 ${wy - 4}, 24 ${wy} T 48 ${wy} T 72 ${wy} T 96 ${wy} T 120 ${wy} T 144 ${wy} L 144 72 L 0 72 Z`} fill={c} fillOpacity=".34" /></g></g>
        <circle cx="48" cy="38" r={r} fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round" transform="rotate(-90 48 38)" strokeDasharray={L} className="mi-anillo" style={{ '--len': L, '--off': L * (1 - f) } as CSSProperties} />
      </S>
    }
    case 'aire': {
      const baja = n('aire', 'vs1990') < 0
      return <S><line x1="10" y1="24" x2="86" y2="24" stroke={c} strokeDasharray="3 3" strokeOpacity=".55" />
        {[[24, 54, 0], [44, 48, .9], [62, 56, 1.7]].map(([x, y, d], i) => <circle key={i} cx={x} cy={y} r="2.6" fill={c} fillOpacity=".6" className="mi-sube" style={{ animationDelay: `${d}s` }} />)}
        <path d={baja ? 'M78 24 V44 M73 39 L78 44 L83 39' : 'M78 44 V24 M73 29 L78 24 L83 29'} fill="none" stroke="#3df5b0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></S>
    }
    case 'energia': {
      const f = lim(n('energia', 'ren') / 100), r = 25, L = 2 * Math.PI * r
      return <S><circle cx="48" cy="38" r={r} fill="none" stroke={c} strokeOpacity=".16" strokeWidth="5.5" />
        <circle cx="48" cy="38" r={r} fill="none" stroke={c} strokeWidth="5.5" strokeLinecap="round" transform="rotate(-90 48 38)" strokeDasharray={L} className="mi-anillo" style={{ '--len': L, '--off': L * (1 - f) } as CSSProperties} />
        <path d="M50 28 L42 40 H48 L46 49 L54 37 H48 Z" fill={c} /></S>
    }
    case 'gasolineras': return <S>{Array.from({ length: 20 }, (_, i) => { const x = 14 + (i % 5) * 16, y = 14 + Math.floor(i / 5) * 15, bar = i === 3 || i === 11, car = i === 6 || i === 18
      return <circle key={i} cx={x} cy={y} r={bar ? 3.8 : 2.8} fill={bar ? '#3df5b0' : car ? c : '#64748b'} fillOpacity={bar ? 1 : car ? .85 : .42} className={bar ? 'mi-latido' : ''} /> })}</S>
    case 'coches': {
      const f = lim(n('coches', 'enchufables') / 100)
      return <S><rect x="10" y="23" width="68" height="30" rx="5" fill="none" stroke={c} strokeOpacity=".45" strokeWidth="1.8" />
        <rect x="79" y="31" width="5" height="14" rx="1.5" fill={c} fillOpacity=".5" />{barX(14, 27, 60 * f, 22, c, .15)}</S>
    }
    default: return <S><path d="M6 60 L20 52 L32 56 L46 40 L60 44 L74 28 L90 20" fill="none" stroke={c} strokeWidth="2" className="mi-traza" /></S>
  }
}
