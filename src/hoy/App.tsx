import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Activity, CloudFog, CloudLightning, CloudRain, Flame, Mountain, Newspaper, Radio, Snowflake, Thermometer, ThermometerSnowflake, ThermometerSun, TriangleAlert, Waves, Wind, Zap, Map as MapIcon } from 'lucide-react'
import { Barras, CountUp, nf } from '../graficos'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import { Mapa, SISMO, CALOR, FRIO, enMapa, lugarBonito, type Ciudad, type Sismo } from './Mapa'

type Aviso = { tipo: number; nombre: string; nivel: number; zonas: string[]; desde: string; hasta: string; texto: string }
type Item = { t: string; dep: string; u?: string }
type Serie = { titulo: string; horas: { h: string; v: number }[] }
type D = {
  actualizado: string
  sismos?: { n10d: number; n24h: number; magMax: number | null; magMax24h: number | null; lista: Sismo[] }
  avisos?: { vigentes: number; grupos: Aviso[]; naranjaOMas: number; zonas: number }
  tiempo?: { fecha: string; ref: string | null; ciudades: Ciudad[]; anomMedia: number | null }
  boe?: { fecha: string; url: string | null; total: number; secciones: { c: string; n: string; total: number }[]; disposiciones: Item[]; empleo: Item[]; ayudas: Item[]; contratos: number }
  mercado: { eurusd?: { v: number; f: string; antes: number | null }; spot?: Serie; pvpc?: Serie }
}

const ACC = '#ff5fd2'
const SECCIONES = [
  { id: 'mapa', nombre: 'El mapa de hoy', icon: MapIcon },
  { id: 'avisos', nombre: 'Avisos', icon: TriangleAlert },
  { id: 'boe', nombre: 'En el BOE', icon: Newspaper },
  { id: 'luz', nombre: 'Luz y euro', icon: Zap },
] as const
type Sec = (typeof SECCIONES)[number]['id']

