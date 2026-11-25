import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoPath } from 'd3-geo'
import { Holo3D } from '../holo3d/Holo3D'
import { cupula } from '../holo3d/modelos'
import { PROVINCIAS } from '../geo/provincias'
import { LineChart, nf } from '../graficos'
import { useWidth } from '../graficos/util'
import { PROV } from '../poblacion/geo'

export type Estacion = { c: string; n: string | null; mu: string | null; ti: string | null; xy: [number, number]; aprox: boolean; ica: number; manda: string; m: Record<string, [number, number]>; s: [number, number][] }
export type Live = { hora: string; generado: string; reparto: number[]; estaciones: Estacion[] }

/** Las seis categorías del Índice de Calidad del Aire, con sus colores oficiales. */
export const ICA = [
  { n: 'Buena', c: '#50f0e6' }, { n: 'Razonablemente buena', c: '#50ccaa' }, { n: 'Regular', c: '#f0e641' },
  { n: 'Desfavorable', c: '#ff5050' }, { n: 'Muy desfavorable', c: '#960032' }, { n: 'Extremadamente desfavorable', c: '#7d2181' },
]
const POL: Record<string, { n: string; que: string; u: string }> = {
  no2: { n: 'Dióxido de nitrógeno', que: 'tráfico', u: 'µg/m³ en la última hora' },
  o3: { n: 'Ozono', que: 'sol y contaminación', u: 'µg/m³ en la última hora' },
  pm10: { n: 'Partículas PM10', que: 'polvo y hollín', u: 'µg/m³ de media en 24 h' },
  pm25: { n: 'Partículas finas PM2,5', que: 'combustión', u: 'µg/m³ de media en 24 h' },
  so2: { n: 'Dióxido de azufre', que: 'industria', u: 'µg/m³ en la última hora' },
}
const TIPO: Record<string, string> = { traffic: 'de tráfico', industrial: 'industrial', background: 'de fondo' }
const hora = (iso: string) => { const d = new Date(iso), z = { timeZone: 'Europe/Madrid' } as const; return `${d.toLocaleTimeString('es-ES', { ...z, hour: '2-digit', minute: '2-digit' })} del ${d.toLocaleDateString('es-ES', { ...z, day: 'numeric', month: 'long' })}` }

