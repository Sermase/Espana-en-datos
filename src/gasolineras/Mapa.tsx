import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { geoArea, geoPath } from 'd3-geo'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import provRaw from '../provincias.json'
import { priceColor, provColor, type Datos, type Fuel, type Station } from './datos'

const W = 1000, H = 820
type F = { type: 'Feature'; properties: { id: string; n: string; c: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } }
// d3 quiere los anillos exteriores en sentido horario: se corrige lo que venga al revés.
const provs = (provRaw as unknown as { features: F[] }).features.map(f => {
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][]
  const fixed = polys.map(p => geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI ? p.map(r => [...r].reverse()) : p)
  return { ...f, geometry: { type: 'MultiPolygon' as const, coordinates: fixed } }
})
const fc = { type: 'FeatureCollection' as const, features: provs }
const proj = geoConicConformalSpain().fitExtent([[16, 70], [W - 16, H - 70]], fc as never)
const path = geoPath(proj)
const SHAPES = provs.map(f => ({ id: f.properties.id, n: f.properties.n, d: path(f as never) ?? '', b: path.bounds(f as never) }))
const BOX = proj.getCompositionBorders()

export type MapaApi = { flyTo: (x: number, y: number, k: number) => void; flyStation: (s: Station) => void; flyProv: (id: string) => void; reset: () => void }
type Props = {
  datos: Datos; fuel: Fuel; selId: number | null; selProv: string | null; near: { lat: number; lon: number } | null
  onStation: (s: Station) => void; onProv: (id: string) => void; onEmpty: () => void; api: Ref<MapaApi>
}

const Provincias = memo(function Provincias({ datos, fuel, selProv, faded }: { datos: Datos; fuel: Fuel; selProv: string | null; faded: boolean }) {
  const es = datos.hoy.espana[fuel]
  return <g className={`provs ${faded ? 'is-faded' : ''}`}>
    {SHAPES.map(s => <path key={s.id} d={s.d} data-prov={s.id} className={selProv === s.id ? 'is-sel' : ''} fill={provColor(datos.hoy.provincias[s.id]?.[fuel], es)} />)}
    <path d={BOX} className="canarias-box" />
  </g>
})