const NIVEL: Record<number, { n: string; c: string }> = { 2: { n: 'Amarillo', c: '#ffd23f' }, 3: { n: 'Naranja', c: '#ff8c1a' }, 4: { n: 'Rojo', c: '#ff3b52' } }
const ICONO_AVISO: Record<number, typeof Wind> = { 1: Wind, 2: Snowflake, 3: CloudLightning, 4: CloudFog, 5: ThermometerSun, 6: ThermometerSnowflake, 7: Waves, 8: Flame, 9: Mountain, 10: CloudRain, 11: Waves, 12: CloudRain }
const signo = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)}`
const fh = (iso: string) => new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
const fdia = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
const hace = (iso: string, ahora: number) => { const m = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000)); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d` }
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const MENOR = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'con', 'para', 'por', 'en'])
/** «PRESIDENCIA, JUSTICIA Y RELACIONES CON LAS CORTES» → «Presidencia, Justicia y Relaciones con las Cortes». */
const organismo = (t: string) => t.toLowerCase().split(' ').map((w, i) => i > 0 && MENOR.has(w.replace(/,$/, '')) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

function Kpi({ icon: I, l, children, d, c }: { icon: typeof Wind; l: string; children: ReactNode; d?: ReactNode; c?: string }) {
  return <div className="kpi" style={c ? { '--acc': c } as CSSProperties : undefined}><span className="kpi-l"><I size={15} />{l}</span><b className="kpi-v">{children}</b>{d && <span className="kpi-d">{d}</span>}</div>
}

export default function App() {
  const [d, setD] = useState<D | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/hoy.json').then(r => r.ok ? r.json() : Promise.reject()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'mapa')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos de hoy. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Radio size={28} /><p>Escuchando a España…</p></main>
  const ahora = Date.parse(d.actualizado)
  const S = d.sismos, T = d.tiempo, A = d.avisos
  const calientes = T ? [...T.ciudades].filter(c => c.max != null).sort((a, b) => b.max! - a.max!) : []
  const frias = T ? [...T.ciudades].filter(c => c.min != null).sort((a, b) => a.min! - b.min!) : []
  const mayor = S?.lista.reduce<Sismo | null>((b, x) => (!b || x.m > b.m ? x : b), null)
  const m3 = S?.lista.filter(x => x.m >= 3).length ?? 0
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>España hoy</h1>
          <p>Lo que pasa ahora mismo · IGN, AEMET, Open-Meteo, BOE, Red Eléctrica y BCE</p>
        </div>
        <p className="vivo-txt"><i className="vivo" />Actualizado {hace(d.actualizado, Date.now())}</p>
      </header>
      <div className="kpis">
        {S && <Kpi icon={Activity} l="Terremotos en 24 h" d={<>{S.n10d} en diez días · {m3} de magnitud 3 o más</>}><CountUp value={S.n24h} fmt={v => String(Math.round(v))} /></Kpi>}
        {A && <Kpi icon={TriangleAlert} l="Zonas con aviso naranja o rojo" c={A.naranjaOMas ? NIVEL[3].c : undefined} d={<>{A.zonas} zonas con algún aviso</>}><CountUp value={A.naranjaOMas} fmt={v => String(Math.round(v))} /></Kpi>}
        {T?.anomMedia != null && <Kpi icon={Thermometer} l="Temperatura frente a lo normal" c={T.anomMedia >= 0 ? CALOR : FRIO} d={<>media de las capitales, hoy frente a {T.ref}</>}>{signo(T.anomMedia)} °C</Kpi>}
        {d.boe && <Kpi icon={Newspaper} l={`BOE del ${new Date(d.boe.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`} d={<>{d.boe.contratos} anuncios de contratación pública</>}><CountUp value={d.boe.total} fmt={v => String(Math.round(v))} /> textos</Kpi>}
      </div>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'mapa' && <MapaHoy d={d} ahora={ahora} />}
        {sec === 'avisos' && <Avisos d={d} />}
        {sec === 'boe' && <Boe d={d} />}
        {sec === 'luz' && <Luz d={d} />}
      </motion.div>
      <Curiosidades titulo="¿Sabías que…?" items={[
        mayor ? <>El mayor terremoto de los últimos diez días fue de <b>magnitud {nf(mayor.m, 1)}</b>, {hace(mayor.t, ahora)}, en {lugarBonito(mayor.lugar)}.</> : null,
        S && S.n10d ? <>El IGN ha registrado <b>{nf(S.n10d / 10, 1)} terremotos al día</b> de media en estos diez días, y {m3} fueron de magnitud 3 o más.</> : null,
        calientes.length > 1 ? <>La máxima de hoy en una capital es de <b>{nf(calientes[0].max!, 0)} °C</b> ({calientes[0].n}) y la mínima, de <b>{signo(frias[0].min!, 0)} °C</b> ({frias[0].n}): <b>{nf(calientes[0].max! - frias[0].min!, 0)} grados</b> de diferencia dentro del país.</> : null,
        A && A.grupos.length ? <>Hay avisos por <b>{[...new Set(A.grupos.map(g => g.nombre.toLowerCase()))].join(', ')}</b>.</> : A ? <>Hoy no hay ningún aviso amarillo ni superior de la AEMET.</> : null,
      ]} />
      <Fuentes ids={[]} extra={[
        { n: 'IGN · Últimos terremotos', u: 'https://www.ign.es/web/ign/portal/sis-ultimos-terremotos' },
        { n: 'AEMET · Avisos (vía MeteoAlarm)', u: 'https://www.aemet.es/es/eltiempo/prediccion/avisos' },
        { n: 'Open-Meteo · Previsión y reanálisis ERA5', u: 'https://open-meteo.com/' },
        { n: 'BOE · Sumario diario', u: 'https://www.boe.es/diario_boe/' },
        { n: 'Red Eléctrica · Precios del mercado', u: 'https://www.ree.es/es/datos/mercados/precios-mercados-tiempo-real' },
        { n: 'BCE · Tipos de cambio de referencia', u: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' },
      ]} />
      <p className="src">Datos provisionales: el IGN revisa los terremotos después, y las previsiones cambian. «Lo normal» es la media de 1991 a 2020 de estos días en cada capital; la comparación usa la media prevista de hoy, no lo que ya ha pasado. La luz es el precio por horas, sin impuestos ni peajes propios de tu contrato.</p>
    </main>
  )
}