function Mapa({ d, filtro, sel, onSel }: { d: Live; filtro: string; sel: string | null; onSel: (c: string | null) => void }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const H = Math.round(W * 0.74)
  const { path, proj } = useMemo(() => { const p = geoConicConformalSpain().fitExtent([[6, 6], [W - 6, H - 6]], PROVINCIAS as never); return { path: geoPath(p), proj: p } }, [W, H])
  const [tip, setTip] = useState<{ x: number; y: number; e: Estacion } | null>(null)
  const r = W < 500 ? 3.2 : 4.2
  const pts = d.estaciones.map(e => { const xy = proj(e.xy); const v = filtro === 'ica' ? e.ica : e.m[filtro]?.[0] ?? 0; return xy && v ? { e, x: xy[0], y: xy[1], v } : null }).filter((p): p is { e: Estacion; x: number; y: number; v: number } => !!p).sort((a, b) => a.v - b.v)
  return <div className="amapa" ref={wrap} onPointerLeave={e => e.pointerType !== 'touch' && setTip(null)}>
    {W > 0 && <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mapa de ${pts.length} estaciones de calidad del aire coloreadas según su índice`}>
      <g className="am-prov">{PROVINCIAS.features.map(f => <path key={f.properties.id} d={path(f as never) ?? ''} />)}</g>
      <path d={(proj as unknown as { getCompositionBorders: () => string }).getCompositionBorders()} className="am-borde" />
      <g>{pts.map(({ e, x, y, v }) => (
        <g key={e.c} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={`am-est ${sel === e.c ? 'is-sel' : ''}`} onPointerEnter={() => setTip({ x, y, e })} onClick={() => onSel(sel === e.c ? null : e.c)}>
          <circle r={r * 2.4} className="am-hit" />
          {v >= 4 && <circle r={r * 2} className="am-halo" style={{ stroke: ICA[v - 1].c }} />}
          <circle r={v >= 3 ? r * 1.2 : r} style={{ fill: ICA[v - 1].c }} className="am-pt" />
        </g>
      ))}</g>
    </svg>}
    {tip && <div className="am-tip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.e.n ?? tip.e.mu ?? tip.e.c}</b><span>{ICA[(filtro === 'ica' ? tip.e.ica : tip.e.m[filtro]?.[0] ?? 1) - 1].n}{filtro !== 'ica' && tip.e.m[filtro] ? ` · ${nf(tip.e.m[filtro][1], 0)} µg/m³` : ''}</span>
    </div>}
  </div>
}

export function Ahora({ d }: { d: Live }) {
  const [filtro, setFiltro] = useState('ica'), [sel, setSel] = useState<string | null>(null)
  const N = d.estaciones.length, buenas = d.reparto[0] + d.reparto[1], malas = d.reparto.slice(3).reduce((a, b) => a + b, 0)
  const manda = Object.entries(d.estaciones.filter(e => e.ica >= 3).reduce<Record<string, number>>((o, e) => { o[e.manda] = (o[e.manda] ?? 0) + 1; return o }, {})).sort((a, b) => b[1] - a[1])[0]
  const modelo = useMemo(() => cupula(Math.min(1, (N - d.reparto[0]) / Math.max(1, N) * 1.2)), [N, d.reparto])
  const peores = [...d.estaciones].sort((a, b) => b.ica - a.ica || (b.m[b.manda]?.[1] ?? 0) - (a.m[a.manda]?.[1] ?? 0)).slice(0, 8)
  const e = sel ? d.estaciones.find(x => x.c === sel) : null
  const elegir = (c: string | null) => { setSel(c); if (c && innerWidth < 860) requestAnimationFrame(() => document.querySelector('.am-lado')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })) }
  const nombre = (x: Estacion) => x.n ?? `${x.mu ?? 'Estación'} (${x.c.slice(-3)})`
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={modelo} color={buenas / N > 0.8 ? '#50f0e6' : '#f0e641'} alto={260} giro={0.16} etiqueta={`Cúpula de aire: más partículas cuantas más estaciones están por encima de «buena»`} />
        <div className="sala-dato">
          <span className="sala-k">Última medición: {hora(d.hora)}</span>
          <b>{nf((buenas / N) * 100, 0)} %</b>
          <span>de las {N} estaciones marcan aire bueno o razonablemente bueno. {malas ? <><b>{malas}</b> están en desfavorable o peor</> : <>Ninguna está en desfavorable</>}{manda && d.reparto.slice(2).some(Boolean) ? <>; lo que más empeora el aire ahora es el <b>{POL[manda[0]].n.toLowerCase()}</b></> : null}.</span>
        </div>
      </div>
      <ul className="sala-lista" aria-label="Estaciones en cada categoría del índice">{ICA.map((c, i) => <li key={c.n} style={{ '--c': c.c } as React.CSSProperties} className={d.reparto[i] ? '' : 'is-cero'}>
        <i /><span>{c.n}</span><b>{d.reparto[i]}</b><em style={{ width: `${(d.reparto[i] / Math.max(...d.reparto)) * 100}%` }} />
      </li>)}</ul>
    </section>
    <section className="gcard is-wide">
      <h2>Estaciones de medición</h2>
      <p className="lead">Cada punto es una estación; el color, su índice ahora. Elige un contaminante para ver solo ese.</p>
      <div className="modo" role="radiogroup" aria-label="Qué enseñar">{[['ica', 'Índice'], ...Object.entries(POL).map(([k, v]) => [k, v.n.replace('Partículas finas ', '').replace('Partículas ', '')])].map(([k, n]) => <button key={k} role="radio" aria-checked={filtro === k} className={filtro === k ? 'is-on' : ''} onClick={() => setFiltro(k)}>{n}</button>)}</div>
      <div className="am-wrap">
        <Mapa d={d} filtro={filtro} sel={sel} onSel={elegir} />
        <aside className="am-lado">
          {e ? <div className="am-ficha">
            <button className="am-cerrar" onClick={() => setSel(null)} aria-label="Cerrar la ficha y volver a la lista"><X size={16} /></button>
            <h3>{nombre(e)}</h3>
            <p className="note">{e.mu && e.n ? `${e.mu} · ` : ''}{PROV[e.c.slice(0, 2)]}{e.ti ? ` · estación ${TIPO[e.ti.toLowerCase()] ?? e.ti}` : ''}</p>
            <p className="am-ica"><i style={{ background: ICA[e.ica - 1].c }} />{ICA[e.ica - 1].n}</p>
            <ul>{Object.entries(e.m).map(([k, [c, v]]) => <li key={k}><i style={{ background: ICA[c - 1].c }} />{POL[k].n}<b>{nf(v, v < 10 ? 1 : 0)}</b><small>{POL[k].u}</small></li>)}</ul>
            {e.s.length > 3 && <LineChart titulo={`${POL[e.manda].n} en las últimas 24 horas`} alto={150} fx={h => (h === 0 ? 'última hora' : `hace ${-h} h`)} fy={v => nf(v)} etiquetasFinal={false} series={[{ id: 's', nombre: POL[e.manda].n, color: ICA[e.ica - 1].c, area: true, datos: e.s }]} />}
            {e.aprox && <p className="note">Situada en el centro de su municipio: los metadatos europeos con su posición exacta no respondían.</p>}
          </div> : <>
            <h3>Las peores ahora</h3>
            <ol className="am-lista">{peores.map(x => <li key={x.c}><button onClick={() => setSel(x.c)}><i style={{ background: ICA[x.ica - 1].c }} /><span>{nombre(x)}<small>{POL[x.manda].n} · {nf(x.m[x.manda][1], 0)} µg/m³</small></span></button></li>)}</ol>
          </>}
        </aside>
      </div>
      <p className="note">Datos provisionales que las redes autonómicas y municipales envían cada hora a la Agencia Europea de Medio Ambiente; llegan con una o dos horas de retraso. Índice con las bandas del Índice de Calidad del Aire nacional: partículas, media de 24 horas; el resto, la última hora.</p>
    </section>
  </div>
}
