import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoArea } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import { motion, useReducedMotion } from 'motion/react'
import { Dices, LocateFixed, Minus, Plus } from 'lucide-react'
import { basins, basinStats, consumo, data, fmt, fmtPct, landColor, pct, rivers, status } from './data'
import { resolve, type Sel } from './sel'
import { Holo, RiverHolo } from './Holo'
import { useRivers, type River } from './rivers'
import { aggList, aggSize, c1Color, edarSize, useEdar, TRATAMIENTO, type AggPt, type Edar } from './edar'
import { CONTENIDO, H, SHAPES, W, labelPoint, pathMain, project } from './geo'
import { colorDe, isUrb, metrica, SEL_URB, type Urb } from './ciudad'
import { useReferencia, type Referencia } from './referencia'

export type Layer = 'agua' | 'energia' | 'lluvia' | 'rios' | 'consumo' | 'alcantarillado' | 'depuracion' | 'vertidos'
/** Desde este zoom, las capas de ciudad dejan el resumen por comunidad y enseñan cada depuradora o núcleo. */
export const CERCA = 2.2
/** Capas con cuencas y ríos de fondo; el resto lleva comunidades y el plano de referencia. */
export const HYDRO = (l: Layer) => l === 'agua' || l === 'energia' || l === 'rios'

type Tip = { x: number; y: number; title: string; line: string } | null
type Pt = { sel: Sel; px: number; py: number; s: number }
type Hover = (e: React.PointerEvent, title: string, line: string) => void

const isPhone = () => typeof window !== 'undefined' && window.innerWidth < 980

/** Todas las líneas de río proyectadas, para dibujar el entorno dentro del holograma. */
const RIVER_LINES: [number, number][][] = rivers.features.flatMap(f => {
  const g = f.geometry as { type: string; coordinates: number[][] | number[][][] }
  const ls = (g.type === 'LineString' ? [g.coordinates] : g.coordinates) as number[][][]
  return ls.map(l => l.map(([x, y]) => project(x, y)))
})
const SHORT: Record<string, string> = {
  'Galicia-Costa': 'Galicia', 'Cantábrico Occidental': 'Cant. Occ.', 'Cantábrico Oriental': 'Cant. Or.', 'Guadalete y Barbate': 'Guadalete',
  'Tinto, Odiel y Piedras': 'Tinto-Odiel', 'Cuencas Mediterráneas Andaluzas': 'Medit. Andaluza', 'Cuencas Internas de Cataluña': 'Cataluña', 'Islas Baleares': 'Baleares',
}
const CHIPS = basins.features.map(f => ({ id: f.properties.id as string, name: SHORT[f.properties.name] ?? f.properties.name, at: labelPoint(f) }))

const RES = [...data.reservoirs].sort((a, b) => b.c - a.c).map(r => {
  const [px, py] = project(r.x, r.y)
  return { r, px, py, s: Math.max(8, Math.min(30, Math.sqrt(r.c) * 0.95)), p: pct(r) }
})
const RAIN = data.rain.map((g, i) => ({ g, i, xy: project(g.x, g.y) }))
const DIS = data.dischargers.map((d, i) => ({ d, i, xy: project(d.x, d.y) })).sort((a, b) => b.d.v - a.d.v)
const FLOWS = data.flows.map((f, i) => ({ f, i, xy: project(f.x, f.y) })).sort((a, b) => b.f.q - a.f.q)
const BASIN = Object.fromEntries(basinStats.map(b => [b.id, b]))
const consIdx = new Map(consumo.regions.map((u, i) => [u.n, i]))
const regionUse = (name: string) => { const i = consIdx.get(name); return i != null ? consumo.regions[i] : null }