/* ———— Mapa ———— */
function MapaHoy({ d, ahora }: { d: D; ahora: number }) {
  const T = d.tiempo, S = d.sismos
  const [capa, setCapa] = useState<'temp' | 'sismos'>(T ? 'temp' : 'sismos')
  const [dias, setDias] = useState(10)
  const [sel, setSel] = useState<string | null>(null), [selC, setSelC] = useState<string | null>(null)
  const lista = useMemo(() => (S?.lista ?? []).filter(x => ahora - Date.parse(x.t) < dias * 864e5), [S, dias, ahora])
  const ciudades = T?.ciudades ?? []
  const ranking = useMemo(() => [...ciudades].filter(c => c.anom != null).sort((a, b) => b.anom! - a.anom!), [ciudades])
  const amp = Math.max(1, ...ranking.map(c => Math.abs(c.anom!)))
  const s = lista.find(x => x.t === sel), c = ciudades.find(x => x.cod === selC)
  const calor = ranking.filter(x => x.anom! > 0.5).length, frio = ranking.filter(x => x.anom! < -0.5).length
  return (
    <div className="hoy-grid">
      <section className="gcard">
        <div className="modo capas" role="tablist">
          {T && <button className={capa === 'temp' ? 'is-on' : ''} onClick={() => setCapa('temp')}><Thermometer size={15} />Temperatura</button>}
          {S && <button className={capa === 'sismos' ? 'is-on' : ''} onClick={() => setCapa('sismos')}><Activity size={15} />Terremotos</button>}
        </div>
        {capa === 'temp' && T && <h2>La temperatura de hoy, frente a lo normal</h2>}
        {capa === 'sismos' && S && <h2>Terremotos de los últimos {dias} días</h2>}
        <p className="lead">
          {capa === 'temp' && T && (T.anomMedia != null
            ? <>De media, en las capitales de provincia hoy hace <b>{Math.abs(T.anomMedia) < 0.5 ? 'lo normal' : `${nf(Math.abs(T.anomMedia), 1)} °C ${T.anomMedia > 0 ? 'más calor' : 'menos calor'} de lo habitual`}</b> para estos días. {calor} capitales están por encima de lo normal y {frio} por debajo.</>
            : <>Faltan las medias de lo normal: se están calculando.</>)}
          {capa === 'sismos' && S && <>El IGN cuenta <b>{lista.length} terremotos</b> en España y sus aguas en este tiempo. {lista.filter(x => x.m >= 3).length} fueron de magnitud 3 o más; el mayor, <b>{lista.length ? nf(Math.max(...lista.map(x => x.m)), 1) : '—'}</b>.</>}
        </p>
        {capa === 'sismos' && <div className="modo" aria-label="Periodo">{[1, 3, 10].map(n => <button key={n} className={dias === n ? 'is-on' : ''} onClick={() => setDias(n)}>{n === 1 ? '24 h' : `${n} días`}</button>)}</div>}
        <Mapa capa={capa} ciudades={ciudades} sismos={lista} ahora={ahora} sel={sel} onSel={setSel} selCiudad={selC} onCiudad={setSelC} />
        {capa === 'sismos' && lista.some(x => !enMapa(x)) && <p className="note">{lista.filter(x => !enMapa(x)).length} terremotos más cayeron lejos de la costa (Atlántico, Alborán, Marruecos, Argelia o Portugal): no caben en el mapa, pero están en la lista.</p>}
      </section>
      <section className="gcard lateral">
        {capa === 'sismos' && <>
          {s ? <div className="ficha-hoy" style={{ '--c': SISMO } as CSSProperties}>
            <b className="ficha-n">M {nf(s.m, 1)}</b>
            <span><strong>{lugarBonito(s.lugar)}</strong><small>{fh(s.t)} · {hace(s.t, ahora)} · {nf(s.lat, 2)}, {nf(s.lon, 2)}</small></span>
            <a href={s.url} {...ext}>Ficha del IGN ↗</a>
          </div> : <p className="note">Toca un círculo del mapa o un terremoto de la lista para ver sus datos.</p>}
          <ul className="hoy-lista" aria-label="Terremotos">
            {lista.slice(0, 60).map(x => <li key={x.t + x.lat}><button className={sel === x.t ? 'is-on' : ''} onClick={() => setSel(sel === x.t ? null : x.t)}>
              <b className="mag" style={{ opacity: x.m >= 3 ? 1 : .7 }}>{nf(x.m, 1)}</b><span>{lugarBonito(x.lugar)}<small>{hace(x.t, ahora)}</small></span></button></li>)}
          </ul>
          {lista.length > 60 && <p className="note">Y {lista.length - 60} más, más pequeños. El catálogo completo está en el IGN.</p>}
        </>}
        {capa === 'temp' && <>
          {c ? <div className="ficha-hoy" style={{ '--c': (c.anom ?? 0) >= 0 ? CALOR : FRIO } as CSSProperties}>
            <b className="ficha-n">{c.anom != null ? signo(c.anom) : '—'}°</b>
            <span><strong>{c.n}</strong><small>Ahora {c.ahora != null ? nf(c.ahora, 1) : '—'} °C · hoy entre {c.min != null ? nf(c.min, 0) : '—'} y {c.max != null ? nf(c.max, 0) : '—'} °C · media prevista {c.media != null ? nf(c.media, 1) : '—'} °C frente a {c.normal != null ? nf(c.normal, 1) : '—'} °C de lo normal</small></span>
          </div> : <p className="note">Toca una provincia para ver su capital, o elige en la lista.</p>}
          <ul className="hoy-lista" aria-label="Capitales por desviación">
            {ranking.map(x => <li key={x.cod}><button className={selC === x.cod ? 'is-on' : ''} onClick={() => setSelC(selC === x.cod ? null : x.cod)}>
              <span className="barra-an"><i style={{ width: `${(Math.abs(x.anom!) / amp) * 50}%`, [x.anom! >= 0 ? 'left' : 'right']: '50%', background: x.anom! >= 0 ? CALOR : FRIO }} /></span>
              <span className="an-n">{x.n}</span><b>{signo(x.anom!)}°</b></button></li>)}
          </ul>
        </>}
      </section>
    </div>
  )
}

