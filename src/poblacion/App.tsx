import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChartLine, Map as MapIcon, MapPin, Palmtree, Search, Users, X } from 'lucide-react'
import { Barras, CountUp, LineChart, nf, compact } from '../graficos'
import { last, popNow, provName, useDatos, type Datos, type Muni } from './datos'
import { METRICAS, colorDe, setYears, valorDe, type Metrica } from './metricas'
import { Mapa, type MapaApi } from './Mapa'
import { Graficos } from './Graficos'
import { Curiosidades } from '../Curiosidades'
import { A } from '../Fuentes'

type Vista = 'mapa' | 'graficos'
const readHash = () => { const m = location.hash.match(/^#(mapa|graficos)(?:-(\d{5}))?$/); return { vista: (m?.[1] as Vista) ?? 'mapa', id: m?.[2] ?? null } }

const ESTADIO = 83186 // aforo del Santiago Bernabéu
const BUS = 55
/** «¿Sabías que…?» de un municipio, calculado con el padrón y la superficie. */
function curiosidades(d: Datos, m: Muni) {
  const now = popNow(m), Y = d.years, p0 = m.pop.find(v => v != null) ?? now, a0 = Y[m.pop.findIndex(v => v != null)]
  const tocayos = d.munis.filter(x => x.n === m.n && x.id !== m.id)
  const totPop = d.munis.reduce((t, x) => t + popNow(x), 0), totKm = d.munis.reduce((t, x) => t + (x.km2 ?? 0), 0)
  const densEs = totPop / totKm, dens = m.km2 ? now / m.km2 : null
  const masGrande = m.km2 ? Math.round((d.munis.filter(x => (x.km2 ?? 0) < m.km2!).length / d.munis.length) * 100) : null
  const dif = now - p0
  return [
    tocayos.length > 0 && <>Hay {tocayos.length === 1 ? 'otro municipio' : <><b>{tocayos.length}</b> municipios más</>} en España con el mismo nombre: {tocayos.slice(0, 4).map(x => provName(x.prov)).join(', ')}{tocayos.length > 4 ? '…' : ''}.</>,
    now >= 20000 ? <>Todos sus vecinos llenarían el estadio Santiago Bernabéu <b>{nf(now / ESTADIO, now / ESTADIO < 10 ? 1 : 0)} veces</b>.</> : <>Todos sus vecinos cabrían en <b>{nf(Math.max(1, Math.ceil(now / BUS)))} autobús{Math.ceil(now / BUS) > 1 ? 'es' : ''}</b>.</>,
    dens != null && <>Tiene {nf(dens, dens < 10 ? 1 : 0)} habitantes por km²: <b>{dens > densEs ? `${nf(dens / densEs, 1)} veces más` : `${nf(densEs / dens, dens < 1 ? 0 : 1)} veces menos`}</b> que la media de España ({nf(densEs, 0)}).</>,
    masGrande != null && masGrande >= 50 && <>Su término mide {nf(m.km2!, 0)} km²: es más grande que el <b>{masGrande} %</b> de los municipios de España.</>,
    Math.abs(dif) > 0 && <>Desde {a0} ha {dif > 0 ? 'ganado' : 'perdido'} <b>{nf(Math.abs(dif))} vecinos</b>: unos {nf(Math.abs(dif) / Math.max(1, last(Y) - a0), Math.abs(dif) / (last(Y) - a0) < 10 ? 1 : 0)} al año.</>,
  ]
}

function MuniCard({ d, m, onMuni }: { d: Datos; m: Muni; onMuni: (m: Muni) => void }) {
  const now = popNow(m), Y = d.years
  const i2000 = Y.indexOf(2000)
  const cambio = valorDe('cambio', m)
  const pico = valorDe('pico', m)
  const maxPop = Math.max(...m.pop.filter((v): v is number => v != null))
  const rankEs = useMemo(() => [...d.munis].sort((a, b) => popNow(b) - popNow(a)).findIndex(x => x.id === m.id) + 1, [d, m])
  const inProv = useMemo(() => d.munis.filter(x => x.prov === m.prov).sort((a, b) => popNow(b) - popNow(a)), [d, m])
  const rankProv = inProv.findIndex(x => x.id === m.id) + 1
  const dens = valorDe('dens', m)
  const ratio = valorDe('ratio', m)
  const pts = m.pop.flatMap((v, i) => (v == null ? [] : [[Y[i], v] as [number, number]]))
  const neighbors = inProv.slice(Math.max(0, rankProv - 3), rankProv + 2)
  return (<>
    <p className="kicker">{provName(m.prov)} · {m.ccaa}</p>
    <h2>{m.n}</h2>
    <div className="hero">
      <div><span className="big"><CountUp value={now} fmt={v => nf(v)} duration={.9} /></span><p className="hero-l">vecinos en {last(Y)}</p></div>
      {cambio != null && <p className="hero-diff" style={{ color: colorDe('cambio', m) === '#4a5560' ? undefined : colorDe('cambio', m) }}>{METRICAS.cambio.fmt(cambio)}<small>desde 2000</small></p>}
    </div>
    <ul className="facts">
      <li><b>{nf(rankEs)}º</b> de España y <b>{rankProv}º</b> de {provName(m.prov)} por población</li>
      {dens != null && <li><b>{METRICAS.dens.fmt(dens)}</b> habitantes por km² en {nf(m.km2, 0)} km²</li>}
      {pico != null && <li>{pico >= last(Y) - 1 ? <>Está en su <b>máximo histórico</b>: sigue creciendo</> : <>Su mejor año fue <b>{pico}</b>, con {nf(maxPop)} vecinos: hoy tiene {nf(((now - maxPop) / maxPop) * -100, 0)} % menos</>}</li>}
      {ratio != null && <li><b>{nf(ratio, 0)}</b> hombres por cada 100 mujeres</li>}
      {m.edad != null && <li>Edad media: <b>{nf(m.edad, 1)} años</b></li>}
      {m.nacidos != null && <li><b>{nf(m.nacidos, 1)} %</b> de sus vecinos nació en el extranjero</li>}
    </ul>
    <Curiosidades items={curiosidades(d, m)} />
    <h3>Su población desde {Y[0]}</h3>
    <LineChart unidad="Habitantes" titulo={`Población de ${m.n} desde ${Y[0]}`} series={[{ id: 'p', nombre: m.n, datos: pts, area: true }]} fx={v => String(v)} fy={v => (v >= 1e4 ? compact(v) : nf(v))} alto={160}
      marcas={i2000 >= 0 && m.pop[i2000] != null ? [{ x: 2000, y: m.pop[i2000]!, texto: '2000' }] : []} />
    <h3>Sus vecinos de tamaño en {provName(m.prov)}</h3>
    <Barras unidad="Habitantes" titulo="Municipios de tamaño parecido en la provincia" fmt={v => nf(v)} items={neighbors.map(x => ({ id: x.id, nombre: x.n, valor: popNow(x), destacado: x.id === m.id, onClick: x.id === m.id ? undefined : () => onMuni(x) }))} />
  </>)
}

function Ranking({ d, metrica, onMuni }: { d: Datos; metrica: Metrica; onMuni: (m: Muni) => void }) {
  const def = METRICAS[metrica]
  const list = useMemo(() => d.munis.map(m => ({ m, v: valorDe(metrica, m) })).filter((x): x is { m: Muni; v: number } => x.v != null && (metrica === 'hab' || (metrica === 'cambio' ? (x.m.pop[Math.max(0, d.years.indexOf(2000))] ?? 0) >= 1000 : popNow(x.m) >= 1000))).sort((a, b) => b.v - a.v), [d, metrica])
  if (metrica === 'pico') {
    const groups = [[1996, 2000], [2001, 2008], [2009, 2012], [2013, 2019], [2020, 2023], [2024, 2030]]
    return <Barras unidad="Número de municipios" suma titulo="Municipios según el año con más vecinos" fmt={v => nf(v)} items={groups.map(([a, b]) => ({ id: a, nombre: a === 2024 ? 'Siguen creciendo' : a === 1996 ? `Antes de ${b + 1}` : `${a}–${b}`, valor: d.munis.filter(m => { const p = valorDe('pico', m); return p != null && p >= a && p <= b }).length, color: def.colores[groups.findIndex(g => g[0] === a)] }))} />
  }
  return <>
    <Barras titulo={`Municipios con más ${def.nombre.toLowerCase()}`} fmt={def.fmt} limite={10} items={list.slice(0, 40).map(({ m, v }) => ({ id: m.id, nombre: m.n, sub: provName(m.prov), valor: v, color: metrica === 'hab' ? undefined : colorDe(metrica, m), onClick: () => onMuni(m) }))} />
    {metrica !== 'hab' && <p className="note">Entre los municipios de 1.000 vecinos o más{metrica === 'cambio' ? ' en 2000' : ''}.</p>}
  </>
}

function Leyenda({ metrica }: { metrica: Metrica }) {
  const def = METRICAS[metrica]
  if (!def.colores.length) return <p className="leyenda-nota">{def.nota}</p>
  const labels = def.colores.map((_, i) => i === 0 ? `< ${def.fmt(def.cortes[0])}` : i === def.colores.length - 1 ? `≥ ${def.fmt(def.cortes[i - 1])}` : `${def.fmt(def.cortes[i - 1])}`)
  return <figure className="leyenda">
    <div className="leyenda-bar">{def.colores.map((c, i) => <span key={i} style={{ background: c }}><small>{labels[i]}</small></span>)}</div>
    <figcaption>{def.unidad && <b>{def.unidad}. </b>}{def.nota}</figcaption>
  </figure>
}

export default function App() {
  const { d, err } = useDatos()
  const init = readHash()
  const [vista, setVista] = useState<Vista>(init.vista)
  const [metrica, setMetrica] = useState<Metrica>('cambio')
  const [sel, setSel] = useState<string | null>(init.id)
  const [q, setQ] = useState('')
  const api = useRef<MapaApi>(null)
  useEffect(() => { if (d) setYears(d.years) }, [d])

  const setHash = (v: Vista, id: string | null) => history.replaceState(null, '', `#${v}${id ? `-${id}` : ''}`)
  const pick = useCallback((m: Muni | null) => { setSel(m?.id ?? null); setHash('mapa', m?.id ?? null); if (m) { setVista('mapa'); setTimeout(() => api.current?.flyMuni(m), 60) } }, [])
  useEffect(() => { if (d && sel) { const m = d.byId.get(sel); if (m) setTimeout(() => api.current?.flyMuni(m), 300) } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [d])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') pick(null) }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [pick])

  const hits = useMemo(() => {
    if (!d || q.trim().length < 2) return []
    const n = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    const s = n(q.trim())
    return d.munis.filter(m => n(m.n).includes(s)).sort((a, b) => popNow(b) - popNow(a)).slice(0, 7)
  }, [d, q])

  if (err) return <main className="pob boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="pob boot"><Users size={28} /><p>Cargando 8.000 municipios…</p></main>
  setYears(d.years)
  const m = sel ? d.byId.get(sel) ?? null : null
  const total = d.munis.reduce((t, x) => t + popNow(x), 0)
  const card = m ? <MuniCard d={d} m={m} onMuni={pick} /> : null

  return (
    <main className={`pob is-${vista}`}>
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Población</h1>
          <p><CountUp value={total} fmt={v => nf(v)} duration={1.4} /> vecinos · padrón de {last(d.years)}</p>
        </div>
        <nav className="tabs" aria-label="Vista">
          <button className={vista === 'mapa' ? 'is-on' : ''} onClick={() => { setVista('mapa'); setHash('mapa', sel) }}><MapIcon size={16} />Mapa</button>
          <button className={vista === 'graficos' ? 'is-on' : ''} onClick={() => { setVista('graficos'); setHash('graficos', null); scrollTo({ top: 0 }) }}><ChartLine size={16} />Gráficos e históricos</button>
        </nav>
      </header>

      {vista === 'graficos' ? <Graficos d={d} onMuni={pick} /> : <>
        <section className="stage">
          <Mapa d={d} metrica={metrica} selId={sel} onMuni={pick} onEmpty={() => pick(null)} api={api} />
          <div className="metricas" role="radiogroup" aria-label="Qué se colorea">
            {(Object.keys(METRICAS) as Metrica[]).map(k => <button key={k} role="radio" aria-checked={metrica === k} className={metrica === k ? 'is-on' : ''} onClick={() => setMetrica(k)}>{METRICAS[k].corto}</button>)}
          </div>
          <div className="tools">
            <button onClick={() => api.current?.canarias()} aria-label="Ir a Canarias"><Palmtree size={18} /><span>Canarias</span></button>
            {m && <button onClick={() => { pick(null); api.current?.reset() }} aria-label="Volver a España"><MapPin size={18} /><span>España</span></button>}
          </div>
          <AnimatePresence>
            {card && <motion.aside key={m!.id} className="peek" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: .28 }}>
              <button className="close" onClick={() => pick(null)} aria-label="Cerrar"><X size={18} /></button>{card}
            </motion.aside>}
          </AnimatePresence>
        </section>
        <aside className="panel">
          <div className="finder">
            <Search size={16} aria-hidden />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Busca tu pueblo o ciudad" aria-label="Buscar municipio" />
            {hits.length > 0 && <ul>{hits.map(h => <li key={h.id}><button onClick={() => { pick(h); setQ('') }}>{h.n}<small>{provName(h.prov)} · {nf(popNow(h))} vecinos</small></button></li>)}</ul>}
          </div>
          {card && <section className="card is-sel"><button className="close" onClick={() => pick(null)} aria-label="Cerrar"><X size={18} /></button>{card}</section>}
          <section className="card">
            <h3 className="first">{METRICAS[metrica].nombre}</h3>
            <Leyenda metrica={metrica} />
            <Ranking d={d} metrica={metrica} onMuni={pick} />
          </section>
          <p className="src"><A id="ine_padron">INE: padrón municipal {d.years[0]}–{last(d.years)}</A>. Límites y núcleos: <A id="siane">IGN</A>. Mapa: Esri, <A id="osm">© OpenStreetMap</A>.</p>
        </aside>
      </>}
    </main>
  )
}
