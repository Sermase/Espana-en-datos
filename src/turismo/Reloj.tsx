import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { nf } from '../graficos'
import { useInView, useWidth } from '../graficos/util'

type S = (number | null)[]
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const TAU = Math.PI * 2

/** Sector de corona entre dos radios: siempre los mismos comandos, para que motion pueda animar el trazado. */
function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(cx + Math.sin(a) * r).toFixed(2)} ${(cy - Math.cos(a) * r).toFixed(2)}`
  const R1 = Math.max(r1, r0 + 0.01)
  return `M${p(R1, a0)}A${R1.toFixed(2)} ${R1.toFixed(2)} 0 0 1 ${p(R1, a1)}L${p(r0, a1)}A${r0.toFixed(2)} ${r0.toFixed(2)} 0 0 0 ${p(r0, a0)}Z`
}

/**
 * El reloj del turismo: los doce meses del año alrededor de una esfera; cada gajo crece con las noches de hotel de ese
 * mes (por dentro, residentes en España; por fuera, extranjeros). Pasa año a año desde 1999 al verse y deja ver,
 * en línea discontinua, el año anterior. El área del gajo es proporcional a las noches.
 */
export function RelojTurismo({ meses, esp, ext, cEsp, cExt }: { meses: string[]; esp: S; ext: S; cEsp: string; cExt: string }) {
  const reduce = useReducedMotion()
  const años = useMemo(() => [...new Set(meses.map(m => m.slice(0, 4)))], [meses])
  const val = useMemo(() => {
    const o: Record<string, { e: (number | null)[]; x: (number | null)[] }> = {}
    meses.forEach((m, i) => { const a = m.slice(0, 4), k = +m.slice(5) - 1; o[a] ??= { e: Array(12).fill(null), x: Array(12).fill(null) }; o[a].e[k] = esp[i]; o[a].x[k] = ext[i] })
    return o
  }, [meses, esp, ext])
  const vmax = useMemo(() => Math.max(1, ...meses.map((_, i) => (esp[i] ?? 0) + (ext[i] ?? 0))), [meses, esp, ext])
  const [wref, W] = useWidth<HTMLDivElement>()
  const [vref, visto] = useInView<HTMLDivElement>()
  const [i, setI] = useState(reduce ? años.length - 1 : 0)
  const [play, setPlay] = useState(false), arrancado = useRef(false)
  const [hov, setHov] = useState<number | null>(null)
  useEffect(() => { if (visto && !reduce && !arrancado.current) { arrancado.current = true; setPlay(true) } }, [visto, reduce])
  useEffect(() => {
    if (!play) return
    if (i >= años.length - 1) { setPlay(false); return }
    const t = setTimeout(() => setI(i + 1), 750); return () => clearTimeout(t)
  }, [play, i, años.length])

  const a = años[i], v = val[a], prev = val[años[i - 1]]
  const S0 = Math.min(W, 460), cx = W / 2, cy = S0 / 2 + 4, r0 = S0 * 0.17, R = S0 * 0.44
  const rad = (x: number) => r0 + (R - r0) * Math.sqrt(Math.max(0, x) / vmax)
  const hueco = 0.035
  const mesesCon = v ? v.e.filter((x, k) => x != null || v.x[k] != null).length : 0
  const tot = v ? v.e.reduce<number>((s, x, k) => s + (x ?? 0) + (v.x[k] ?? 0), 0) : 0
  const totExt = v ? v.x.reduce<number>((s, x) => s + (x ?? 0), 0) : 0
  const pico = v ? v.e.map((x, k) => (x ?? 0) + (v.x[k] ?? 0)).reduce((b, x, k, l) => (x > l[b] ? k : b), 0) : 0
  const dur = reduce ? 0 : 0.6
  const mes = hov ?? pico, mE = v?.e[mes] ?? null, mX = v?.x[mes] ?? null
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left - cx, y = e.clientY - r.top - cy
    if (Math.hypot(x, y) < r0 * 0.8) return setHov(null)
    setHov(Math.floor((((Math.atan2(x, -y) + TAU) % TAU) / TAU) * 12))
  }
  return <figure className="reloj-tur" ref={vref} aria-label="Reloj del turismo: noches de hotel de cada mes, año a año">
    <div className="cr-ctl">
      <button onClick={() => { if (i >= años.length - 1) setI(0); setPlay(!play) }} aria-label={play ? 'Pausar' : 'Reproducir'}>{play ? <Pause size={15} /> : i >= años.length - 1 ? <RotateCcw size={15} /> : <Play size={15} />}</button>
      <input type="range" min={0} max={años.length - 1} value={i} onChange={e => { setPlay(false); setI(+e.target.value) }} aria-label="Año" />
      <span>{a}</span>
    </div>
    <div ref={wref} className="rt-lienzo" style={{ height: S0 + 8 }}>
      {W > 0 && v && <svg width={W} height={S0 + 8} role="img" onPointerMove={onMove} onPointerLeave={e => e.pointerType !== 'touch' && setHov(null)}
        aria-label={`${a}: ${nf(tot / 1e6, 1)} millones de noches de hotel, ${nf((totExt / (tot || 1)) * 100, 0)} % de extranjeros. ${MESES.map((m, k) => `${m}, ${nf(((v.e[k] ?? 0) + (v.x[k] ?? 0)) / 1e6, 1)} millones`).join('; ')}`}>
        {[0.25, 0.5, 1].map(f => <circle key={f} className="rt-guia" cx={cx} cy={cy} r={rad(vmax * f)} />)}
        <text className="rt-escala" x={cx} y={cy - rad(vmax) + 12} textAnchor="middle">{nf(vmax / 1e6, 0)} M</text>
        {MESES.map((m, k) => {
          const a0 = (k / 12) * TAU + hueco, a1 = ((k + 1) / 12) * TAU - hueco, e = v.e[k], x = v.x[k], rE = rad(e ?? 0), rT = rad((e ?? 0) + (x ?? 0))
          const pe = prev ? rad((prev.e[k] ?? 0) + (prev.x[k] ?? 0)) : null, am = (a0 + a1) / 2
          return <g key={m} className={hov === k ? 'is-hov' : ''}>
            <motion.path initial={false} animate={{ d: sector(cx, cy, r0, rE, a0, a1) }} transition={{ duration: dur, ease: 'easeInOut' }} style={{ fill: cEsp }} />
            <motion.path initial={false} animate={{ d: sector(cx, cy, rE, rT, a0, a1) }} transition={{ duration: dur, ease: 'easeInOut' }} style={{ fill: cExt }} />
            {pe != null && prev && (prev.e[k] != null) && <motion.path className="rt-prev" initial={false} animate={{ d: `M${cx + Math.sin(a0) * pe} ${cy - Math.cos(a0) * pe}A${pe} ${pe} 0 0 1 ${cx + Math.sin(a1) * pe} ${cy - Math.cos(a1) * pe}` }} transition={{ duration: dur }} />}
            <text className="rt-mes" x={cx + Math.sin(am) * (R + 13)} y={cy - Math.cos(am) * (R + 13) + 4} textAnchor="middle">{m.slice(0, 3)}</text>
          </g>
        })}
        <text className="rt-año" x={cx} y={cy - 2} textAnchor="middle">{a}</text>
        <text className="rt-tot" x={cx} y={cy + 17} textAnchor="middle">{nf(tot / 1e6, 1)} M noches</text>
      </svg>}
    </div>
    <ul className="rt-ley"><li><i style={{ background: cEsp }} />Residentes en España</li><li><i style={{ background: cExt }} />Residentes en el extranjero</li><li><i className="rt-ley-prev" />Año anterior</li></ul>
    <p className="rt-dato" role="status">
      {mesesCon < 12 && <>{a}, hasta {MESES[mesesCon - 1]}. </>}
      <b>{MESES[mes].replace(/^./, c => c.toUpperCase())} de {a}</b>{hov == null && ', el mes con más noches'}: {nf(((mE ?? 0) + (mX ?? 0)) / 1e6, 1)} millones de noches de hotel
      {mE != null && mX != null && <>, el {nf((mX / ((mE + mX) || 1)) * 100, 0)} % de extranjeros</>}.
      {hov == null && <> En todo el año, {nf((totExt / (tot || 1)) * 100, 0)} de cada 100 noches fueron de extranjeros.</>}
    </p>
  </figure>
}