/* ———— Avisos ———— */
function Avisos({ d }: { d: D }) {
  const A = d.avisos
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  if (!A) return <p className="note">Los avisos de la AEMET no están disponibles ahora mismo.</p>
  const porNivel = [4, 3, 2].map(n => ({ n, z: A.grupos.filter(g => g.nivel === n).reduce((s, g) => s + g.zonas.length, 0) }))
  return (
    <section className="gcard is-wide">
      <h2>Avisos meteorológicos vigentes</h2>
      {A.grupos.length === 0
        ? <p className="lead"><b>Ahora mismo no hay ningún aviso amarillo, naranja o rojo.</b> La AEMET solo emite avisos verdes, que no implican riesgo.</p>
        : <p className="lead">La AEMET tiene <b>{A.grupos.length} avisos</b> de nivel amarillo o superior, en <b>{A.zonas} zonas</b>. {porNivel.filter(x => x.z).map(x => <span key={x.n} className="chip-nivel" style={{ '--n': NIVEL[x.n].c } as CSSProperties}>{x.z} {NIVEL[x.n].n.toLowerCase()}{x.z === 1 ? '' : 's'}</span>)}</p>}
      <div className="avisos">
        {A.grupos.map(g => {
          const k = `${g.tipo}|${g.nivel}`, I = ICONO_AVISO[g.tipo] ?? TriangleAlert, ver = abiertos[k] ? g.zonas : g.zonas.slice(0, 10)
          return <motion.article key={k} className="aviso" style={{ '--n': NIVEL[g.nivel]?.c } as CSSProperties} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <header><I size={20} /><h3>{g.nombre}</h3><span className="nivel">{NIVEL[g.nivel]?.n}</span></header>
            <p className="vig">Del {fh(g.desde)} al {fh(g.hasta)}</p>
            {g.texto && <p className="aviso-txt">{g.texto}</p>}
            <p className="zonas">{ver.map(z => <span key={z}>{z}</span>)}{g.zonas.length > 10 && <button onClick={() => setAbiertos(a => ({ ...a, [k]: !a[k] }))}>{abiertos[k] ? 'Ver menos' : `+${g.zonas.length - 10} más`}</button>}</p>
          </motion.article>
        })}
      </div>
      <p className="fuente">Fuente: AEMET, a través de <a href="https://www.meteoalarm.org/es/live/country/ES" {...ext}>MeteoAlarm</a>. Las zonas son las de aviso de la AEMET, no provincias. <a href="https://www.aemet.es/es/eltiempo/prediccion/avisos" {...ext}>Mapa oficial ↗</a></p>
    </section>
  )
}