export function Mapa({ datos, fuel, selId, selProv, near, onStation, onProv, onEmpty, api }: Props) {
  const wrap = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), g = useRef<SVGGElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const zRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const tRef = useRef<ZoomTransform>(zoomIdentity)
  const [k, setK] = useState(1)
  // Cada gasolinera proyectada una vez; el color depende del combustible y de la mediana de su provincia.
  const pts = useMemo(() => datos.st.map(s => { const p = proj([s.lon, s.lat]); return p ? { s, x: p[0], y: p[1] } : null }).filter(Boolean) as { s: Station; x: number; y: number }[], [datos])
  const colors = useMemo(() => pts.map(({ s }) => {
    const v = s.p[fuel], m = datos.hoy.provincias[s.prov]?.[fuel]
    return v == null ? null : priceColor(m == null ? null : v - m)
  }), [pts, fuel, datos])

  const scale = () => { const r = svg.current!.getBoundingClientRect(); return Math.min(r.width / W, r.height / H) }
  const draw = useCallback(() => {
    const c = cv.current, el = svg.current; if (!c || !el) return
    const r = el.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1)
    if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr) }
    const ctx = c.getContext('2d')!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height)
    const s = scale(), ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2, t = tRef.current
    const rad = Math.max(1, Math.min(6, 0.9 * Math.sqrt(t.k))) * dpr
    ctx.globalAlpha = t.k < 1.6 ? 0.55 : 0.95
    for (let i = 0; i < pts.length; i++) {
      const col = colors[i]; if (!col) continue
      const X = (ox + (t.x + pts[i].x * t.k) * s) * dpr, Y = (oy + (t.y + pts[i].y * t.k) * s) * dpr
      if (X < -10 || Y < -10 || X > c.width + 10 || Y > c.height + 10) continue
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, rad, 0, 6.2832); ctx.fill()
    }
    ctx.globalAlpha = 1
    const ring = (i: number, color: string, rr: number) => {
      const X = (ox + (t.x + pts[i].x * t.k) * s) * dpr, Y = (oy + (t.y + pts[i].y * t.k) * s) * dpr
      ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(X, Y, rr * dpr, 0, 6.2832); ctx.stroke()
    }
    if (selId != null) { const i = pts.findIndex(p => p.s.id === selId); if (i >= 0) { ring(i, '#fff', 9); ring(i, '#ff5f7e', 13) } }
    if (near) {
      const p = proj([near.lon, near.lat])
      if (p) { const X = (ox + (t.x + p[0] * t.k) * s) * dpr, Y = (oy + (t.y + p[1] * t.k) * s) * dpr; ctx.fillStyle = '#4da3ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(X, Y, 6 * dpr, 0, 6.2832); ctx.fill(); ctx.stroke() }
    }
  }, [pts, colors, selId, near])
  const drawRef = useRef(draw); drawRef.current = draw
  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const el = svg.current!
    let raf = 0
    const z = zoom<SVGSVGElement, unknown>().scaleExtent([1, 60]).translateExtent([[-200, -200], [W + 200, H + 200]])
      .on('zoom', ev => {
        tRef.current = ev.transform
        g.current?.setAttribute('transform', ev.transform.toString())
        g.current?.style.setProperty('--k', String(ev.transform.k))
        cancelAnimationFrame(raf); raf = requestAnimationFrame(() => drawRef.current())
      })
      .on('end', ev => setK(ev.transform.k))
    zRef.current = z
    select(el).call(z).on('dblclick.zoom', null)
    const ro = new ResizeObserver(() => drawRef.current()); ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  const fly = useCallback((x: number, y: number, kk: number) => {
    const el = svg.current!, r = el.getBoundingClientRect(), s = scale()
    const ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2
    // en el móvil el punto queda arriba, para que la ficha no lo tape
    const cx = (r.width / 2 - ox) / s, cy = ((r.width < 700 ? r.height * 0.28 : r.height / 2) - oy) / s
    select(el).transition().duration(900).call(zRef.current!.transform, zoomIdentity.translate(cx, cy).scale(kk).translate(-x, -y))
  }, [])
  useImperativeHandle(api, () => ({
    flyTo: fly,
    flyStation: (st) => { const p = proj([st.lon, st.lat]); if (p) fly(p[0], p[1], Math.max(tRef.current.k, 14)) },
    flyProv: (id) => { const sh = SHAPES.find(x => x.id === id); if (!sh) return; const [[x0, y0], [x1, y1]] = sh.b; fly((x0 + x1) / 2, (y0 + y1) / 2, Math.min(12, 0.8 / Math.max((x1 - x0) / W, (y1 - y0) / H))) },
    reset: () => select(svg.current!).transition().duration(800).call(zRef.current!.transform, zoomIdentity),
  }), [fly])

  // Toque: la gasolinera más cercana bajo el dedo; si no hay, la provincia.
  const down = useRef<[number, number] | null>(null)
  const onUp = (e: React.PointerEvent) => {
    const d = down.current; down.current = null
    if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6) return
    const r = svg.current!.getBoundingClientRect(), s = scale(), t = tRef.current
    const ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2
    const mx = ((e.clientX - r.left - ox) / s - t.x) / t.k, my = ((e.clientY - r.top - oy) / s - t.y) / t.k
    if (t.k >= 2.5) {
      const reach = (e.pointerType === 'mouse' ? 10 : 22) / (s * t.k)
      let best = -1, bd = reach
      for (let i = 0; i < pts.length; i++) { if (!colors[i]) continue; const dd = Math.hypot(pts[i].x - mx, pts[i].y - my); if (dd < bd) { bd = dd; best = i } }
      if (best >= 0) return onStation(pts[best].s)
    }
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.hasAttribute('data-prov'))
    if (hit) return onProv(hit.getAttribute('data-prov')!)
    onEmpty()
  }

  return (
    <div className="mapa" ref={wrap}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="mapa-svg" onPointerDown={e => { down.current = [e.clientX, e.clientY] }} onPointerUp={onUp} role="img" aria-label="Mapa de precios por provincia y gasolinera">
        <g ref={g}><Provincias datos={datos} fuel={fuel} selProv={selProv} faded={k > 3} /></g>
      </svg>
      <canvas ref={cv} className="mapa-cv" aria-hidden />
      {k < 2.5 && <p className="mapa-hint">Acércate para ver cada gasolinera</p>}
    </div>
  )
}
export { proj, SHAPES }
