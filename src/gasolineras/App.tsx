import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, Crosshair, Fuel as FuelIcon, MapPin, Navigation, X } from 'lucide-react'
import { FUEL_NAME, FUEL_SHORT, cents, eur, fechaLarga, int, km, priceColor, useDatos, type Datos, type Fuel, type Station } from './datos'
import { Mapa, type MapaApi } from './Mapa'

type Sel = { k: 'st'; id: number } | { k: 'prov'; id: string } | null
const LITROS = 50

const readHash = (): Sel => {
  const m = location.hash.match(/^#(gasolinera|provincia)-(\w+)$/)
  return !m ? null : m[1] === 'gasolinera' ? { k: 'st', id: Number(m[2]) } : { k: 'prov', id: m[2] }
}

/** Gasolineras de venta al público con precio para ese combustible. */
const priced = (d: Datos, f: Fuel) => d.st.filter(s => !s.restr && s.p[f] != null)

function Price({ v, big }: { v: number | null; big?: boolean }) {
  return <span className={big ? 'price price-big' : 'price'}>{eur(v)}<small> €/l</small></span>
}

function Row({ name, sub, v, max, min, onClick, color }: { name: string; sub?: string; v: number; min: number; max: number; onClick?: () => void; color?: string }) {
  const w = max > min ? 12 + ((v - min) / (max - min)) * 88 : 50
  return (
    <li><button onClick={onClick} disabled={!onClick}>
      <span className="row-name">{name}{sub && <small>{sub}</small>}</span>
      <span className="row-bar"><i style={{ width: `${w}%`, background: color }} /></span>
      <b>{eur(v)}</b>
    </button></li>
  )
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
    <h3>Todos sus precios</h3>
    <ul className="rows">{fuels.map(f => <Row key={f} name={FUEL_NAME[f]} sub={d.hoy.provincias[s.prov]?.[f] != null ? `mediana ${eur(d.hoy.provincias[s.prov][f]!)}` : undefined} v={s.p[f]!} min={0} max={Math.max(...fuels.map(x => s.p[x]!))} color={priceColor(s.p[f]! - (d.hoy.provincias[s.prov]?.[f] ?? s.p[f]!))} />)}</ul>
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
    <h3>Las más baratas</h3>
    <ul className="rows">{list.slice(0, 8).map(s => <Row key={s.id} name={s.marca} sub={`${s.mun} · ${s.dir}`} v={s.p[fuel]!} min={lo.p[fuel]!} max={list[Math.min(7, list.length - 1)].p[fuel]!} onClick={() => onSt(s)} color={priceColor(s.p[fuel]! - (p[fuel] ?? 0))} />)}</ul>
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
    <h3>Las más baratas de España</h3>
    <ul className="rows">{list.slice(0, 10).map(s => <Row key={s.id} name={s.marca} sub={`${s.mun} (${d.hoy.provincias[s.prov]?.n})`} v={s.p[fuel]!} min={list[0].p[fuel]!} max={list[9]?.p[fuel] ?? list[0].p[fuel]!} onClick={() => onSt(s)} color="#3df5b0" />)}</ul>
    <h3>Provincias, de más barata a más cara</h3>
    <ul className="rows">{provs.map(([id, v]) => <Row key={id} name={v.n} v={v[fuel]!} min={cheap[1][fuel]!} max={dear[1][fuel]!} onClick={() => onProv(id)} color={priceColor((v[fuel]! - (es ?? 0)) * 1.6)} />)}</ul>
    {brands.length > 0 && <>
      <h3>Marcas con 40 gasolineras o más</h3>
      <ul className="rows">{brands.slice(0, 14).map(b => <Row key={b.n} name={b.n} sub={`${int(b.c)} gasolineras`} v={b.v} min={brands[0].v} max={brands[brands.length - 1].v} color={priceColor((b.v - (es ?? 0)) * 1.6)} />)}</ul>
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
      ? <Spark pts={hist.map(x => x.es[fuel]!)} labels={[hist[0].d, hist[hist.length - 1].d]} />
      : <p className="note">La serie diaria empieza hoy: cada día que pasa se guarda la mediana de España y de cada provincia, y aquí se dibujará cómo cambia.</p>}
  </>)
}

function Spark({ pts, labels }: { pts: number[]; labels: [string, string] }) {
  const W = 340, H = 90, lo = Math.min(...pts), hi = Math.max(...pts), r = hi - lo || 0.01
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * W} ${H - 8 - ((v - lo) / r) * (H - 20)}`).join('')
  return <figure className="spark"><svg viewBox={`0 0 ${W} ${H}`}><path d={d} /></svg><figcaption><span>{labels[0]}</span><span>{eur(lo)} – {eur(hi)} €/l</span><span>{labels[1]}</span></figcaption></figure>
}

export default function App() {
  const { d, err } = useDatos()
  const [fuel, setFuel] = useState<Fuel>('g95')
  const [sel, setSel] = useState<Sel>(readHash)
  const [near, setNear] = useState<{ lat: number; lon: number } | null>(null)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const api = useRef<MapaApi>(null)

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
      if (best) onSt(best.s); else setGeoMsg('No hay gasolineras a menos de 10 km.')
    }, () => setGeoMsg('Sin permiso para ver tu ubicación.'), { enableHighAccuracy: false, timeout: 10000 })
  }
  const nearList = useMemo(() => !d || !near ? [] : priced(d, fuel).map(s => ({ s, dk: km(near, s) })).filter(x => x.dk < 10).sort((a, b) => a.s.p[fuel]! - b.s.p[fuel]!).slice(0, 8), [d, near, fuel])

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
        <Mapa datos={d} fuel={fuel} selId={st?.id ?? null} selProv={sel?.k === 'prov' ? sel.id : st?.prov ?? null} near={near} onStation={onSt} onProv={onProv} onEmpty={() => pick(null)} api={api} />
        <div className="legend" aria-label="Leyenda">
          <span>Más barata</span><i /><span>Más cara</span>
          <small>que la mediana de su provincia</small>
        </div>
        <div className="tools">
          <button onClick={locate} aria-label="Las más baratas cerca de mí"><Crosshair size={18} /><span>Cerca de mí</span></button>
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
          <ul className="rows">{nearList.map(({ s, dk }) => <Row key={s.id} name={s.marca} sub={`${dk.toLocaleString('es-ES', { maximumFractionDigits: 1 })} km · ${s.dir}`} v={s.p[fuel]!} min={nearList[0].s.p[fuel]!} max={nearList[nearList.length - 1].s.p[fuel]!} onClick={() => onSt(s)} color="#3df5b0" />)}</ul>
        </section>}
        <section className="card"><Resumen d={d} fuel={fuel} onSt={onSt} onProv={onProv} /></section>
        <footer className="src">Fuente: Ministerio para la Transición Ecológica, precios que comunica cada gasolinera; se descargan dos veces al día. Mapa: IGN. Las de «solo socios» (cooperativas) no entran en medianas ni rankings.</footer>
      </aside>
    </main>
  )
}