/* ———— BOE ———— */
function Lista({ titulo, items, vacio }: { titulo: string; items: Item[]; vacio: string }) {
  return <section className="gcard">
    <h2>{titulo}</h2>
    {items.length === 0 ? <p className="note">{vacio}</p> : <ul className="boe-lista">{items.map((x, i) => <li key={i}><a href={x.u} {...ext}>{x.t}</a><small>{organismo(x.dep)}</small></li>)}</ul>}
  </section>
}
function Boe({ d }: { d: D }) {
  const B = d.boe
  if (!B) return <p className="note">El BOE no está disponible ahora mismo.</p>
  const corto = (n: string) => n.replace(/^[IVX]+\.\s*/, '').replace('Autoridades y personal. - A. Nombramientos, situaciones e incidencias', 'Nombramientos').replace('Autoridades y personal. - B. Oposiciones y concursos', 'Oposiciones y concursos').replace('Anuncios. - A. Contratación del Sector Público', 'Contratación pública').replace('Anuncios. - B. Otros anuncios oficiales', 'Otros anuncios oficiales').replace('Anuncios. - C. Anuncios particulares', 'Anuncios particulares')
  return (
    <div className="graficos">
      <section className="gcard is-wide">
        <h2>Lo que publica hoy el BOE</h2>
        <p className="lead">El BOE del <b>{fdia(B.fecha + 'T12:00:00Z')}</b> trae <b>{B.total} textos</b>. Aquí, las normas, el empleo público y las ayudas, que son lo que más cambia la vida de la gente. {B.url && <a href={B.url} {...ext}>Sumario completo en PDF ↗</a>}</p>
        <Barras unidad="Textos publicados hoy, por sección" titulo={`Textos en el BOE, ${new Date(B.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`} fmt={v => nf(v, 0)} suma limite={8}
          items={B.secciones.filter(s => s.total > 0).map(s => ({ id: s.c, nombre: corto(s.n), valor: s.total, color: ACC }))} />
      </section>
      <Lista titulo="Normas y disposiciones" items={B.disposiciones} vacio="Hoy no hay disposiciones generales." />
      <Lista titulo="Empleo público: oposiciones y concursos" items={B.empleo} vacio="Hoy no hay convocatorias ni listas de oposiciones y concursos." />
      <Lista titulo="Ayudas, subvenciones y becas" items={B.ayudas} vacio="Hoy el BOE no publica ayudas, subvenciones ni becas." />
      <p className="note" style={{ gridColumn: '1 / -1' }}>Solo se muestran textos de organismos y normas, no nombres de personas. Los títulos son los oficiales del BOE y llevan a su texto.</p>
    </div>
  )
}