type EdarPt = { p: Edar; i: number; xy: [number, number]; s: number }
type AggXY = { a: AggPt; i: number; xy: [number, number]; s: number }
const Glyphs = memo(function Glyphs({ layer, filled, focusBasin, seen, hover, edar, aggs, rainLab }: { layer: Layer; filled: boolean; focusBasin: string | null; seen: Set<string>; hover: Hover; edar: EdarPt[] | null; aggs: AggXY[] | null; rainLab: Set<number> | null }) {
  if (layer === 'alcantarillado') return <>{(aggs ?? []).map(({ a, i, xy, s }, j) => (
    <g key={a.c} transform={`translate(${xy[0]} ${xy[1]})`} className="nucleo" onPointerMove={e => hover(e, a.n, `${a.c1 != null ? fmt(a.c1, a.c1 % 1 ? 1 : 0) + ' % recogido por colectores' : 'sin dato'} · ${a.pe ? fmt(a.pe) + ' hab. eq.' : ''}`)}>
      <g className="gs"><rect x={-s / 2} y={-s / 2} width={s} height={s} rx={1.2} className="nucleo-c" data-i={i} style={{ fill: c1Color(a.c1), transform: `scale(${filled ? 1 : 0})`, transitionDelay: `${Math.min(900, j * 0.5)}ms` }} /></g>
    </g>))}</>
  if (layer === 'depuracion') return <>{(edar ?? []).map(({ p, i, xy, s }, j) => (
    <g key={p.c} transform={`translate(${xy[0]} ${xy[1]})`} data-edar={i} className={`edar t${p.t} ${p.ok === 0 ? 'no-cumple' : ''}`} onPointerMove={e => hover(e, `EDAR ${p.n}`, `${TRATAMIENTO[p.t]} · ${p.cap ? fmt(p.cap) + ' hab. eq.' : 'sin capacidad'}${p.ok === 0 ? ' · no cumple' : ''}`)}>
      <g className="gs"><circle r={s / 2} className="edar-balsa" style={{ transform: `scale(${filled ? 1 : 0})`, transitionDelay: `${Math.min(900, j * 0.6)}ms` }} />{s > 7 && <circle r={s / 4} className="edar-centro" />}</g>
    </g>))}</>
  if (layer === 'agua' || layer === 'energia') return <>{RES.map(({ r, px, py, s, p }, i) => {
    const hydro = r.ec > 0, ep = hydro ? (r.e / r.ec) * 100 : 0
    if (layer === 'energia' && !hydro) return <circle key={r.id} cx={px} cy={py} r={1.6} className="dot-off" />
    const v = layer === 'energia' ? ep : Math.min(p, 100)
    const st = layer === 'energia' ? 'volt' : status(p)
    return (
      <g key={r.id} transform={`translate(${px} ${py})`} data-res={r.id} className={`node st-${st} ${focusBasin && r.b !== focusBasin ? 'is-dim' : ''}`}
        onPointerMove={e => hover(e, r.n, layer === 'energia' ? `${fmt(r.e)} de ${fmt(r.ec)} GWh · ${fmtPct(ep)}` : `${fmtPct(p)} · ${fmt(r.a)} de ${fmt(r.c)} hm³`)}>
        <g className="gs">
          <circle r={s / 2} className="node-bg" />
          <circle r={s / 2 - 1.6} className="node-arc" pathLength={100} transform="rotate(-90)"
            style={{ strokeDasharray: `${filled ? v : 0} 100`, transitionDelay: `${(px / W) * 600 + (i % 9) * 15}ms` }} />
          <circle r={s >= 16 ? 2 : 1.3} className="node-core" />
          {layer === 'energia' && s >= 14 && <path className="bolt" d="M1.2 -5 L-2.6 0.8 H0 L-1.2 5 L2.6 -0.8 H0 Z" />}
          {layer === 'agua' && seen.has(`embalse-${r.id}`) && <rect className="seen" x={s / 2 - 1} y={-s / 2 - 1} width={3} height={3} />}
        </g>
      </g>
    )
  })}</>
  if (layer === 'lluvia') return <>{RAIN.map(({ g, i, xy }) => {
    const hcol = 4 + Math.min(95, g.p * 0.48)
    return (
      <g key={i} transform={`translate(${xy[0]} ${xy[1]})`} className="col" onPointerMove={e => hover(e, g.n, `${fmt(g.p, 1)} l/m² en la semana`)}>
        <g className="gs">
          <ellipse rx={6} ry={2.4} className="col-base" />
          <rect x={-1.6} y={-hcol} width={3.2} height={hcol} rx={1.6} className="col-beam" style={{ transform: `scaleY(${filled ? 1 : 0})` }} />
          <circle r={2.6} className="col-top" style={{ transform: `translateY(${filled ? -hcol : 0}px)` }} />
          {rainLab?.has(i) && <text y={-hcol - 7} className="col-num">{fmt(g.p)}</text>}
        </g>
      </g>
    )
  })}</>
  if (layer === 'rios') return <>{FLOWS.map(({ f, i, xy }) => {
    const s = 7 + Math.sqrt(f.q) * 1.1
    const up = f.qa != null && f.q > f.qa * 1.05, dn = f.qa != null && f.q < f.qa * 0.95
    return (
      <g key={i} transform={`translate(${xy[0]} ${xy[1]})`} className={`gauge ${up ? 'is-up' : dn ? 'is-down' : ''}`} onPointerMove={e => hover(e, f.n, `${fmt(f.q, 1)} m³/s · río ${f.r}`)}>
        <g className="gs">
          <rect x={-s / 2} y={-s / 2} width={s} height={s} className="gauge-body" transform="rotate(45)" />
          {(up || dn) && <path className="gauge-dir" d={up ? `M0 ${-s / 2 - 9} l4 6 h-8 z` : `M0 ${s / 2 + 9} l4 -6 h-8 z`} />}
        </g>
      </g>
    )
  })}</>
  if (layer === 'vertidos') return <>{DIS.map(({ d, i, xy }) => {
    const rr = (6 + Math.sqrt(d.v) * 0.8) / 2
    const hex = Array.from({ length: 6 }, (_, j) => `${(Math.cos((Math.PI / 3) * j) * rr).toFixed(1)},${(Math.sin((Math.PI / 3) * j) * rr).toFixed(1)}`).join(' ')
    return (
      <g key={i} transform={`translate(${xy[0]} ${xy[1]})`} className={`outfall ${d.t === 'URBANO' ? 'urb' : 'ind'}`} onPointerMove={e => hover(e, d.n, `${fmt(d.v, 1)} hm³/año autorizados · ${d.m}`)}>
        <g className="gs"><polygon points={hex} className="outfall-shape" /></g>
      </g>
    )
  })}</>
  return null
})

