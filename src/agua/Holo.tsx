import { memo, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { near, toDate, useHistory } from './history'
import type { River } from './rivers'
import { data, fmt, fmtPct, pct, status, type Reservoir } from './data'

type XY = [number, number]

/**
 * Holograma del embalse elegido: su silueta sobre una plataforma que gira,
 * el agua apilada en capas hasta el nivel actual, la presa en pie y,
 * si turbina, un haz de energía. Todo con transformaciones CSS 3D, sin WebGL.
 */
export const Holo = memo(function Holo({ r, shape, dam, ctx, size, x, y }: {
  r: Reservoir; shape: XY[][] | null; dam: XY | null; ctx: XY[][]; size: number; x: number; y: number
}) {
  const S = size, R = S / 2
  const p = pct(r)
  const hydro = r.ec > 0
  const low = p < 30
  const h = useHistory()
  const lastYear = useMemo(() => {
    const vals = h?.res[r.id]; if (!h || !vals) return null
    const v = near(h.rd, vals, new Date(toDate(data.meta.fecha).getTime() - 364 * 864e5))
    return v == null ? null : (v / r.c) * 100
  }, [h, r])

  const geo = useMemo(() => {
    // Silueta centrada y escalada para caber en el disco; se aligeran los puntos.
    let rings: XY[][]
    let damPt: XY
    let tx: (q: XY) => XY
    if (shape && shape.length) {
      const pts = shape.flat()
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const far = Math.max(...pts.map(([a, b]) => Math.hypot(a - cx, b - cy)), 1e-6)
      const k = (R * 0.8) / far
      tx = ([a, b]: XY): XY => [R + (a - cx) * k, R + (b - cy) * k]
      rings = shape.map(ring => {
        const out: XY[] = []
        for (const q of ring.map(tx)) { const l = out[out.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > S / 70) out.push(q) }
        return out
      }).filter(rg => rg.length > 2)
      damPt = dam ? tx(dam) : rings[0][0]
      const dd = Math.hypot(damPt[0] - R, damPt[1] - R)
      if (dd > R * 0.86) damPt = [R + (damPt[0] - R) * (R * 0.86 / dd), R + (damPt[1] - R) * (R * 0.86 / dd)]
    } else {
      // Sin silueta oficial: un vaso genérico, distinto para cada embalse.
      const seed = (r.id * 9301 + 49297) % 233280 / 233280 * Math.PI * 2
      const ring: XY[] = Array.from({ length: 72 }, (_, i) => {
        const t = (i / 72) * Math.PI * 2
        const rad = R * 0.5 * (1 + 0.22 * Math.sin(3 * t + seed) + 0.12 * Math.sin(5 * t + seed * 2))
        return [R + Math.cos(t) * rad, R + Math.sin(t) * rad * 0.8]
      })
      rings = [ring]
      damPt = ring[Math.round((seed / (Math.PI * 2)) * 71)]
      // Sin silueta, el entorno se escala por tamaño: un embalse grande ocupa más kilómetros.
      const far = 2 + Math.sqrt(r.c) * 0.3, k = (R * 0.5) / far, [dx, dy] = dam ?? [0, 0]
      tx = ([a, b]: XY): XY => [damPt[0] + (a - dx) * k, damPt[1] + (b - dy) * k]
    }
    // Los ríos que entran y salen, recortados al disco.
    const lim = R * 0.93
    const streams: string[] = []
    for (const l of ctx) {
      let run: XY[] = []
      const flush = () => { if (run.length > 1) streams.push('M' + run.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')); run = [] }
      for (const q of l) {
        const t = tx(q)
        if (Math.hypot(t[0] - R, t[1] - R) < lim) run.push(t); else flush()
      }
      flush()
    }
    const d = rings.map(rg => 'M' + rg.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z').join('')
    // La presa cierra el valle: va perpendicular a la línea que sube hacia el centro del vaso.
    const all = rings.flat()
    const gx = all.reduce((t, q) => t + q[0], 0) / all.length, gy = all.reduce((t, q) => t + q[1], 0) / all.length
    const ang = Math.atan2(gy - damPt[1], gx - damPt[0]) * 180 / Math.PI + 90
    return { d, damPt, ang, streams: streams.join('') }
  }, [shape, dam, ctx, S, R, r.id, r.c])

  const Hmax = S * 0.2
  const hw = Hmax * Math.max(0.04, Math.min(1, p / 100))
  const N = 4
  const damW = S * 0.13
  const tone = low ? 'is-low' : ''

  const Shape = ({ cls, z, i }: { cls: string; z: number; i?: number }) => (
    <svg className={`holo-layer ${cls}`} viewBox={`0 0 ${S} ${S}`} style={{ '--z': `${z}px`, '--i': i ?? 0 } as React.CSSProperties}>
      <path d={geo.d} />
    </svg>
  )

  return (
    <div className={`holo ${tone}`} style={{ left: x, top: y, width: S, height: S, marginLeft: -R, marginTop: -R }} aria-hidden>
      <div className="holo-stage">
        <svg className="holo-layer holo-disc" viewBox={`0 0 ${S} ${S}`}>
          <defs>
            <clipPath id="holo-clip"><circle cx={R} cy={R} r={R * 0.94} /></clipPath>
            <radialGradient id="holo-floor"><stop offset="0" stopColor="#3fe6ff" stopOpacity=".16" /><stop offset="1" stopColor="#3fe6ff" stopOpacity=".02" /></radialGradient>
          </defs>
          <circle cx={R} cy={R} r={R * 0.94} fill="url(#holo-floor)" />
          <g clipPath="url(#holo-clip)" className="holo-grid">
            {Array.from({ length: 9 }, (_, i) => { const v = (i + 1) * S / 10; return <g key={i}><line x1={v} y1={0} x2={v} y2={S} /><line x1={0} y1={v} x2={S} y2={v} /></g> })}
          </g>
          <circle cx={R} cy={R} r={R * 0.94} className="holo-rim" />
          <circle cx={R} cy={R} r={R * 0.62} className="holo-ring-soft" />
        </svg>
        <svg className="holo-layer holo-ticks" viewBox={`0 0 ${S} ${S}`}>
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} x1={R} y1={R * 0.02} x2={R} y2={i % 3 ? R * 0.045 : R * 0.075} transform={`rotate(${i * 10} ${R} ${R})`} />
          ))}
        </svg>
        {geo.streams && <svg className="holo-layer holo-streams" viewBox={`0 0 ${S} ${S}`}><path d={geo.streams} /></svg>}
        <Shape cls="holo-bed" z={0} />
        {Array.from({ length: N }, (_, i) => <Shape key={i} cls={`holo-water ${i === N - 1 ? 'is-top' : ''}`} z={(hw * (i + 1)) / N} i={i} />)}
        <Shape cls="holo-cap" z={Hmax} />
        {lastYear != null && <Shape cls="holo-ghost" z={Hmax * Math.max(0.04, Math.min(1, lastYear / 100))} />}
        <div className="holo-dam" style={{ left: geo.damPt[0] - damW / 2, top: geo.damPt[1] - Hmax * 1.08, width: damW, height: Hmax * 1.08, transform: `rotateZ(${geo.ang}deg) rotateX(-90deg)` }}>
          <i style={{ height: `${Math.min(100, p) * 0.92}%` }} />
        </div>
        {hydro && [0, 90].map(a => (
          <div key={a} className="holo-beam" style={{ left: geo.damPt[0] - 7, top: geo.damPt[1] - Hmax * 2.1, width: 14, height: Hmax * 2.1, transform: `rotateZ(${geo.ang + a}deg) rotateX(-90deg)` }} />
        ))}
      </div>
      <div className="holo-tag" style={{ top: R + S * 0.27 }}>
        <strong>{r.n}</strong>
        <span>{fmtPct(p)} · {fmt(r.a)} de {fmt(r.c)} hm³{hydro ? ' · central' : ''}</span>
        {lastYear != null && <em>hace un año: {fmtPct(lastYear)} <i className="ghost-key" /></em>}
        {!shape && <em>forma aproximada</em>}
      </div>
    </div>
  )
})