/* ———— Luz y euro ———— */
function Horas({ s, unidad, color }: { s: Serie; unidad: string; color: string }) {
  const hs = s.horas.map(x => ({ h: Number(x.h.slice(11, 13)), v: x.v })), max = Math.max(...hs.map(x => x.v)), min = Math.min(...hs.map(x => x.v))
  const orden = [...hs].sort((a, b) => a.v - b.v), barato = new Set(orden.slice(0, Math.ceil(hs.length / 4)).map(x => x.h)), caro = new Set(orden.slice(-Math.ceil(hs.length / 4)).map(x => x.h))
  const horaAhora = Number(new Date().toLocaleString('es-ES', { hour: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }))
  const f = (v: number) => nf(v / 1000, 3)
  return <figure className="horas">
    <p className="g-unidad">{unidad}</p>
    <div className="horas-barras" role="img" aria-label="Precio de la luz hora a hora">
      {hs.map(x => <div key={x.h} className={`hora ${x.h === horaAhora ? 'es-ahora' : ''}`} title={`${String(x.h).padStart(2, '0')}:00 · ${f(x.v)} €/kWh`}>
        <i style={{ height: `${Math.max(4, ((x.v - Math.min(0, min)) / (max - Math.min(0, min) || 1)) * 100)}%`, background: barato.has(x.h) ? '#3df5b0' : caro.has(x.h) ? '#ff5f7e' : color }} /><small>{x.h % 3 === 0 ? String(x.h).padStart(2, '0') : ''}</small>
      </div>)}
    </div>
    <p className="note"><span className="pto" style={{ background: '#3df5b0' }} />Un cuarto más barato · <span className="pto" style={{ background: '#ff5f7e' }} />Un cuarto más caro · hora de España. {orden[0] && <>La hora más barata, a las <b>{String(orden[0].h).padStart(2, '0')}:00</b> ({f(orden[0].v)} €/kWh); la más cara, a las <b>{String(orden.at(-1)!.h).padStart(2, '0')}:00</b> ({f(orden.at(-1)!.v)} €/kWh).</>}</p>
  </figure>
}
function Luz({ d }: { d: D }) {
  const { pvpc, spot, eurusd } = d.mercado
  const media = (s?: Serie) => s && s.horas.length ? s.horas.reduce((t, x) => t + x.v, 0) / s.horas.length : null
  const mp = media(pvpc), ms = media(spot)
  return (
    <div className="graficos">
      {pvpc && <section className="gcard is-wide">
        <h2>El precio de la luz, hora a hora</h2>
        <p className="lead">La tarifa regulada (PVPC) sale hoy a una media de <b>{mp != null ? nf(mp / 1000, 3) : '—'} €/kWh</b>{ms != null && <>, y el mercado mayorista (el precio al que se compra la electricidad antes de llegar a casa) a <b>{nf(ms, 1)} €/MWh</b></>}. Cambia cada hora: las más baratas son las que conviene usar para la lavadora o el coche eléctrico.</p>
        <Horas s={pvpc} unidad="€/kWh por hora del día, tarifa regulada (PVPC)" color="#6aa7bd" />
      </section>}
      {spot && <section className="gcard is-wide"><h2>El mercado mayorista, hora a hora</h2><Horas s={spot} unidad="€/kWh por hora del día, mercado mayorista" color="#7b86ff" /></section>}
      {eurusd && <section className="gcard">
        <h2>Euro y dólar</h2>
        <p className="lead">Un euro vale <b>{nf(eurusd.v, 4)} dólares</b>{eurusd.antes != null && <> ({signo(eurusd.v - eurusd.antes, 4)} frente al día anterior)</>}. Es el cambio de referencia que publica el BCE cada tarde.</p>
        <p className="fuente">Fuente: <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html" {...ext}>BCE</a>, dato del {new Date(eurusd.f).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.</p>
      </section>}
      {!pvpc && !spot && !eurusd && <p className="note">Los precios de hoy no están disponibles ahora mismo.</p>}
      <p className="fuente" style={{ gridColumn: '1 / -1' }}>Fuente: <a href="https://www.ree.es/es/datos/mercados/precios-mercados-tiempo-real" {...ext}>Red Eléctrica</a>. El PVPC es el precio por horas que pagan los consumidores con la tarifa regulada, sin peajes ni impuestos.</p>
    </div>
  )
}