/** Siluetas de los embalses (IGN y MITECO), se cargan aparte cuando hacen falta. */
type Lam = Map<number, { d: string; b: [[number, number], [number, number]]; xy: [number, number][][] }>
let lamCache: Promise<Lam> | null = null
function loadLaminas(): Promise<Lam> {
  lamCache ??= fetch('./data/laminas.json').then(r => r.json()).then((j: Record<string, number[][][][]>) => {
    const m: Lam = new Map()
    for (const [id, raw] of Object.entries(j)) {
      // Si un anillo viene al revés, d3 lo entiende como «todo el planeta menos el lago»: se le da la vuelta.
      const coords = raw.map(poly => {
        const g = { type: 'Polygon' as const, coordinates: poly }
        return geoArea(g) > 2 * Math.PI ? poly.map(r => [...r].reverse()) : poly
      })
      const f = { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiPolygon' as const, coordinates: coords } }
      m.set(Number(id), { d: pathMain(f) ?? '', b: pathMain.bounds(f) as [[number, number], [number, number]], xy: coords.flatMap(poly => poly.slice(0, 1)).map(ring => ring.map(([x, y]) => project(x, y))) })
    }
    return m
  }).catch(() => { lamCache = null; return new Map() })
  return lamCache
}
const RES_BY_ID = new Map(RES.map(x => [x.r.id, x]))

const Laminas = memo(function Laminas({ lam, layer, selId, focusBasin }: { lam: Lam; layer: Layer; selId: number | null; focusBasin: string | null }) {
  return <g className="laminas" aria-hidden>{[...lam.entries()].map(([id, l]) => {
    const x = RES_BY_ID.get(id); if (!x) return null
    const st = layer === 'energia' ? (x.r.ec > 0 ? 'volt' : 'off') : status(x.p)
    return <path key={id} d={l.d} className={`lamina st-${st} ${selId === id ? 'is-sel' : ''} ${focusBasin && x.r.b !== focusBasin ? 'is-dim' : ''}`} />
  })}</g>
})

/** Etiquetas de cuenca a vista general: son botones fáciles de pinchar. */
const CHIP_AREA = new Map(SHAPES.basins.map(b => [b.id, (b.bounds[1][0] - b.bounds[0][0]) * (b.bounds[1][1] - b.bounds[0][1])]))
type Cam = { k: number; x: number; vb: number; ox: number; cw: number }
const BasinChips = memo(function BasinChips({ cam }: { cam: Cam }) {
  // Las etiquetas no se salen de la pantalla y, si dos chocarían (pasa en el móvil con las cuencas pequeñas del norte),
  // se queda la de la cuenca más grande.
  const s = cam.k * cam.vb, puestas: number[][] = []
  const vis = [...CHIPS].sort((a, b) => (CHIP_AREA.get(b.id) ?? 0) - (CHIP_AREA.get(a.id) ?? 0)).flatMap(c => {
    const b = BASIN[c.id]; if (!b) return []
    const w = 0.9 * (`${c.name} ${Math.round(b.pct)} %`.length * 6.3 + 14), h = 0.9 * 20 + 3
    const sx = cam.ox + cam.vb * (cam.x + cam.k * c.at[0]), nx = Math.max(w / 2 + 4, Math.min(cam.cw - w / 2 - 4, sx))
    const ax = c.at[0] + (nx - sx) / s
    const x = ax * s - w / 2, y = c.at[1] * s - h / 2
    if (puestas.some(([px, py, pw, ph]) => x < px + pw && x + w > px && y < py + ph && y + h > py)) return []
    puestas.push([x, y, w, h]); return [{ ...c, at: [ax, c.at[1]] as [number, number] }]
  })
  return <g className="bchips">{vis.map(c => {
    const b = BASIN[c.id]
    const label = `${c.name} ${Math.round(b.pct)} %`, w = label.length * 6.3 + 14
    return <g key={c.id} transform={`translate(${c.at[0]} ${c.at[1]})`}><g className="rs" data-basin-chip={c.id}>
      <rect x={-w / 2} y={-10} width={w} height={20} rx={10} className={`bchip st-${status(b.pct)}`} />
      <text y={4} className="bchip-t">{c.name} <tspan className="bchip-p">{Math.round(b.pct)} %</tspan></text>
    </g></g>
  })}</g>
})

/** El suelo: cuencas y ríos en las capas de agua; comunidades en el resto (con su color cuando la capa tiene dato por comunidad). */
const Ground = memo(function Ground({ layer, focusBasin, focusRegion, hover }: { layer: Layer; focusBasin: string | null; focusRegion: string | null; hover: Hover }) {
  const hydro = HYDRO(layer), urb = isUrb(layer), dataLayer = layer === 'agua' || layer === 'energia'
  const contorno = hydro ? SHAPES.land + SHAPES.landExtra : SHAPES.landProv
  return (<>
    <path d={contorno} className="land-side" transform="translate(0 9)" />
    <path d={contorno} className="land-side2" transform="translate(0 4)" />
    {hydro ? <>
      <path d={SHAPES.landExtra} className="land-extra" />
      {SHAPES.basins.map(b => {
        const st = BASIN[b.id]
        const fill = dataLayer ? landColor(layer === 'energia' && st?.ec ? (st.e / st.ec) * 100 : st?.pct ?? 50) : 'var(--land-neutral)'
        return <path key={b.id} d={b.d} data-basin={b.id} className={`basin ${focusBasin === b.id ? 'is-focus' : focusBasin ? 'is-dim' : ''}`} style={{ fill }}
          onPointerMove={e => st && dataLayer && hover(e, b.name, layer === 'energia' ? `Energía embalsada: ${fmtPct((st.e / Math.max(st.ec, 1)) * 100)}` : `Agua embalsada: ${fmtPct(st.pct)}`)} />
      })}
    </> : SHAPES.ccaa.map(rg => {
      const u = regionUse(rg.name), m = urb ? metrica(layer) : null, v = m && u ? m.valor(u) : null
      return <path key={rg.name} d={rg.d} data-region={urb ? rg.name : undefined} className={`region ${urb ? 'is-dato' : 'is-neutro'} ${focusRegion === rg.name ? 'is-focus' : focusRegion ? 'is-dim' : ''}`}
        style={{ fill: urb ? colorDe(layer, v) : 'var(--land-neutral)' }}
        onPointerMove={e => m && hover(e, rg.name, v != null ? m.frase(v) : 'Sin dato')} />
    })}
    <path d={contorno} className="land-glow" />
    <path d={contorno} className="land-rim" />
    {hydro && <g className="rivers" aria-hidden>
      {SHAPES.rivers.map(r => <path key={'b' + r.o} d={r.d} className={`river-bed o${r.o}`} />)}
      {SHAPES.rivers.filter(r => r.o >= 6).map(r => <path key={r.o} d={r.d} className={`river o${r.o}`} />)}
    </g>}
  </>)
})

/** Recuadro de Canarias y los dos puntos de Ceuta y Melilla, que en el mapa son casi invisibles. */
const Marcos = memo(function Marcos({ layer, hover }: { layer: Layer; hover: Hover }) {
  const c = SHAPES.canarias, urb = isUrb(layer), u = regionUse('Ceuta y Melilla')
  const m = urb ? metrica(layer) : null, v = m && u ? m.valor(u) : null
  const sinBoletin = layer === 'agua' || layer === 'energia' || layer === 'rios'
  const esq = 9
  return <g className="marcos">
    <g className="can-marco" aria-hidden>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={5} />
      {[[c.x, c.y, 1, 1], [c.x + c.w, c.y, -1, 1], [c.x, c.y + c.h, 1, -1], [c.x + c.w, c.y + c.h, -1, -1]].map(([x, y, sx, sy], j) =>
        <path key={j} d={`M${x} ${y + sy * esq}V${y}H${x + sx * esq}`} className="can-esq" />)}
      <g transform={`translate(${c.x + 6} ${c.y + 5})`}><g className="rs"><text y={11} className="can-n">Canarias</text>
        {sinBoletin && <text y={24} className="can-nota">{layer === 'rios' ? 'sin aforos en el boletín' : 'sus embalses no están en el boletín'}</text>}</g></g>
    </g>
    {([['Ceuta', SHAPES.ceuta, -1], ['Melilla', SHAPES.melilla, 1]] as const).map(([n, xy, lado]) => (
      <g key={n} transform={`translate(${xy[0]} ${xy[1]})`} className={`ciudad-am ${urb ? 'is-dato' : ''}`} data-region={urb ? 'Ceuta y Melilla' : undefined}
        onPointerMove={e => m && hover(e, `${n} · Ceuta y Melilla`, v != null ? m.frase(v) : 'Sin dato')}>
        <g className="rs">
          <circle r={urb ? 7 : 4.5} style={urb ? { fill: colorDe(layer as Urb, v) } : undefined} />
          <text x={lado * (urb ? 11 : 8)} y={4} textAnchor={lado < 0 ? 'end' : 'start'}>{n}</text>
        </g>
      </g>
    ))}
  </g>
})

/** Plano de referencia: manchas urbanas siempre; autovías solo de cerca, para no meter ruido en la vista general. */
const Plano = memo(function Plano({ r, vias }: { r: Referencia; vias: boolean }) {
  return <g className="plano" aria-hidden>
    {vias && r.vias.map((d, i) => d && <path key={i} d={d} className={`pl-via t${i + 1}`} />).reverse()}
    <path d={r.urbano} className="pl-urbano" />
  </g>
})
/** Nombres de ciudades: más cuanto más cerca. */
const Ciudades = memo(function Ciudades({ r, k }: { r: Referencia; k: number }) {
  const min = k < 1.5 ? 1.2e6 : k < CERCA ? 6e5 : k < 3.5 ? 2.5e5 : k < 6 ? 1e5 : 0
  return <g className="pl-ciudades" aria-hidden>{r.ciudades.filter(c => c.pob >= min).map(c => (
    <g key={c.n} transform={`translate(${c.xy[0]} ${c.xy[1]})`}><g className="rs">
      <rect x={-2.5} y={-2.5} width={5} height={5} transform="rotate(45)" className="pl-punto" />
      <text x={7} y={4} className="pl-nombre">{c.n}</text>
    </g></g>
  ))}</g>
})

/**
 * La cifra de cada comunidad, grande y legible de lejos. Se colocan de mayor a menor comunidad y se salta
 * la que chocaría con otra ya puesta (sigue teniendo su color y se puede tocar).
 */
function EtiquetasCCAA({ layer, k, vb }: { layer: Urb; k: number; vb: number }) {
  const m = metrica(layer), s = k * vb
  const cm = [(SHAPES.ceuta[0] + SHAPES.melilla[0]) / 2, (SHAPES.ceuta[1] + SHAPES.melilla[1]) / 2 + 2] as [number, number]
  const puestas: { x: number; y: number; w: number; h: number }[] = []
  const lista = [...SHAPES.ccaa].sort((a, b) => b.area - a.area).flatMap(rg => {
    const u = regionUse(rg.name), v = u ? m.valor(u) : null
    const txt = v != null ? m.num(v) : 'Sin dato', at = rg.name === 'Ceuta y Melilla' ? cm : rg.at
    const w = 0.9 * (txt.length * (v != null ? 8.6 : 6.4) + 8), h = 0.9 * 17
    const x = at[0] * s - w / 2, y = at[1] * s - 14
    if (puestas.some(p => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y)) return []
    puestas.push({ x, y, w, h })
    return [{ rg, at, txt, v }]
  })
  return <g className="reg-labels" aria-hidden>{lista.map(({ rg, at, txt, v }) => (
    <g key={rg.name} className="reg-label" transform={`translate(${at[0]} ${at[1]})`}><g className="rs">
      <text y={5} className={`reg-num ${v == null ? 'is-nd' : ''}`}>{txt}</text>
    </g></g>
  ))}</g>
}

export function Board({ layer, sel, onPick, seen, onDice, onCerca }: {
  layer: Layer; sel: Sel | null; onPick: (s: Sel | null) => void; seen: Set<string>; onDice: () => void
  /** avisa cuando las capas de ciudad pasan de la vista por comunidades a la de puntos, y al revés */
  onCerca?: (cerca: boolean) => void
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const kRef = useRef(1), vbRef = useRef(1)
  const ready = useRef(false)
  const down = useRef<{ x: number; y: number; t: number; n: number } | null>(null)
  const [k, setK] = useState(1)
  const [camX, setCamX] = useState(0)
  const [filled, setFilled] = useState(false)
  const [tip, setTip] = useState<Tip>(null)
  const [lam, setLam] = useState<Lam | null>(null)
  const lamRef = useRef<Lam | null>(null)
  const [holo, setHolo] = useState<{ x: number; y: number } | null>(null)
  const holoAt = useRef<[number, number] | null>(null)
  const holoAny = useRef(false) // los ríos tienen holograma a cualquier zoom
  const rivs = useRivers()
  const edars = useEdar()
  const aggPts = useMemo(() => edars ? (aggList() ?? []).map((a, i) => ({ a, i, xy: project(a.x, a.y), s: aggSize(a.pe) })) : null, [edars])
  const edarPts = useMemo(() => edars?.map((p, i) => ({ p, i, xy: project(p.x, p.y), s: edarSize(p.cap) })) ?? null, [edars])
  const ref = useReferencia(!HYDRO(layer))
  const home = useRef<ZoomTransform>(zoomIdentity)
  const rivProj = useMemo(() => rivs?.map(v => ({ v, g: v.g.map(l => l.map(([x, y]) => project(x, y))), b: (() => {
    const pts = v.g.flat().map(([x, y]) => project(x, y)); const xs = pts.map(q => q[0]), ys = pts.map(q => q[1])
    return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] as [[number, number], [number, number]]
  })() })) ?? null, [rivs])
  const rivRef = useRef(rivProj); rivRef.current = rivProj
  const holoSize = () => { const w = wrapRef.current?.clientWidth ?? 800; return isPhone() ? Math.min(270, w * 0.68) : Math.min(420, w * 0.42) }
  // El holograma se coloca sobre el embalse cuando la cámara se para.
  const placeHolo = useCallback(() => {
    const at = holoAt.current, g = gRef.current, wrap = wrapRef.current
    if (!at || !g || !wrap || (!holoAny.current && kRef.current < 2.2)) return setHolo(null)
    const m = g.getScreenCTM(); if (!m) return
    const q = new DOMPoint(at[0], at[1]).matrixTransform(m), box = wrap.getBoundingClientRect()
    const x = q.x - box.left, y = q.y - box.top
    setHolo(x > 0 && x < box.width && y > 0 && y < box.height ? { x, y } : null)
  }, [])
  useEffect(() => { const t = setTimeout(() => loadLaminas().then(m => { lamRef.current = m; setLam(m) }), 1500); return () => clearTimeout(t) }, [])

  const boost = () => Math.min(1.8, Math.max(1, 0.6 / vbRef.current))
  // Hasta k=3 los iconos crecen un poco al acercarse; después mantienen su tamaño en pantalla.
  const glyphScale = (kk: number) => boost() * (kk <= 3 ? Math.pow(kk, -0.62) : Math.pow(3, 0.38) / kk)
  // La escala de iconos y etiquetas va en variables CSS: el zoom no vuelve a pintar React.
  const applyVars = useCallback((kk: number) => {
    const g = gRef.current; if (!g) return
    const vb = vbRef.current
    g.style.setProperty('--gs', String(glyphScale(kk)))
    g.style.setProperty('--rs', String(0.9 / (kk * vb)))
  }, [])

  // Cifras de lluvia sobre las columnas: de más a menos lluvia, sin pisarse; al acercarse caben más.
  const rainLab = useMemo(() => {
    if (layer !== 'lluvia') return null
    const gsv = glyphScale(k), s = k * vbRef.current, out = new Set<number>(), puestas: number[][] = []
    for (const x of RAIN.filter(x => x.g.p >= 15).sort((a, b) => b.g.p - a.g.p)) {
      const hcol = 4 + Math.min(95, x.g.p * 0.48), txt = fmt(x.g.p)
      const w = (txt.length * 6.2 + 4) * gsv * s, h = 12 * gsv * s
      const cx = x.xy[0] * s - w / 2, cy = (x.xy[1] - (hcol + 7) * gsv) * s - h
      if (puestas.some(([px, py, pw, ph]) => cx < px + pw && cx + w > px && cy < py + ph && cy + h > py)) continue
      puestas.push([cx, cy, w, h]); out.add(x.i)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, k])
  const points: Pt[] = useMemo(() => {
    if (layer === 'agua' || layer === 'energia') return RES.filter(x => layer === 'agua' || x.r.ec > 0).map(x => ({ sel: { k: 'res', id: x.r.id }, px: x.px, py: x.py, s: x.s }))
    if (layer === 'lluvia') return RAIN.map(x => ({ sel: { k: 'rain', i: x.i }, px: x.xy[0], py: x.xy[1], s: 12 }))
    if (layer === 'rios') return FLOWS.map(x => ({ sel: { k: 'flow', i: x.i }, px: x.xy[0], py: x.xy[1], s: 8 + Math.sqrt(x.f.q) }))
    if (isUrb(layer) && k < CERCA) return []
    if (layer === 'alcantarillado') return (aggPts ?? []).map(x => ({ sel: { k: 'agg', i: x.i } as Sel, px: x.xy[0], py: x.xy[1], s: x.s }))
    if (layer === 'depuracion') return (edarPts ?? []).map(x => ({ sel: { k: 'edar', i: x.i } as Sel, px: x.xy[0], py: x.xy[1], s: x.s }))
    if (layer === 'vertidos') return DIS.map(x => ({ sel: { k: 'dis', i: x.i }, px: x.xy[0], py: x.xy[1], s: 6 + Math.sqrt(x.d.v) * 0.8 }))
    return []
  }, [layer, edarPts, aggPts, k])
  const cerca = isUrb(layer) && k >= CERCA
  const cercaCb = useRef(onCerca); cercaCb.current = onCerca
  useEffect(() => { cercaCb.current?.(cerca) }, [cerca])

  useEffect(() => {
    const t = setTimeout(() => { setFilled(true); ready.current = true }, reduce ? 0 : 1200)
    return () => clearTimeout(t)
  }, [reduce])

  useEffect(() => {
    const svg = svgRef.current!, g = gRef.current!, wrap = wrapRef.current!
    const ro = new ResizeObserver(() => { vbRef.current = Math.min(svg.clientWidth / W, svg.clientHeight / H) || 1; applyVars(kRef.current) })
    ro.observe(svg)
    const z = zoom<SVGSVGElement, unknown>().scaleExtent([0.8, 40]).translateExtent([[-900, -900], [W + 900, H + 900]])
      .on('start', () => wrap.classList.add('is-moving'))
      .on('zoom', ev => { g.setAttribute('transform', ev.transform.toString()); kRef.current = ev.transform.k; applyVars(ev.transform.k) })
      .on('end', ev => { wrap.classList.remove('is-moving'); setK(ev.transform.k); setCamX(ev.transform.x); placeHolo() })
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    vbRef.current = Math.min(svg.clientWidth / W, svg.clientHeight / H) || 1
    applyVars(1)
    if (isPhone()) {
      // En el móvil se encaja todo (Canarias incluida) entre la cabecera y la leyenda.
      const cw = svg.clientWidth, ch = svg.clientHeight, sc = Math.min(cw / W, ch / H), ox = (cw - W * sc) / 2, oy = (ch - H * sc) / 2
      const top = 146, bottom = Math.max(top + 200, ch - 300)
      const [[x0, y0], [x1, y1]] = CONTENIDO, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      // margen a los lados para que las etiquetas de las cuencas de la costa no se corten
      const kk = Math.min((cw - 24) / ((x1 - x0) * sc), (bottom - top) / ((y1 - y0) * sc))
      home.current = zoomIdentity.translate((cw / 2 - ox) / sc - kk * cx, ((top + bottom) / 2 - oy) / sc - kk * cy).scale(kk)
      select(svg).call(z.transform, home.current)
      setK(home.current.k); setCamX(home.current.x)
    }
    return () => { ro.disconnect(); select(svg).on('.zoom', null) }
  }, [applyVars, placeHolo])

  // La cámara vuela a lo elegido y lo deja donde no lo tapa la ficha.
  const selKeyStr = sel ? JSON.stringify(sel) : ''
  useEffect(() => {
    const it = resolve(sel)
    holoAt.current = it?.k === 'res' ? project(it.r.x, it.r.y) : null
    holoAny.current = it?.k === 'river'
    if (!holoAt.current) setHolo(null)
    if (!it || !zoomRef.current) return
    let px: number, py: number, kk: number
    if (it.k === 'river') {
      const rp = rivRef.current?.find(x => x.v.id === it.v.id); if (!rp) return
      const [[x0, y0], [x1, y1]] = rp.b
      px = (x0 + x1) / 2; py = (y0 + y1) / 2
      holoAt.current = [px, py]
      kk = Math.min(12, Math.max(1, (holoSize() * 0.8) / (Math.hypot(x1 - x0, y1 - y0) * vbRef.current)))
    } else if (it.k === 'basin' || it.k === 'cons' || it.k === 'dep' || it.k === 'alc') {
      const b = it.k === 'basin' ? SHAPES.basins.find(x => x.id === it.b.id)?.bounds : SHAPES.ccaa.find(x => x.name === it.u.n)?.bounds
      if (!b) return
      const bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1]
      px = (b[0][0] + b[1][0]) / 2; py = (b[0][1] + b[1][1]) / 2
      kk = Math.min(6, Math.max(1.2, 0.62 / Math.max(bw / W, bh / (H * (isPhone() ? 0.5 : 0.8)))))
      // En alcantarillado y depuración, al elegir comunidad se baja hasta ver sus núcleos o depuradoras.
      if (it.k === 'alc' || it.k === 'dep') kk = Math.max(kk, CERCA + 0.05)
    } else {
      const ll = it.k === 'res' ? it.r : it.k === 'rain' ? it.g : it.k === 'flow' ? it.f : it.k === 'dis' ? it.d : it.k === 'edar' ? it.p : it.k === 'agg' ? it.a : null
      if (!ll) return
      ;[px, py] = project(ll.x, ll.y); kk = Math.max(kRef.current, 3.4)
    }
    const svg = svgRef.current!
    const fly = async () => {
      // Con silueta, el embalse se encuadra entero; sin ella, un acercamiento fijo.
      if (it.k === 'res') {
        const l = (lamRef.current ?? await loadLaminas()).get(it.r.id)
        if (l) {
          const [[x0, y0], [x1, y1]] = l.b, bw = Math.max(x1 - x0, 2), bh = Math.max(y1 - y0, 2)
          // El vaso real ocupa en pantalla lo mismo que el holograma que se le pone encima.
          kk = Math.min(40, Math.max(3.4, (holoSize() * 0.78) / (Math.hypot(bw, bh) * vbRef.current)))
          px = (x0 + x1) / 2; py = (y0 + y1) / 2
          holoAt.current = [px, py]
        }
      }
      const box = svg.getBoundingClientRect()
      const target = { x: box.left + box.width / 2, y: isPhone() ? box.top + Math.max(190, box.height * 0.33) : box.top + box.height * 0.47 }
      const m = svg.getScreenCTM(); if (!m) return
      const pt = new DOMPoint(target.x, target.y).matrixTransform(m.inverse())
      select(svg).transition().duration(reduce ? 0 : 850).call(zoomRef.current!.transform, zoomIdentity.translate(pt.x - px * kk, pt.y - py * kk).scale(kk))
    }
    const t = setTimeout(() => { void fly() }, ready.current ? 0 : 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKeyStr, !!rivProj])

  const zoomBy = (f: number) => select(svgRef.current!).transition().duration(300).call(zoomRef.current!.scaleBy, f)
  const reset = () => { onPick(null); select(svgRef.current!).transition().duration(650).call(zoomRef.current!.transform, home.current) }

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gRef.current!, m = g.getScreenCTM(); if (!m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const t = e.target as Element
    // Las etiquetas de cuenca mandan: están para eso.
    const chip = t.closest?.('[data-basin-chip]')?.getAttribute('data-basin-chip')
    if (chip) return onPick({ k: 'basin', id: chip })
    const kk = kRef.current, touch = e.pointerType !== 'mouse'
    // A vista general los puntos solo se cogen si se toca encima: así la cuenca de debajo es fácil de elegir.
    const scale = Math.hypot(m.a, m.b), reach = kk < 1.9 ? (touch ? 4 : 2) : touch ? 26 : 10, gs = glyphScale(kk)
    let best: Pt | null = null, bd = Infinity
    for (const q of points) {
      const d = Math.hypot(q.px - p.x, q.py - p.y) * scale - (q.s * gs * scale) / 2
      if (d < reach && d < bd) { bd = d; best = q }
    }
    if (best) return onPick(best.sel)
    // De cerca, los ríos con nombre también se pinchan.
    if (rivProj && kk >= 1.9 && (layer === 'agua' || layer === 'energia' || layer === 'rios')) {
      const lim = (touch ? 16 : 8) / scale
      let rb: River | null = null, rd = lim
      for (const { v, g: ls } of rivProj) for (const l of ls) for (let i = 1; i < l.length; i++) {
        const [ax, ay] = l[i - 1], [bx, by] = l[i]
        if (Math.min(ax, bx) - rd > p.x || Math.max(ax, bx) + rd < p.x || Math.min(ay, by) - rd > p.y || Math.max(ay, by) + rd < p.y) continue
        const dx = bx - ax, dy = by - ay, tt = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)))
        const d = Math.hypot(ax + tt * dx - p.x, ay + tt * dy - p.y)
        if (d < rd) { rd = d; rb = v }
      }
      if (rb) return onPick({ k: 'river', id: rb.id })
    }
    if (isUrb(layer)) {
      // De lejos se elige comunidad; de cerca, tocar fuera de un punto solo cierra la ficha.
      if (layer !== 'consumo' && kk >= CERCA) return onPick(null)
      const n = t.closest?.('[data-region]')?.getAttribute('data-region'), i = n ? consIdx.get(n) : undefined
      return onPick(i != null ? { k: SEL_URB[layer], i } : null)
    }
    const basin = layer === 'agua' || layer === 'energia' ? t.closest?.('[data-basin]')?.getAttribute('data-basin') : null
    onPick(basin ? { k: 'basin', id: basin } : null)
  }
  const hover = useCallback<Hover>((e, title, line) => {
    if (e.pointerType !== 'mouse' || wrapRef.current?.classList.contains('is-moving')) return
    const box = svgRef.current!.getBoundingClientRect()
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title, line })
  }, [])

  const it = resolve(sel)
  const focusBasin = it?.k === 'basin' ? it.b.id : null
  const focusRegion = it?.k === 'cons' || it?.k === 'dep' || it?.k === 'alc' ? it.u.n : null
  const target = it && (it.k === 'res' || it.k === 'rain' || it.k === 'flow' || it.k === 'dis') ? (() => { const ll = it.k === 'res' ? it.r : it.k === 'rain' ? it.g : it.k === 'flow' ? it.f : it.d; return project(ll.x, ll.y) })() : null
  const selRiver = it?.k === 'river' ? rivProj?.find(x => x.v.id === it.v.id) ?? null : null
  // Coordenadas del holograma memorizadas: si cambiaran de identidad en cada render (p. ej. al mover el ratón
  // y mostrar la etiqueta), el holograma se recalcularía y volvería a empezar su giro.
  const resId = it?.k === 'res' ? it.r.id : null
  const holoDam = useMemo(() => (it?.k === 'res' ? project(it.r.x, it.r.y) : null), [resId]) // eslint-disable-line react-hooks/exhaustive-deps
  const riverPlan = useMemo(() => selRiver?.v.line.map(([x, y]) => project(x, y)) ?? null, [selRiver?.v.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const labels = useMemo(() => (layer === 'agua' || layer === 'energia') && k > 2.1 ? RES.filter(({ r }) => r.c > (k > 5 ? 40 : k > 3.5 ? 120 : 450)) : [], [layer, k])

  return (
    <div ref={wrapRef} className={`board-wrap layer-${layer} ${cerca ? 'is-cerca' : ''} ${focusBasin || focusRegion ? 'has-focus' : ''} ${holo && (it?.k === 'res' || it?.k === 'river') ? 'has-holo' : ''} ${selRiver ? 'has-river' : ''}`} onPointerLeave={() => setTip(null)}>
      <motion.div className="board" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.2 }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="map" role="img" aria-label="Mapa de España, con Canarias en un recuadro"
          onPointerDown={e => { down.current = { x: e.clientX, y: e.clientY, t: performance.now(), n: (down.current?.n ?? 0) + 1 } }}
          onPointerUp={e => { const d = down.current; down.current = null; if (d && d.n === 1 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 9 && performance.now() - d.t < 600) pick(e) }}
          onPointerCancel={() => { down.current = null }}>
          <defs>
            <linearGradient id="col" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="#9fd4ff" stopOpacity=".1" /><stop offset="1" stopColor="#d8f0ff" stopOpacity=".95" /></linearGradient>
          </defs>
          <g ref={gRef}>
            <Ground layer={layer} focusBasin={focusBasin} focusRegion={focusRegion} hover={hover} />
            {ref && <Plano r={ref} vias={isUrb(layer) ? cerca : k >= 1.5} />}
            <Marcos layer={layer} hover={hover} />
            {lam && (layer === 'agua' || layer === 'energia') && (k > 1.9 || it?.k === 'res') && <Laminas lam={lam} layer={layer} selId={it?.k === 'res' ? it.r.id : null} focusBasin={focusBasin} />}
            {selRiver && <g className="river-sel" aria-hidden>
              <path d={selRiver.g.map(l => 'M' + l.map(q => q.join(' ')).join('L')).join('')} className="river-sel-glow" />
              <path d={'M' + selRiver.v.line.map(([x, y]) => project(x, y).join(' ')).join('L')} className="river-sel-flow" />
            </g>}
            {(!isUrb(layer) || cerca) && <Glyphs layer={layer} filled={filled} focusBasin={focusBasin} seen={seen} hover={hover} edar={edarPts} aggs={aggPts} rainLab={rainLab} />}
            {ref && (isUrb(layer) ? cerca : true) && <Ciudades r={ref} k={k} />}
            {isUrb(layer) && (layer === 'consumo' || !cerca) && <EtiquetasCCAA layer={layer} k={k} vb={vbRef.current} />}
            {(layer === 'agua' || layer === 'energia') && k < 1.9 && !it && <BasinChips cam={{ k, x: camX, vb: vbRef.current, ox: ((svgRef.current?.clientWidth ?? W) - W * vbRef.current) / 2, cw: svgRef.current?.clientWidth ?? W }} />}
            {labels.filter(({ r }) => !(it?.k === 'res' && it.r.id === r.id)).map(({ r, px, py, s }) => (
              <g key={r.id} transform={`translate(${px} ${py})`}><g className="gs"><text className="label" y={s / 2 + 11}>{r.n}</text></g></g>
            ))}
            {target && (
              <g transform={`translate(${target[0]} ${target[1]})`} className="reticle" aria-hidden>
                <g className="rs">
                  <circle r={26} className="ret-pulse" />
                  {[0, 90, 180, 270].map(a => <path key={a} transform={`rotate(${a})`} d="M-20 -12 V-20 H-12" className="ret-corner" />)}
                  {[0, 90, 180, 270].map(a => <line key={'t' + a} transform={`rotate(${a})`} x1={0} y1={-34} x2={0} y2={-46} className="ret-tick" />)}
                </g>
              </g>
            )}
          </g>
        </svg>
      </motion.div>

      {holo && (it?.k === 'res' || it?.k === 'river') && <div className="holo-dim" style={{ '--hx': `${holo.x}px`, '--hy': `${holo.y}px`, '--hr': `${holoSize() / 2}px` } as React.CSSProperties} />}
      {/* bajo el holograma sobra el icono plano del embalse */}
      {holo && it?.k === 'res' && <style>{`.has-holo .node[data-res="${it.r.id}"]{opacity:0}`}</style>}
      {holo && it?.k === 'res' && (layer === 'agua' || layer === 'energia') && (
        <Holo key={it.r.id} r={it.r} shape={lam?.get(it.r.id)?.xy ?? null} dam={holoDam} ctx={RIVER_LINES} size={holoSize()} x={holo.x} y={holo.y} />
      )}
      {holo && selRiver && <RiverHolo key={selRiver.v.id} v={selRiver.v} plan={riverPlan!} size={holoSize()} x={holo.x} y={holo.y} />}
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }} role="status"><strong>{tip.title}</strong><span>{tip.line}</span></div>}

      <div className="zoom-pad" aria-label="Controles del mapa">
        <button className="dice" onClick={onDice} aria-label="Saltar a uno al azar" title="Al azar"><Dices size={19} /></button>
        <button className="zp-zoom" onClick={() => zoomBy(1.6)} aria-label="Acercar"><Plus size={19} /></button>
        <button className="zp-zoom" onClick={() => zoomBy(1 / 1.6)} aria-label="Alejar"><Minus size={19} /></button>
        <button onClick={reset} aria-label="Ver toda España"><LocateFixed size={18} /></button>
      </div>
    </div>
  )
}