/**
 * Holograma del río: su trazado sobre la plataforma y, encima, una cortina de luz
 * con la altitud de cada tramo. Se dibuja a mano en SVG, girando cuadro a cuadro.
 */
export const RiverHolo = memo(function RiverHolo({ v, plan, size, x, y }: { v: River; plan: XY[]; size: number; x: number; y: number }) {
  const S = size, R = S / 2
  const reduce = useReducedMotion()
  const refs = useRef<Record<string, SVGElement | null>>({})
  const model = useMemo(() => {
    // Trazado centrado y escalado al disco, remuestreado a pasos iguales.
    const xs = plan.map(q => q[0]), ys = plan.map(q => q[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const far = Math.max(...plan.map(([a, b]) => Math.hypot(a - cx, b - cy)), 1e-6)
    const k = (R * 0.82) / far
    const pts = plan.map(([a, b]) => [(a - cx) * k, (b - cy) * k] as XY)
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    const total = cum[cum.length - 1] || 1, N = 150
    const maxD = v.prof[v.prof.length - 1][0] || 1
    const zAt = (f: number) => {
      const d = f * maxD; let i = v.prof.findIndex(p => p[0] >= d); if (i <= 0) return v.prof[0][1]
      const [d0, z0] = v.prof[i - 1], [d1, z1] = v.prof[i]; return z0 + (z1 - z0) * ((d - d0) / (d1 - d0 || 1))
    }
    const zScale = (S * 0.5) / 2600 // misma escala vertical para todos los ríos: el Genil se ve más alto que el Ebro
    const samples: [number, number, number][] = []
    let j = 0
    for (let n = 0; n <= N; n++) {
      const t = (n / N) * total
      while (j < cum.length - 2 && cum[j + 1] < t) j++
      const f = (t - cum[j]) / (cum[j + 1] - cum[j] || 1)
      const [ax, ay] = pts[j], [bx, by] = pts[Math.min(j + 1, pts.length - 1)]
      samples.push([ax + (bx - ax) * f, ay + (by - ay) * f, Math.max(S * 0.012, zAt(n / N) * zScale)])
    }
    const res = v.res.filter(([, d]) => d != null).map(([id, d]) => {
      const r = data.reservoirs.find(q => q.id === id); if (!r) return null
      return { r, n: Math.round((d! / maxD) * N) }
    }).filter(Boolean) as { r: Reservoir; n: number }[]
    return { samples, res, top: v.prof[0][1], bottom: v.prof[v.prof.length - 1][1] }
  }, [plan, v, S, R])

  useEffect(() => {
    const ct = Math.cos((62 * Math.PI) / 180), st = Math.sin((62 * Math.PI) / 180)
    const { samples, res } = model
    let raf = 0, a = -0.6
    let last = performance.now()
    const P = (px: number, py: number, pz: number, c: number, s: number): XY => {
      const xr = px * c - py * s, yr = px * s + py * c
      return [R + xr, R + yr * ct - pz * st]
    }
    const f1 = (q: XY) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)
    const draw = (now: number) => {
      if (!reduce) a += ((now - last) / 1000) * ((Math.PI * 2) / 46)
      last = now
      const c = Math.cos(a), s = Math.sin(a)
      const floor = samples.map(([px, py]) => P(px, py, 0, c, s))
      const top = samples.map(([px, py, pz]) => P(px, py, pz, c, s))
      const set = (k: string, attr: string, val: string) => refs.current[k]?.setAttribute(attr, val)
      set('floor', 'd', 'M' + floor.map(f1).join('L'))
      set('top', 'd', 'M' + top.map(f1).join('L'))
      set('fill', 'd', 'M' + top.map(f1).join('L') + 'L' + [...floor].reverse().map(f1).join('L') + 'Z')
      let ribs = ''
      for (let i = 0; i < samples.length; i += 3) ribs += 'M' + f1(floor[i]) + 'L' + f1(top[i])
      set('ribs', 'd', ribs)
      let spokes = ''
      for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; spokes += 'M' + f1(P(0, 0, 0, c, s)) + 'L' + f1(P(Math.cos(t) * R * 0.94, Math.sin(t) * R * 0.94, 0, c, s)) }
      set('spokes', 'd', spokes)
      // gota que baja del nacimiento a la salida
      const fl = ((now / 1000) % 7) / 7, di = Math.min(samples.length - 1, Math.floor(fl * (samples.length - 1)))
      set('drop', 'transform', `translate(${f1(top[di]).replace(' ', ' ')})`)
      res.forEach((m, i) => {
        const q = top[m.n], b = floor[m.n]
        set('r' + i, 'transform', `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)})`)
        set('rl' + i, 'd', `M${f1(b)}L${f1(q)}`)
      })
      set('src', 'transform', `translate(${f1(top[0])})`)
      set('end', 'transform', `translate(${f1(top[top.length - 1])})`)
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [model, reduce, R])

  const ry = R * 0.94 * Math.cos((62 * Math.PI) / 180)
  const reg = (k: string) => (el: SVGElement | null) => { refs.current[k] = el }
  return (
    <div className="holo holo-river" style={{ left: x, top: y, width: S, height: S, marginLeft: -R, marginTop: -R }} aria-hidden>
      <svg className="rh" viewBox={`0 0 ${S} ${S}`} overflow="visible">
        <defs>
          <linearGradient id="rh-curtain" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7cefff" stopOpacity=".42" /><stop offset="1" stopColor="#3fe6ff" stopOpacity=".04" /></linearGradient>
          <radialGradient id="rh-floor"><stop offset="0" stopColor="#3fe6ff" stopOpacity=".16" /><stop offset="1" stopColor="#3fe6ff" stopOpacity=".02" /></radialGradient>
        </defs>
        <ellipse cx={R} cy={R} rx={R * 0.94} ry={ry} className="rh-disc" />
        <ellipse cx={R} cy={R} rx={R * 0.62} ry={ry * 0.66} className="rh-ring" />
        <ellipse cx={R} cy={R} rx={R * 0.985} ry={ry * 1.05} className="rh-ticks" />
        <path ref={reg('spokes')} className="rh-spokes" />
        <path ref={reg('floor')} className="rh-floor" />
        <path ref={reg('fill')} className="rh-fill" fill="url(#rh-curtain)" />
        <path ref={reg('ribs')} className="rh-ribs" />
        {model.res.map((m, i) => <path key={'l' + m.r.id} ref={reg('rl' + i)} className="rh-damline" />)}
        <path ref={reg('top')} className="rh-top" />
        {model.res.map((m, i) => <g key={m.r.id} ref={reg('r' + i)}><circle r={4} className={`rh-res st-${status(pct(m.r))}`} />{m.r.c > 150 && <text y={-8} className="rh-lbl">{m.r.n}</text>}</g>)}
        <g ref={reg('drop')}><circle r={3.2} className="rh-drop" /></g>
        <g ref={reg('src')}><circle r={3} className="rh-pin" /><text y={-9} className="rh-lbl rh-src">{fmt(model.top)} m</text></g>
        <g ref={reg('end')}><circle r={3} className="rh-pin" /><text y={-9} className="rh-lbl">{fmt(model.bottom)} m</text></g>
      </svg>
      <div className="holo-tag" style={{ top: R + S * 0.27 }}>
        <strong>{v.n}</strong>
        <span>{fmt(v.L ?? v.km)} km · desnivel {fmt(model.top - model.bottom)} m{model.res.length ? ` · ${model.res.length} embalses` : ''}</span>
      </div>
    </div>
  )
})
