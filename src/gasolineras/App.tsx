import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, Crosshair, Fuel as FuelIcon, MapPin, Navigation, Palmtree, X } from 'lucide-react'
import { FUEL_NAME, FUEL_SHORT, cents, eur, fechaLarga, int, km, priceColor, useDatos, type Datos, type Fuel, type Station } from './datos'
import { Mapa, type MapaApi } from './Mapa'
import { Barras, Columnas, LineChart, CountUp } from '../graficos'
import { Curiosidades } from '../Curiosidades'
import { A } from '../Fuentes'

type Sel = { k: 'st'; id: number } | { k: 'prov'; id: string } | null
const LITROS = 50

const readHash = (): Sel => {
  const m = location.hash.match(/^#(gasolinera|provincia)-(\w+)$/)
  return !m ? null : m[1] === 'gasolinera' ? { k: 'st', id: Number(m[2]) } : { k: 'prov', id: m[2] }
}

/** Gasolineras de venta al público con precio para ese combustible. */
const priced = (d: Datos, f: Fuel) => d.st.filter(s => !s.restr && s.p[f] != null)

function Price({ v, big }: { v: number | null; big?: boolean }) {
  return <span className={big ? 'price price-big' : 'price'}>{v == null ? '—' : <CountUp value={v} fmt={x => eur(x)} duration={.8} />}<small> €/l</small></span>
}

const p3 = (v: number) => eur(v)
const floor2 = (v: number) => Math.floor(v * 100 - 1) / 100

/** Cuántas gasolineras hay en cada céntimo de precio; resalta el tramo de `marca`. */
function Reparto({ precios, marca, titulo }: { precios: number[]; marca?: number | null; titulo: string }) {
  if (precios.length < 5) return null
  const so = [...precios].sort((a, b) => a - b)
  const lo = so[Math.floor(so.length * 0.01)], hi = so[Math.floor(so.length * 0.99)]
  const step = Math.max(0.01, Math.ceil(((hi - lo) / 28) * 100) / 100)
  const bins: { x: string; valor: number; lo: number }[] = []
  for (let b = Math.floor(lo * 100) / 100; b <= hi; b = Math.round((b + step) * 100) / 100) bins.push({ x: eur(b, 2), valor: 0, lo: b })
  for (const v of so) { const i = Math.min(bins.length - 1, Math.max(0, Math.floor((v - bins[0].lo) / step + 1e-9))); bins[i].valor++ }
  const mi = marca == null ? -1 : Math.min(bins.length - 1, Math.max(0, Math.floor((marca - bins[0].lo) / step + 1e-9)))
  return <Columnas titulo={titulo} items={bins.map((b, i) => ({ x: b.x, valor: b.valor, destacado: i === mi, color: i === mi ? '#ffffff' : undefined }))} fmt={v => int(Math.round(v))} cadaX={Math.ceil(bins.length / 5)} etiqueta={() => 'esta'} alto={140} />
}

function StationCard({ d, s, fuel, onProv, near }: { d: Datos; s: Station; fuel: Fuel; onProv: (id: string) => void; near: { lat: number; lon: number } | null }) {
  const prov = d.hoy.provincias[s.prov], v = s.p[fuel], med = prov?.[fuel] ?? null
  const inProv = useMemo(() => priced(d, fuel).filter(x => x.prov === s.prov).sort((a, b) => a.p[fuel]! - b.p[fuel]!), [d, fuel, s.prov])
  const rank = inProv.findIndex(x => x.id === s.id) + 1
  const fuels = d.hoy.fuels.filter(f => s.p[f] != null)
  return (<>
    <p className="kicker">{s.marca}{s.h24 && <span className="tag"><Clock size={12} /> 24 h</span>}{s.restr && <span className="tag tag-warn">Solo socios</span>}</p>
    <h2>{s.dir}</h2>
    <p className="sub">{s.mun} · <button className="link" onClick={() => onProv(s.prov)}>{prov?.n}</button>{near && <> · a {km(near, s).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km</>}</p>
    {v != null ? <div className="hero">
      <div><Price v={v} big /><p className="hero-l">{FUEL_NAME[fuel]}</p></div>
      {med != null && <p className="hero-diff" style={{ color: priceColor(v - med) }}>{cents(v - med)}<small>que la mediana de {prov.n}</small></p>}
    </div> : <p className="note">Esta gasolinera no vende {FUEL_NAME[fuel].toLowerCase()}.</p>}
    {v != null && med != null && <ul className="facts">
      {rank > 0 && <li><b>{rank}ª</b> más barata de {int(inProv.length)} en {prov.n}</li>}
      <li>Llenar {LITROS} litros: <b>{(v * LITROS).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</b>, {v <= med ? 'ahorras' : 'pagas'} <b>{Math.abs((v - med) * LITROS).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</b> {v <= med ? 'frente a' : 'más que'} la gasolinera típica de la provincia</li>
    </ul>}
    {v != null && med != null && (() => {
      // «¿Sabías que…?» de esta gasolinera, sacado de los precios de hoy
      const es = d.hoy.espana[fuel], barata = inProv[0], cara = inProv[inProv.length - 1]
      const anual = 1000 // litros que gasta al año un coche medio (unos 15.000 km)
      const mismaMarca = inProv.filter(x => x.marca === s.marca)
      return <Curiosidades items={[
        barata && cara && barata.id !== cara.id && <>Entre la más barata y la más cara de {prov.n} hay <b>{cents(cara.p[fuel]! - barata.p[fuel]!).replace('+', '')}</b> por litro: {((cara.p[fuel]! - barata.p[fuel]!) * LITROS).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} por depósito.</>,
        es != null && <>Repostando siempre aquí, un coche que gasta unos {anual.toLocaleString("es-ES")} litros al año pagaría <b>{Math.abs((v - es) * anual).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} {v <= es ? 'menos' : 'más'}</b> que al precio medio de España.</>,
        mismaMarca.length > 1 && <>{s.marca} tiene {mismaMarca.length} gasolineras en {prov.n}; esta es la {mismaMarca.findIndex(x => x.id === s.id) + 1}.ª más barata de la marca.</>,
        s.h24 && <>Abre las 24 horas.</>,
      ]} />
    })()}
    {v != null && <>
      <h3>Dónde cae entre las de {prov?.n}</h3>
      <Reparto titulo={`Gasolineras de ${prov?.n} por precio de ${FUEL_NAME[fuel].toLowerCase()}`} precios={inProv.map(x => x.p[fuel]!)} marca={v} />
      <p className="note">Cada columna cuenta las gasolineras de la provincia en ese tramo de precio; la blanca es esta.</p>
    </>}
    <h3>Todos sus precios</h3>
    <Barras titulo="Precios de esta gasolinera" fmt={p3} items={fuels.map(f => ({ id: f, nombre: FUEL_NAME[f], sub: d.hoy.provincias[s.prov]?.[f] != null ? `mediana de la provincia ${eur(d.hoy.provincias[s.prov][f]!)}` : undefined, valor: s.p[f]!, color: priceColor(s.p[f]! - (d.hoy.provincias[s.prov]?.[f] ?? s.p[f]!)), destacado: f === fuel }))} />
    <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`} target="_blank" rel="noreferrer"><Navigation size={16} /> Cómo llegar</a>
  </>)
}

function ProvCard({ d, id, fuel, onSt }: { d: Datos; id: string; fuel: Fuel; onSt: (s: Station) => void }) {
  const p = d.hoy.provincias[id]
  const list = useMemo(() => priced(d, fuel).filter(x => x.prov === id).sort((a, b) => a.p[fuel]! - b.p[fuel]!), [d, fuel, id])
  const all = useMemo(() => Object.entries(d.hoy.provincias).filter(([, v]) => v[fuel] != null).sort((a, b) => a[1][fuel]! - b[1][fuel]!), [d, fuel])
  const rank = all.findIndex(([k]) => k === id) + 1
  if (!p) return null
  const es = d.hoy.espana[fuel]
  const lo = list[0], hi = list[list.length - 1]
  return (<>
    <p className="kicker">Provincia</p>
    <h2>{p.n}</h2>
    <p className="sub">{int(list.length)} gasolineras con {FUEL_NAME[fuel].toLowerCase()} · {rank}ª más barata de {all.length}</p>
    <div className="hero">
      <div><Price v={p[fuel] ?? null} big /><p className="hero-l">Mediana de {FUEL_NAME[fuel].toLowerCase()}</p></div>
      {p[fuel] != null && es != null && <p className="hero-diff" style={{ color: priceColor((p[fuel]! - es) * 1.6) }}>{cents(p[fuel]! - es)}<small>que la de España</small></p>}
    </div>
    {lo && hi && <p className="note">Entre la más barata y la más cara de {p.n} hay {cents(hi.p[fuel]! - lo.p[fuel]!).replace('+', '')}: {((hi.p[fuel]! - lo.p[fuel]!) * LITROS).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} en un depósito de {LITROS} litros.</p>}
    <h3>Cómo se reparten los precios</h3>
    <Reparto titulo={`Gasolineras de ${p.n} por precio`} precios={list.map(x => x.p[fuel]!)} marca={p[fuel]} />
    <p className="note">La columna blanca es la gasolinera típica (la mediana).</p>
    <h3>Las más baratas</h3>
    {lo && <Barras titulo={`Las más baratas de ${p.n}`} fmt={p3} desde={floor2(lo.p[fuel]!)} limite={8} items={list.slice(0, 30).map(s => ({ id: s.id, nombre: s.marca, sub: `${s.mun} · ${s.dir}`, valor: s.p[fuel]!, color: priceColor(s.p[fuel]! - (p[fuel] ?? 0)), onClick: () => onSt(s) }))} />}
  </>)
}

function Resumen({ d, fuel, onSt, onProv }: { d: Datos; fuel: Fuel; onSt: (s: Station) => void; onProv: (id: string) => void }) {
  const list = useMemo(() => priced(d, fuel).sort((a, b) => a.p[fuel]! - b.p[fuel]!), [d, fuel])
  const provs = useMemo(() => Object.entries(d.hoy.provincias).filter(([, v]) => v[fuel] != null).sort((a, b) => a[1][fuel]! - b[1][fuel]!), [d, fuel])
  const brands = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const s of list) { const a = m.get(s.marca) ?? []; a.push(s.p[fuel]!); m.set(s.marca, a) }
    return [...m].filter(([, a]) => a.length >= 40).map(([n, a]) => { const so = a.sort((x, y) => x - y); return { n, v: so[so.length >> 1], c: a.length } }).sort((a, b) => a.v - b.v)
  }, [list, fuel])
  const es = d.hoy.espana[fuel]
  const h24 = list.filter(s => s.h24).length
  const cheap = provs[0], dear = provs[provs.length - 1]
  const hist = d.hist?.dias.filter(x => x.es[fuel] != null) ?? []
  return (<>
    <div className="hero">
      <div><Price v={es ?? null} big /><p className="hero-l">Mediana de España · {FUEL_NAME[fuel].toLowerCase()}</p></div>
      <p className="hero-diff">{int(list.length)}<small>gasolineras al público con este combustible</small></p>
    </div>
    {cheap && dear && <p className="note">Llenar {LITROS} litros cuesta {((dear[1][fuel]! - cheap[1][fuel]!) * LITROS).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} más en {dear[1].n} que en {cheap[1].n}, mirando la gasolinera típica de cada una.</p>}
    <h3>Cómo se reparten los precios en España</h3>
    <Reparto titulo="Gasolineras de España por precio" precios={list.map(x => x.p[fuel]!)} marca={es} />
    <p className="note">Cada columna cuenta las gasolineras en ese tramo de precio; la blanca es la típica de España.</p>
    <h3>Las más baratas de España</h3>
    {list.length > 0 && <Barras titulo="Las más baratas de España" fmt={p3} desde={floor2(list[0].p[fuel]!)} limite={10} items={list.slice(0, 40).map(s => ({ id: s.id, nombre: s.marca, sub: `${s.mun} (${d.hoy.provincias[s.prov]?.n})`, valor: s.p[fuel]!, color: '#3df5b0', onClick: () => onSt(s) }))} />}
    <h3>Provincias, de más barata a más cara</h3>
    {cheap && <Barras titulo="Provincias por precio mediano" fmt={p3} desde={floor2(cheap[1][fuel]!)} limite={12} items={provs.map(([id, v]) => ({ id, nombre: v.n, valor: v[fuel]!, color: priceColor((v[fuel]! - (es ?? 0)) * 1.6), onClick: () => onProv(id) }))} />}
    <p className="note">Las barras miden cuánto más cuesta cada una que la primera de la lista.</p>
    {brands.length > 0 && <>
      <h3>Marcas con 40 gasolineras o más</h3>
      <Barras titulo="Marcas por precio mediano" fmt={p3} desde={floor2(brands[0].v)} limite={10} items={brands.map(b => ({ id: b.n, nombre: b.n, sub: `${int(b.c)} gasolineras`, valor: b.v, color: priceColor((b.v - (es ?? 0)) * 1.6) }))} />
      <p className="note">Precio mediano de cada marca en toda España.</p>
    </>}
    <h3>Curiosidades</h3>
    <ul className="facts">
      <li><b>{Math.round((h24 / Math.max(1, list.length)) * 100)} %</b> de las gasolineras abren las 24 horas.</li>
      {d.hoy.provincias['35'] && d.hoy.provincias['35'][fuel] != null && es != null && <li>En Las Palmas la mediana es <b>{cents(d.hoy.provincias['35'][fuel]! - es)}</b> que en el conjunto de España: Canarias no paga el impuesto de hidrocarburos peninsular.</li>}
      {list.length > 1 && <li>La más cara de España cobra <b>{cents(list[list.length - 1].p[fuel]! - list[0].p[fuel]!).replace('+', '')}</b> más por litro que la más barata.</li>}
    </ul>
    <h3>Evolución</h3>
    {hist.length > 1
      ? <LineChart titulo={`Mediana de España de ${FUEL_NAME[fuel].toLowerCase()}, día a día`} series={[{ id: 'es', nombre: 'España', datos: hist.map(x => [Date.parse(x.d), x.es[fuel]!]), area: true }]} fx={v => new Date(v).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} fy={v => eur(v)} alto={170} />
      : <p className="note">La serie diaria empieza hoy: cada día que pasa se guarda la mediana de España y de cada provincia, y aquí se dibujará cómo cambia.</p>}
  </>)
}

export default function App() {
  const { d, err } = useDatos()
  const [fuel, setFuel] = useState<Fuel>('g95')
  const [sel, setSel] = useState<Sel>(readHash)
  const [near, setNear] = useState<{ lat: number; lon: number } | null>(null)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const api = useRef<MapaApi>(null)
  // Resaltar: las N más baratas de cada provincia, o las que no pasen de un precio
  const [modo, setModo] = useState<'todas' | 'top' | 'precio'>('todas')
  const [topN, setTopN] = useState(5)
  const [tope, setTope] = useState<number | null>(null)

  const pick = useCallback((s: Sel) => {
    setSel(s)
    history.replaceState(null, '', s ? `#${s.k === 'st' ? 'gasolinera' : 'provincia'}-${s.id}` : location.pathname + location.search)
  }, [])
  const onSt = useCallback((s: Station) => { pick({ k: 'st', id: s.id }); api.current?.flyStation(s) }, [pick])
  const onProv = useCallback((id: string) => { pick({ k: 'prov', id }); api.current?.flyProv(id) }, [pick])

  // al cargar con enlace, la cámara va a lo enlazado
  useEffect(() => {
    if (!d || !sel) return
    const t = setTimeout(() => { if (sel.k === 'st') { const s = d.byId.get(sel.id); if (s) api.current?.flyStation(s) } else api.current?.flyProv(sel.id) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { pick(null); api.current?.reset() } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [pick])

  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg('Este navegador no da la ubicación.')
    setGeoMsg('Buscando dónde estás…')
    navigator.geolocation.getCurrentPosition(p => {
      const here = { lat: p.coords.latitude, lon: p.coords.longitude }
      setNear(here); setGeoMsg(null)
      if (!d) return
      const best = priced(d, fuel).map(s => ({ s, dk: km(here, s) })).filter(x => x.dk < 10).sort((a, b) => a.s.p[fuel]! - b.s.p[fuel]!)[0]
      if (best) onSt(best.s); else { api.current?.locate(here.lat, here.lon); setGeoMsg('No hay gasolineras a menos de 10 km.') }
    }, () => setGeoMsg('Sin permiso para ver tu ubicación.'), { enableHighAccuracy: false, timeout: 10000 })
  }
  const nearList = useMemo(() => !d || !near ? [] : priced(d, fuel).map(s => ({ s, dk: km(near, s) })).filter(x => x.dk < 10).sort((a, b) => a.s.p[fuel]! - b.s.p[fuel]!).slice(0, 8), [d, near, fuel])

  const rango = useMemo(() => {
    if (!d) return null
    const v = priced(d, fuel).map(s => s.p[fuel]!).sort((a, b) => a - b)
    return v.length ? { lo: v[Math.floor(v.length * 0.005)], hi: v[Math.floor(v.length * 0.6)], mid: v[Math.floor(v.length * 0.1)] } : null
  }, [d, fuel])
  const limite = tope ?? rango?.mid ?? 0
  const destacadas = useMemo(() => {
    if (!d || modo === 'todas') return null
    const list = priced(d, fuel)
    if (modo === 'precio') return new Set(list.filter(s => s.p[fuel]! <= limite + 1e-9).map(s => s.id))
    const by = new Map<string, Station[]>()
    for (const s of list) { const a = by.get(s.prov) ?? []; a.push(s); by.set(s.prov, a) }
    const out = new Set<number>()
    for (const a of by.values()) a.sort((x, y) => x.p[fuel]! - y.p[fuel]!).slice(0, topN).forEach(s => out.add(s.id))
    return out
  }, [d, fuel, modo, topN, limite])

  if (err) return <main className="gas boot"><p>No se han podido cargar los precios. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="gas boot"><FuelIcon size={28} /><p>Cargando los precios de hoy…</p></main>

  const st = sel?.k === 'st' ? d.byId.get(sel.id) ?? null : null
  const card = st ? <StationCard d={d} s={st} fuel={fuel} onProv={onProv} near={near} />
    : sel?.k === 'prov' ? <ProvCard d={d} id={sel.id} fuel={fuel} onSt={onSt} /> : null

  return (
    <main className="gas">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Gasolineras</h1>
          <p>Precios de hoy · {fechaLarga(d.hoy.fecha)}</p>
        </div>
        <div className="fuels" role="radiogroup" aria-label="Combustible">
          {d.hoy.fuels.map(f => <button key={f} role="radio" aria-checked={fuel === f} className={fuel === f ? 'is-on' : ''} onClick={() => setFuel(f)}>{FUEL_SHORT[f]}<small>{eur(d.hoy.espana[f])}</small></button>)}
        </div>
      </header>
      <section className="stage">
        <Mapa datos={d} fuel={fuel} destacadas={destacadas} selId={st?.id ?? null} selProv={sel?.k === 'prov' ? sel.id : st?.prov ?? null} near={near} onStation={onSt} onProv={onProv} onEmpty={() => pick(null)} api={api} />
        <div className="resaltar" role="group" aria-label="Resaltar gasolineras">
          <p>Resaltar</p>
          <div className="seg">
            <button className={modo === 'todas' ? 'is-on' : ''} onClick={() => setModo('todas')}>Todas</button>
            <button className={modo === 'top' ? 'is-on' : ''} onClick={() => setModo('top')}>Más baratas por provincia</button>
            <button className={modo === 'precio' ? 'is-on' : ''} onClick={() => setModo('precio')}>Hasta un precio</button>
          </div>
          {modo === 'top' && <label className="ctl"><span>Las <b>{topN}</b> más baratas de cada provincia</span>
            <input type="range" min={1} max={20} value={topN} onChange={e => setTopN(Number(e.target.value))} /></label>}
          {modo === 'precio' && rango && <label className="ctl"><span>Hasta <b>{eur(limite)} €/l</b></span>
            <input type="range" min={rango.lo} max={rango.hi} step={0.001} value={limite} onChange={e => setTope(Number(e.target.value))} /></label>}
          {destacadas && <small>{int(destacadas.size)} gasolineras resaltadas en verde</small>}
        </div>
        <div className="legend" aria-label="Leyenda">
          <span>Más barata</span><i /><span>Más cara</span>
          <small>que la mediana de su provincia</small>
        </div>
        <p className="mapa-hint">Acércate para ver cada gasolinera</p>
        <div className="tools">
          <button onClick={locate} aria-label="Las más baratas cerca de mí"><Crosshair size={18} /><span>Cerca de mí</span></button>
          <button onClick={() => api.current?.canarias()} aria-label="Ir a Canarias"><Palmtree size={18} /><span>Canarias</span></button>
          {(sel || near) && <button onClick={() => { pick(null); setNear(null); api.current?.reset() }} aria-label="Volver a España"><MapPin size={18} /><span>España</span></button>}
        </div>
        {geoMsg && <p className="toast">{geoMsg}</p>}
        <AnimatePresence>
          {card && <motion.aside key={sel ? `${sel.k}${sel.id}` : 'x'} className="peek" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: .28 }}>
            <button className="close" onClick={() => pick(null)} aria-label="Cerrar"><X size={18} /></button>
            {card}
          </motion.aside>}
        </AnimatePresence>
      </section>
      <aside className="panel">
        {card && <section className="card is-sel">
          <button className="close" onClick={() => pick(null)} aria-label="Cerrar"><X size={18} /></button>
          {card}
        </section>}
        {nearList.length > 0 && <section className="card">
          <h3>Las más baratas a menos de 10 km</h3>
          <Barras titulo="Las más baratas cerca" fmt={p3} desde={floor2(nearList[0].s.p[fuel]!)} items={nearList.map(({ s, dk }) => ({ id: s.id, nombre: s.marca, sub: `${dk.toLocaleString('es-ES', { maximumFractionDigits: 1 })} km · ${s.dir}`, valor: s.p[fuel]!, color: '#3df5b0', onClick: () => onSt(s) }))} />
        </section>}
        <section className="card"><Resumen d={d} fuel={fuel} onSt={onSt} onProv={onProv} /></section>
        <footer className="src">Fuente: <A id="geoportal">Ministerio para la Transición Ecológica</A> (<A id="carburantes_api">servicio de precios</A>), precios que comunica cada gasolinera; se descargan dos veces al día. Mapa: IGN. Las de «solo socios» (cooperativas) no entran en medianas ni rankings.</footer>
      </aside>
    </main>
  )
}
