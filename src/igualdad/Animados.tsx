import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { nf } from '../graficos'
import { useInView, useWidth } from '../graficos/util'

const MUJ = '#c98cff', HOM = '#5fb8ff', ROJO = '#ff6b7a'
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const fechaDe = (dia: number, año: number) => new Date(Date.UTC(año, 0, 1) + (dia - 1) * 864e5).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/**
 * Reloj de la brecha: un año en forma de esfera. La aguja barre desde el 1 de enero hasta el día en que, con el sueldo
 * medio de una mujer, «se acaba» lo que cobra un hombre en todo el año; el tramo que queda se enciende en rojo: los días
 * que, en promedio, una mujer trabaja sin cobrar en comparación.
 */
export function RelojBrecha({ brecha, año, sub }: { brecha: number; año: number; sub?: string }) {
  const [ref, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const dias = Math.round(365 * (1 - brecha / 100)), gratis = 365 - dias
  const R = 118, C = 150, L = 2 * Math.PI * R, frac = dias / 365
  const [n, setN] = useState(reduce ? gratis : 0)
  useEffect(() => {
    if (!visto || reduce) return
    let raf = 0; const t0 = performance.now() + 1600
    const paso = (t: number) => { const f = Math.min(1, Math.max(0, (t - t0) / 900)); setN(Math.round(gratis * f)); if (f < 1) raf = requestAnimationFrame(paso) }
    raf = requestAnimationFrame(paso); return () => cancelAnimationFrame(raf)
  }, [visto, reduce, gratis])
  const ang = frac * 360
  const [giro, setGiro] = useState(reduce ? ang : 0)
  useEffect(() => {
    if (!visto || reduce) { if (reduce) setGiro(ang); return }
    let raf = 0; const t0 = performance.now()
    const paso = (t: number) => { const f = Math.min(1, (t - t0) / 1600), e = 1 - Math.pow(1 - f, 3); setGiro(ang * e); if (f < 1) raf = requestAnimationFrame(paso) }
    raf = requestAnimationFrame(paso); return () => cancelAnimationFrame(raf)
  }, [visto, reduce, ang])
  return <div className="relojb" ref={ref}>
    <svg viewBox="0 0 300 300" width="100%" style={{ aspectRatio: '1' }} role="img" aria-label={`Con la brecha salarial de ${nf(brecha, 1)} %, a partir del ${fechaDe(dias, año)} una mujer trabaja, en promedio, ${gratis} días sin cobrar en comparación con un hombre`}>
      <defs>
        <radialGradient id="rl-fondo"><stop offset="0%" stopColor="rgba(201,140,255,.12)" /><stop offset="100%" stopColor="rgba(201,140,255,0)" /></radialGradient>
        <filter id="rl-brillo"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <circle cx={C} cy={C} r={R + 24} fill="url(#rl-fondo)" />
      <circle cx={C} cy={C} r={R} className="rl-pista" />
      {MESES.map((m, i) => { const a = (i / 12) * 2 * Math.PI - Math.PI / 2, a2 = ((i + 0.5) / 12) * 2 * Math.PI - Math.PI / 2; return <g key={m}>
        <line x1={C + Math.cos(a) * (R - 10)} y1={C + Math.sin(a) * (R - 10)} x2={C + Math.cos(a) * (R + 10)} y2={C + Math.sin(a) * (R + 10)} className="rl-tic" />
        <text x={C + Math.cos(a2) * (R + 20)} y={C + Math.sin(a2) * (R + 20) + 3} textAnchor="middle" className="rl-mes">{m}</text>
      </g> })}
      {/* lo cobrado: barre de enero al día de la brecha */}
      <motion.circle cx={C} cy={C} r={R} className="rl-cobra" transform={`rotate(-90 ${C} ${C})`} strokeDasharray={L}
        initial={{ strokeDashoffset: L }} animate={visto ? { strokeDashoffset: L * (1 - frac) } : {}} transition={{ duration: reduce ? 0 : 1.6, ease: [0.3, 0.7, 0.2, 1] }} />
      {/* lo que no se cobra: se enciende al final */}
      <motion.circle cx={C} cy={C} r={R} className="rl-gratis" transform={`rotate(${-90 + ang} ${C} ${C})`} strokeDasharray={`${L * (1 - frac)} ${L}`}
        initial={{ opacity: 0 }} animate={visto ? { opacity: 1 } : {}} transition={{ delay: reduce ? 0 : 1.6, duration: 0.5 }} />
      <motion.circle cx={C} cy={C} r={R} className="rl-gratis rl-halo" filter="url(#rl-brillo)" transform={`rotate(${-90 + ang} ${C} ${C})`} strokeDasharray={`${L * (1 - frac)} ${L}`}
        initial={{ opacity: 0 }} animate={visto ? { opacity: reduce ? 0.6 : [0, 0.9, 0.35, 0.9] } : {}} transition={{ delay: reduce ? 0 : 1.6, duration: 2.4, repeat: reduce ? 0 : Infinity, repeatType: 'mirror' }} />
      {/* aguja */}
      <g transform={`rotate(${giro} ${C} ${C})`}>
        <line x1={C} y1={C} x2={C} y2={C - R + 6} className="rl-aguja" />
        <circle cx={C} cy={C - R} r={5} className="rl-punta" />
      </g>
      <circle cx={C} cy={C} r={4} className="rl-eje" />
      <text x={C} y={C + 34} textAnchor="middle" className="rl-n">{n}</text>
      <text x={C} y={C + 52} textAnchor="middle" className="rl-u">días sin cobrar</text>
    </svg>
    <p className="rl-pie">Desde el <b>{fechaDe(dias, año)}</b>{sub ? <>, {sub}</> : null}</p>
  </div>
}

/**
 * Cada 100 € que cobra un hombre: dos pilas de monedas que caen una a una. La de ellas se queda corta.
 */
export function Monedas({ mujer, hombre, etiqueta }: { mujer: number; hombre: number; etiqueta?: string }) {
  const [ref, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const r = mujer / hombre, N = 20, nM = Math.round(N * r), falta = N - nM
  const pila = (n: number, color: string, x: number, retraso: number) => Array.from({ length: n }, (_, i) => (
    <motion.ellipse key={i} cx={x} cy={196 - i * 8} rx={34} ry={7} fill={color} stroke="rgba(0,0,0,.45)" strokeWidth={1}
      initial={{ y: -220, opacity: 0 }} animate={visto ? { y: 0, opacity: 1 } : {}} transition={{ delay: reduce ? 0 : retraso + i * 0.06, duration: reduce ? 0 : 0.45, ease: [0.5, 0, 0.6, 1.4] }} />
  ))
  return <div className="monedas" ref={ref}>
    <svg viewBox="0 0 260 240" width="100%" style={{ aspectRatio: '260 / 240' }} role="img" aria-label={`Por cada 100 € que cobra un hombre, una mujer cobra ${nf(r * 100, 0)} €${etiqueta ? ` (${etiqueta})` : ''}`}>
      {pila(N, HOM, 70, 0)}
      {pila(nM, MUJ, 190, 0.3)}
      {Array.from({ length: falta }, (_, i) => <motion.ellipse key={'f' + i} cx={190} cy={196 - (nM + i) * 8} rx={34} ry={7} className="mn-hueco"
        initial={{ opacity: 0 }} animate={visto ? { opacity: [0, 1, 0.35] } : {}} transition={{ delay: reduce ? 0 : 1.9 + i * 0.08, duration: 1.2 }} />)}
      <text x={70} y={228} textAnchor="middle" className="mn-l">Hombres · 100 €</text>
      <text x={190} y={228} textAnchor="middle" className="mn-l">Mujeres · {nf(r * 100, 0)} €</text>
    </svg>
  </div>
}

export type Piso = { id: string; nombre: string; mujeres: number; total: number }
/**
 * Edificio de cristal: un piso por grupo de ocupación, de los empleos menos cualificados (abajo) a la dirección (arriba).
 * Cada piso se llena desde el centro con mujeres (izquierda) y hombres (derecha); la línea punteada marca su peso en el
 * empleo total. Por dentro suben puntos (mujeres) que rebotan al llegar al techo de cristal, sobre el piso de dirección.
 */
export function EdificioCristal({ pisos, media, titulo }: { pisos: Piso[]; media: number; titulo: string }) {
  const [wref, w] = useWidth<HTMLDivElement>()
  const [ref, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const estrecho = w < 600, lab = estrecho ? 0 : 230, alto = estrecho ? 52 : 40, gap = 6, techo = 26, top = estrecho ? 18 : 4
  const H = techo + pisos.length * (alto + gap) + 10, W0 = lab + 10, W1 = w - 12, ancho = W1 - W0, mid = W0 + ancho / 2
  const orden = [...pisos].reverse() // dirección arriba
  const puntos = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ x: 0.08 + ((i * 37) % 84) / 100, d: 2.6 + (i % 5) * 0.55, r: (i % 7) * 0.4 })), [])
  const [sel, setSel] = useState<string | null>(null), ps = pisos.find(p => p.id === sel)
  return <figure className="edificio" ref={ref} aria-label={titulo}>
    <div ref={wref}>
      {w > 0 && <svg width={w} height={H} role="img" aria-label={`${titulo}: ${pisos.map(p => `${p.nombre}, ${nf((p.mujeres / p.total) * 100, 0)} % mujeres`).join('; ')}`}>
        <defs>
          <linearGradient id="ed-cristal" x1="0" x2="1"><stop offset="0" stopColor="rgba(190,240,255,.05)" /><stop offset=".5" stopColor="rgba(190,240,255,.55)" /><stop offset="1" stopColor="rgba(190,240,255,.05)" /></linearGradient>
          <clipPath id="ed-dentro"><rect x={W0} y={techo} width={ancho} height={H - techo} /></clipPath>
        </defs>
        {/* techo de cristal con un brillo que lo recorre */}
        <rect x={W0 - 4} y={techo - 7} width={ancho + 8} height={5} rx={2} className="ed-techo" />
        {!reduce && <motion.rect y={techo - 8} height={7} width={ancho * 0.25} fill="url(#ed-cristal)" initial={{ x: W0 - ancho * 0.25 }} animate={visto ? { x: W1 } : {}} transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }} />}
        <text x={W1} y={techo - 12} textAnchor="end" className="ed-t">techo de cristal</text>
        {orden.map((p, i) => {
          const y = techo + i * (alto + gap), f = p.mujeres / p.total, xm = W0 + ancho * f
          const retraso = reduce ? 0 : (orden.length - 1 - i) * 0.14
          return <g key={p.id} className={`ed-g ${sel && sel !== p.id ? 'is-off' : ''}`} onClick={() => setSel(sel === p.id ? null : p.id)}>
            <rect x={W0} y={y} width={ancho} height={alto} className={`ed-piso ${sel === p.id ? 'is-sel' : ''}`} />
            <motion.rect y={y + top} height={alto - top - 4} fill={MUJ} rx={2} initial={{ x: mid, width: 0 }} animate={visto ? { x: W0, width: xm - W0 - 1 } : {}} transition={{ delay: retraso, duration: reduce ? 0 : 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
            <motion.rect y={y + top} height={alto - top - 4} fill={HOM} rx={2} initial={{ x: mid, width: 0 }} animate={visto ? { x: xm + 1, width: W1 - xm - 1 } : {}} transition={{ delay: retraso, duration: reduce ? 0 : 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
            <text x={W0 + 8} y={y + (alto + top) / 2 + 2} className="ed-pct">{nf(f * 100, 0)} %</text>
            <text x={W1 - 8} y={y + (alto + top) / 2 + 2} textAnchor="end" className="ed-pct">{nf(100 - f * 100, 0)} %</text>
            {estrecho ? <text x={W0 + 4} y={y + 13} className="ed-n ed-n-dentro">{p.nombre}</text> : <text x={lab} y={y + alto / 2 + 4} textAnchor="end" className="ed-n">{p.nombre}</text>}
          </g>
        })}
        <line x1={W0 + ancho * media} x2={W0 + ancho * media} y1={techo} y2={H - 6} className="ed-media" />
        <text x={W0 + ancho * media + 5} y={H - 2} className="ed-t">{nf(media * 100, 0)} % del empleo son mujeres</text>
        {!reduce && visto && <g clipPath="url(#ed-dentro)">{puntos.map((p, i) => (
          <motion.circle key={i} cx={W0 + ancho * p.x * 0.48} r={2.4} fill={MUJ} initial={{ cy: H }} animate={{ cy: [H, techo + 4, techo + 26, techo + 4] }}
            transition={{ duration: p.d, delay: p.r, repeat: Infinity, ease: ['easeIn', 'easeOut', 'easeIn'], times: [0, 0.62, 0.8, 1] }} opacity={0.75} />
        ))}</g>}
      </svg>}
    </div>
    <p className="g-toque" role="status">{ps ? <><b>{ps.nombre}</b>: {nf((ps.mujeres / ps.total) * 100, 0)} de cada 100 son mujeres, {nf(Math.abs(ps.mujeres / ps.total - media) * 100, 0)} puntos {ps.mujeres / ps.total < media ? 'por debajo' : 'por encima'} de su peso en el empleo.</> : 'Toca un piso para ver su dato.'}</p>
    <ul className="g-legend"><li><i style={{ background: MUJ, height: 8 }} />Mujeres</li><li><i style={{ background: HOM, height: 8 }} />Hombres</li></ul>
  </figure>
}

/**
 * Pesas: el sueldo de mujeres y de hombres en cada grupo, unidos por una barra. Los dos puntos salen juntos del sueldo
 * de ellas y el de ellos se aleja hasta su sitio; la barra, en rojo, es la brecha.
 */
export function Pesas({ filas, fmt, titulo }: { filas: { id: string; nombre: string; m: number; h: number }[]; fmt: (v: number) => string; titulo: string }) {
  const [wref, w] = useWidth<HTMLDivElement>()
  const [ref, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const estrecho = w < 600, lab = estrecho ? 0 : 220, fila = estrecho ? 46 : 34
  const max = Math.max(...filas.flatMap(f => [f.m, f.h])) * 1.05, x = (v: number) => lab + 12 + (v / max) * (w - lab - 70)
  const H = filas.length * fila + 8
  const [sel, setSel] = useState<string | null>(null), fs = filas.find(f => f.id === sel)
  return <figure className="pesas" ref={ref} aria-label={titulo}>
    <div ref={wref}>{w > 0 && <svg width={w} height={H} role="img" aria-label={`${titulo}: ${filas.map(f => `${f.nombre}, mujeres ${fmt(f.m)}, hombres ${fmt(f.h)}`).join('; ')}`}>
      {filas.map((f, i) => {
        const y = i * fila + (estrecho ? 30 : fila / 2 + 2), d = reduce ? 0 : 0.25 + i * 0.07, b = ((f.h - f.m) / f.h) * 100
        return <g key={f.id} className={`ps-g ${sel && sel !== f.id ? 'is-off' : ''}`} onClick={() => setSel(sel === f.id ? null : f.id)}>
          <rect x={0} y={y - fila / 2 - (estrecho ? 8 : 0)} width={w} height={fila} fill="transparent" />
          <text x={estrecho ? 0 : lab} y={estrecho ? y - 14 : y + 4} textAnchor={estrecho ? 'start' : 'end'} className="ps-n">{f.nombre}<tspan className="ps-b" dx={6}>{b > 0 ? `−${nf(b, 0)} %` : `+${nf(-b, 0)} %`}</tspan></text>
          <line x1={x(0)} x2={w - 50} y1={y} y2={y} className="ps-guia" />
          <motion.line y1={y} y2={y} stroke={b > 0 ? ROJO : '#3df5b0'} strokeWidth={3} strokeLinecap="round" initial={{ x1: x(f.m), x2: x(f.m) }} animate={visto ? { x1: x(Math.min(f.m, f.h)), x2: x(Math.max(f.m, f.h)) } : {}} transition={{ delay: d, duration: reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
          <motion.circle cy={y} r={6} fill={HOM} initial={{ cx: x(f.m) }} animate={visto ? { cx: x(f.h) } : {}} transition={{ delay: d, duration: reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}><title>Hombres: {fmt(f.h)}</title></motion.circle>
          <circle cx={x(f.m)} cy={y} r={6} fill={MUJ}><title>Mujeres: {fmt(f.m)}</title></circle>
        </g>
      })}
    </svg>}</div>
    <p className="g-toque" role="status">{fs ? <><b>{fs.nombre}</b>: ellas {fmt(fs.m)}, ellos {fmt(fs.h)}. {fs.h > fs.m ? `Ellas cobran un ${nf(((fs.h - fs.m) / fs.h) * 100, 1)} % menos.` : `Ellas cobran un ${nf(((fs.m - fs.h) / fs.h) * 100, 1)} % más.`}</> : 'Toca una fila para ver los dos sueldos.'}</p>
    <ul className="g-legend"><li><i style={{ background: MUJ, height: 8, borderRadius: 4 }} />Mujeres</li><li><i style={{ background: HOM, height: 8, borderRadius: 4 }} />Hombres</li><li><i style={{ background: ROJO, height: 3 }} />Brecha</li></ul>
    <details className="g-table"><summary>Ver como tabla</summary><table><thead><tr><th /><th>Mujeres</th><th>Hombres</th><th>Brecha</th></tr></thead><tbody>
      {filas.map(f => <tr key={f.id}><th scope="row">{f.nombre}</th><td>{fmt(f.m)}</td><td>{fmt(f.h)}</td><td>{nf(((f.h - f.m) / f.h) * 100, 1)} %</td></tr>)}
    </tbody></table></details>
  </figure>
}

/**
 * Memorial: una luz por cada mujer asesinada por su pareja o expareja, una fila por año. Las filas se encienden una tras
 * otra al llegar a la pantalla (de golpe si se pide menos movimiento). Al pasar por una fila se lee su año y su cifra.
 */
export function Memorial({ años, titulo }: { años: { año: number; n: number; parcial?: boolean }[]; titulo: string }) {
  const [wref, w] = useWidth<HTMLDivElement>()
  const [ref, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...años.map(a => a.n)), lab = 46, num = 34
  const paso = w ? Math.max(2.4, Math.min(11, (w - lab - num - 8) / max)) : 8, r = paso * 0.32, fila = Math.max(11, paso + 3)
  const H = años.length * fila + 6
  return <figure className="memorial" ref={ref} aria-label={titulo}>
    <div ref={wref}>{w > 0 && <svg width={w} height={H} role="img" aria-label={`${titulo}: ${años.map(a => `${a.año}, ${a.n}`).join('; ')}`} onPointerLeave={e => e.pointerType !== 'touch' && setHover(null)}>
      {años.map((a, i) => {
        const y = i * fila + fila / 2 + 2, on = hover == null || hover === a.año
        return <g key={a.año} onPointerEnter={() => setHover(a.año)} opacity={on ? 1 : 0.35} style={{ transition: 'opacity .2s' }}>
          <rect x={0} y={y - fila / 2} width={w} height={fila} fill="transparent" />
          <text x={lab - 8} y={y + 3.5} textAnchor="end" className="mm-a">{a.año}</text>
          {Array.from({ length: a.n }, (_, k) => (
            <motion.circle key={k} cx={lab + k * paso + paso / 2} cy={y} r={r} className="mm-luz"
              initial={{ opacity: 0, scale: 0.2 }} animate={visto ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: reduce ? 0 : i * 0.09 + k * 0.004, duration: reduce ? 0 : 0.35 }} />
          ))}
          <motion.text x={lab + a.n * paso + 6} y={y + 3.5} className="mm-n" initial={{ opacity: 0 }} animate={visto ? { opacity: 1 } : {}} transition={{ delay: reduce ? 0 : i * 0.09 + 0.3 }}>{a.n}{a.parcial ? '*' : ''}</motion.text>
        </g>
      })}
    </svg>}</div>
    <p className="g-toque" role="status">{hover != null ? (() => { const a = años.find(x => x.año === hover)!; return <><b>{a.año}</b>: {a.n} mujeres asesinadas por su pareja o expareja{a.parcial ? ' (año en curso)' : ''}.</> })() : 'Toca un año para leer su cifra.'}</p>
  </figure>
}

/** Cuadrícula de 100: se van encendiendo las casillas del grupo destacado. */
export function Cien({ pct, color, etiqueta, resto }: { pct: number; color: string; etiqueta: string; resto: string }) {
  const [ref, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const n = Math.round(pct)
  return <div className="cien" ref={ref}>
    <svg viewBox="0 0 110 110" width="100%" style={{ maxWidth: 220, aspectRatio: '1' }} role="img" aria-label={`${n} de cada 100 ${etiqueta}`}>
      {Array.from({ length: 100 }, (_, i) => { const x = (i % 10) * 11 + 1, y = Math.floor(i / 10) * 11 + 1, on = i < n
        return <motion.rect key={i} x={x} y={y} width={9} height={9} rx={2} fill={on ? color : 'rgba(255,255,255,.08)'}
          initial={{ opacity: on ? 0 : 1 }} animate={visto ? { opacity: 1 } : {}} transition={{ delay: reduce || !on ? 0 : i * 0.012, duration: 0.2 }} /> })}
    </svg>
    <p><b style={{ color }}>{n} de cada 100</b> {etiqueta}<br /><small>{resto}</small></p>
  </div>
}
