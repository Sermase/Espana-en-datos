import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CloudFog, Factory, Thermometer, Wind } from 'lucide-react'
import { Apiladas, Barras, CountUp, LineChart, Sankey, nf, type Capa } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { cupula } from '../holo3d/modelos'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import { Ahora, type Live } from './Ahora'

const ACC = '#a6f2d8'
type S = (number | null)[]
type Emis = {
  fecha: string; años: number[]
  gei: { es: Record<string, S>; ue: Record<string, S> }; crf: Record<string, string>
  cont: { es: Record<string, Record<string, S>>; ue: Record<string, S> }; nfr: Record<string, string>
  pob: { es: S; ue: S }
  gases?: Record<string, S>
}
const SECCIONES = [
  { id: 'ahora', nombre: 'Ahora', icon: Wind },
  { id: 'clima', nombre: 'Gases de efecto invernadero', icon: Thermometer },
  { id: 'contaminantes', nombre: 'Contaminantes', icon: Factory },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/** Sectores, en orden fijo y con color fijo (el color sigue al sector). */
const SECTORES: { id: string; n: string; c: string; crf: string[]; nfr: RegExp }[] = [
  { id: 'transporte', n: 'Transporte', c: '#ff9f6e', crf: ['CRF1A3'], nfr: /^NFR1A3(A1_1|A2_1|B|C|D2|E)/ },
  { id: 'industria', n: 'Industria', c: '#9fb3c8', crf: ['CRF1A2', 'CRF2'], nfr: /^NFR(1A2|2)/ },
  { id: 'energia', n: 'Electricidad y refino', c: '#ffd166', crf: ['CRF1A1'], nfr: /^NFR1(A1|B)/ },
  { id: 'campo', n: 'Agricultura y ganadería', c: '#8fd16a', crf: ['CRF3', 'CRF1A4C'], nfr: /^NFR(3|1A4C)/ },
  { id: 'edificios', n: 'Casas y comercios', c: '#ff6fae', crf: ['CRF1A4A', 'CRF1A4B'], nfr: /^NFR1A4(A|B)/ },
  { id: 'residuos', n: 'Residuos', c: '#b8a6ff', crf: ['CRF5'], nfr: /^NFR5/ },
  { id: 'otros', n: 'Otros', c: '#5f7480', crf: [], nfr: /^$/ },
]
const CONTAMINANTES: { id: string; n: string; que: string; c: string }[] = [
  { id: 'NOX', n: 'Óxidos de nitrógeno (NOx)', que: 'Salen de los motores y las calderas; irritan los pulmones y forman ozono.', c: '#ff9f6e' },
  { id: 'PM2_5', n: 'Partículas finas (PM2,5)', que: 'Tan pequeñas que llegan a la sangre: las de más efecto en la salud.', c: '#ff6fae' },
  { id: 'PM10', n: 'Partículas (PM10)', que: 'Polvo, hollín y desgaste de frenos y ruedas.', c: '#e0a8ff' },
  { id: 'SOX', n: 'Óxidos de azufre (SOx)', que: 'Del carbón y el fuelóleo; causan lluvia ácida.', c: '#ffd166' },
  { id: 'NH3', n: 'Amoníaco (NH3)', que: 'Del estiércol y los abonos; forma partículas finas en el aire.', c: '#8fd16a' },
  { id: 'NMVOC', n: 'Compuestos orgánicos volátiles', que: 'Disolventes, pinturas y gasolina; ayudan a formar ozono.', c: '#5fd3e8' },
]
const pct = (a: number, b: number) => ((a - b) / b) * 100
const masMenos = (v: number, d = 0) => `${nf(Math.abs(v), d)} % ${v > 0 ? 'más' : 'menos'}`
const signo = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)} %`
const ult = (s: S) => { for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return i; return -1 }
const suma = (n: number, ...ss: (S | undefined)[]) => Array.from({ length: n }, (_, i) => ss.reduce<number>((t, s) => t + (s?.[i] ?? 0), 0))
/** Reparte un total entre los sectores; lo que no cae en ninguno va a «Otros». */
function porSectores(n: number, tot: S, de: (s: (typeof SECTORES)[number]) => (S | undefined)[]) {
  const capas = SECTORES.filter(s => s.id !== 'otros').map(s => ({ ...s, v: suma(n, ...de(s)) }))
  const otros = Array.from({ length: n }, (_, k) => Math.max(0, (tot[k] ?? 0) - capas.reduce((t, c) => t + c.v[k], 0)))
  return [...capas, { ...SECTORES.at(-1)!, v: otros }]
}

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const EUROSTAT_C = <a href="https://ec.europa.eu/eurostat/databrowser/view/env_air_emis/default/table" target="_blank" rel="noopener noreferrer">Eurostat, inventario de contaminantes que España envía a la ONU</a>
const EUROSTAT = <a href="https://ec.europa.eu/eurostat/databrowser/view/env_air_gge/default/table" target="_blank" rel="noopener noreferrer">Eurostat, inventario de emisiones que España envía a la ONU</a>

/** Gases de efecto invernadero por sector, en miles de toneladas de CO₂ equivalente. */
function geiPorSector(e: Emis) {
  const G = e.gei.es, tot = G.TOTX4_MEMO ?? []
  return { tot, capas: porSectores(e.años.length, tot, s => s.crf.map(k => G[k])) }
}

function Clima({ e }: { e: Emis }) {
  const { tot, capas } = geiPorSector(e)
  const i = ult(tot), A = e.años[i], i90 = e.años.indexOf(1990), iMax = tot.reduce<number>((b, v, k) => (v ?? 0) > (tot[b] ?? 0) ? k : b, 0)
  const hab = (s: S, p: S, k: number) => s[k] != null && p[k] ? (s[k]! * 1000) / p[k]! : null
  const ue = e.gei.ue.TOTX4_MEMO ?? [], tEs = hab(tot, e.pob.es, i), tUe = hab(ue, e.pob.ue, i)
  const bosque = e.gei.es.CRF4?.[i] ?? null
  const ordenA = [...capas].sort((a, b) => (b.v[i] ?? 0) - (a.v[i] ?? 0))
  const ap: Capa[] = capas.map(c => ({ id: c.id, nombre: c.n, color: c.c, v: c.v.map(x => (x ?? 0) / 1000) }))
  const cambios = capas.filter(c => c.id !== 'otros').map(c => ({ c, v: pct(c.v[i] ?? 0, c.v[i90] ?? 1) })).sort((a, b) => b.v - a.v)
  const modelo = useMemo(() => cupula(Math.min(1, (tot[i] ?? 0) / (tot[iMax] ?? 1))), [i, iMax, tot])
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={modelo} color={ACC} alto={270} giro={0.16} etiqueta={`Cúpula de aire: partículas según las emisiones de ${A} frente al año de más emisiones`} />
        <div className="sala-dato">
          <span className="sala-k">Gases de efecto invernadero en {A}</span>
          <b><CountUp value={(tot[i] ?? 0) / 1000} fmt={v => nf(v, 1)} /> Mt</b>
          <span>millones de toneladas de CO₂ equivalente. {i90 >= 0 && tot[i90] ? <>Un <b>{masMenos(pct(tot[i]!, tot[i90]!))}</b> que en 1990</> : null}{iMax !== i ? <> y un {masMenos(pct(tot[i]!, tot[iMax]!))} que en {e.años[iMax]}, el año de más emisiones</> : null}.</span>
          {tEs && tUe ? <span>Cada español emite <b>{nf(tEs, 1)} t</b> al año; la media europea, {nf(tUe, 1)} t.</span> : null}
        </div>
      </div>
      <ul className="sala-lista" aria-label={`Reparto por sector en ${A}`}>{ordenA.map(c => { const f = (c.v[i] ?? 0) / (tot[i] ?? 1); return <li key={c.id} style={{ '--c': c.c } as React.CSSProperties}><i /><span>{c.n}</span><b>{nf(f * 100, 0)} %</b><em style={{ width: `${(f / ((ordenA[0].v[i] ?? 1) / (tot[i] ?? 1))) * 100}%` }} /></li> })}</ul>
    </section>
    {e.gases?.CO2 && (() => {
      const g = (k: string) => e.gases?.[k]?.[i] ?? 0, T = tot[i] ?? 0
      const co2 = g('CO2'), ch4 = g('CH4_CO2E') || g('CH4'), n2o = g('N2O_CO2E') || g('N2O'), fl = Math.max(0, T - co2 - ch4 - n2o)
      const der = [{ id: 'co2', nombre: 'Dióxido de carbono (CO₂)', corto: 'CO₂', valor: co2 / 1000, color: '#9fb3c8' }, { id: 'ch4', nombre: 'Metano', corto: 'Metano', valor: ch4 / 1000, color: '#8fd16a' }, { id: 'n2o', nombre: 'Óxido nitroso', corto: 'N₂O', valor: n2o / 1000, color: '#ffd166' }, { id: 'fl', nombre: 'Gases fluorados', corto: 'Fluorados', valor: fl / 1000, color: '#b8a6ff' }]
      return <Card wide t="De dónde sale y qué gas es" lead={<>En {A}, el <b>{nf((co2 / T) * 100, 0)} %</b> de lo emitido fue CO₂, sobre todo de quemar combustibles; el metano ({nf((ch4 / T) * 100, 0)} %) sale del ganado y los vertederos, y el óxido nitroso ({nf((n2o / T) * 100, 0)} %), de los abonos. Toca una cinta para seguirla.</>} fuente={EUROSTAT}>
        <Sankey izq={ordenA.map(c => ({ id: c.id, nombre: c.n, corto: c.n.split(/[ ,]/)[0], valor: (c.v[i] ?? 0) / 1000, color: c.c }))} der={der} centro="ATMÓSFERA" fmt={v => `${nf(v, 1)} Mt`} titulo={`Emisiones de gases de efecto invernadero por sector y por gas, ${A}`} alto={400} />
        <p className="note">Millones de toneladas de CO₂ equivalente. A la izquierda, quién emite; a la derecha, qué gas (el metano y el óxido nitroso pesan según cuánto calientan).</p>
      </Card>
    })()}
    <Card wide t="De dónde salen" lead={<>El transporte {capas[0].v[i]! > capas[0].v[i90]! ? 'emite más' : 'emite menos'} que en 1990; la electricidad, un {nf(Math.abs(pct(capas[2].v[i] ?? 0, capas[2].v[i90] ?? 1)), 0)} % {(capas[2].v[i] ?? 0) < (capas[2].v[i90] ?? 0) ? 'menos' : 'más'}, sobre todo por el cierre del carbón y las renovables.</>} fuente={EUROSTAT}>
      <Apiladas unidad="Millones de toneladas de CO₂ equivalente" xs={e.años.slice(0, i + 1)} capas={ap.map(c => ({ ...c, v: c.v.slice(0, i + 1) }))} titulo="Gases de efecto invernadero por sector" fx={a => String(a)} fy={v => `${nf(v, 0)} Mt`} alto={300} />
      <p className="note">Millones de toneladas de CO₂ equivalente (el metano y el óxido nitroso se convierten según cuánto calientan). No incluye lo que absorben los bosques{bosque != null && bosque < 0 ? `, unos ${nf(-bosque / 1000, 0)} Mt en ${A}` : ''}, ni los vuelos y barcos internacionales.</p>
    </Card>
    <Card t={`Cambio desde 1990`} lead="Por sector, en porcentaje.">
      <Barras unidad="Cambio desde 1990, en %" titulo="Cambio por sector desde 1990" fmt={v => signo(v)} items={cambios.map(x => ({ id: x.c.id, nombre: x.c.n, valor: x.v, color: x.v > 0 ? '#ff8a95' : '#3df5b0' }))} />
    </Card>
    <Card t="Por habitante, España y la UE" lead="Toneladas de CO₂ equivalente por persona y año.">
      <LineChart unidad="Toneladas de CO₂ equivalente por habitante" titulo="Emisiones por habitante" alto={230} fx={a => String(a)} fy={v => `${nf(v, 1)} t`} series={[
        { id: 'ue', nombre: 'UE', fondo: true, datos: e.años.flatMap((a, k) => { const v = hab(ue, e.pob.ue, k); return v == null ? [] : [[a, v]] }) as [number, number][] },
        { id: 'es', nombre: 'España', color: ACC, datos: e.años.flatMap((a, k) => { const v = hab(tot, e.pob.es, k); return v == null ? [] : [[a, v]] }) as [number, number][] }]} />
    </Card>
  </div>
}

function Contaminantes({ e }: { e: Emis }) {
  const [p, setP] = useState('NOX')
  const C = e.cont.es[p] ?? {}, info = CONTAMINANTES.find(x => x.id === p)!
  const tot = C.NFR_TOT_NAT ?? [], i = ult(tot), A = e.años[i], i90 = e.años.indexOf(1990)
  const capas: Capa[] = porSectores(e.años.length, tot, s => Object.entries(C).filter(([k]) => s.nfr.test(k)).map(([, v]) => v)).map(s => ({ id: s.id, nombre: s.n, color: s.c, v: s.v.slice(0, i + 1).map(x => x / 1000) }))
  const ordenA = [...capas].sort((a, b) => (b.v[i] ?? 0) - (a.v[i] ?? 0))
  const caidas = CONTAMINANTES.map(c => { const s = e.cont.es[c.id]?.NFR_TOT_NAT ?? [], k = ult(s); return { c, v: s[i90] && s[k] != null ? pct(s[k]!, s[i90]!) : null } }).filter((x): x is { c: (typeof CONTAMINANTES)[number]; v: number } => x.v != null).sort((a, b) => a.v - b.v)
  const ue = e.cont.ue[p] ?? []
  const idx = (s: S) => { const b = s[i90]; return e.años.flatMap((a, k) => (b && s[k] != null ? [[a, (s[k]! / b) * 100]] : [])) as [number, number][] }
  return <div className="graficos">
    <Card wide t="Lo que respiramos, desde 1990" lead={<>De los seis contaminantes principales, el que más ha bajado es el <b>{caidas[0]?.c.n.toLowerCase()}</b> ({signo(caidas[0]?.v ?? 0)}); el que menos, el {caidas.at(-1)?.c.n.toLowerCase()} ({signo(caidas.at(-1)?.v ?? 0)}).</>} fuente={EUROSTAT_C}>
      <Barras unidad="Cambio desde 1990, en %" titulo="Cambio de cada contaminante desde 1990" fmt={v => signo(v)} items={caidas.map(x => ({ id: x.c.id, nombre: x.c.n, valor: x.v, color: x.c.c, destacado: x.c.id === p, onClick: () => setP(x.c.id) }))} />
    </Card>
    <Card wide t={info.n} lead={<>{info.que} En {A}, {nf((tot[i] ?? 0) / 1000, 0)} mil toneladas; sale sobre todo de <b>{ordenA[0]?.nombre.toLowerCase()}</b> ({nf(((ordenA[0]?.v[i] ?? 0) * 1000 / (tot[i] ?? 1)) * 100, 0)} %).</>}>
      <div className="chips" role="radiogroup" aria-label="Contaminante">{CONTAMINANTES.map(c => <button key={c.id} role="radio" aria-checked={p === c.id} className={p === c.id ? 'is-on' : ''} style={{ '--c': c.c } as React.CSSProperties} onClick={() => setP(c.id)}><i />{c.n}</button>)}</div>
      <Apiladas unidad="Miles de toneladas al año" xs={e.años.slice(0, i + 1)} capas={capas} titulo={`${info.n} por sector`} fx={a => String(a)} fy={v => `${nf(v, 0)} mil t`} alto={280} />
    </Card>
    <Card wide t="España y la UE" lead="Índice: 1990 = 100.">
      <LineChart unidad="Índice, 1990 = 100" titulo={`${info.n}: España y la UE`} alto={230} fx={a => String(a)} fy={v => nf(v, 0)} series={[{ id: 'ue', nombre: 'UE', fondo: true, datos: idx(ue) }, { id: 'es', nombre: 'España', color: info.c, datos: idx(tot) }]} />
    </Card>
  </div>
}

export default function App() {
  const [e, setE] = useState<Emis | null>(null), [err, setErr] = useState(false), [live, setLive] = useState<Live | null | undefined>(undefined)
  useEffect(() => {
    fetch('./data/emisiones.json').then(r => r.json()).then(setE, () => setErr(true))
    fetch('./data/ahora.json').then(r => (r.ok ? r.json() : null)).then(setLive, () => setLive(null))
  }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'ahora')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!e || live === undefined) return <main className="eco boot"><CloudFog size={28} /><p>Cargando el aire…</p></main>
  const secs = SECCIONES.filter(s => s.id !== 'ahora' || live)
  const S = secs.some(s => s.id === sec) ? sec : secs[0].id
  const { tot, capas } = geiPorSector(e), i = ult(tot)
  const so = e.cont.es.SOX?.NFR_TOT_NAT ?? [], i90 = e.años.indexOf(1990), kso = ult(so)
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Aire</h1>
          <p>Calidad del aire y emisiones · Agencia Europea de Medio Ambiente y Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {secs.map(x => <button key={x.id} className={S === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={S === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={S} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {S === 'ahora' && live && <Ahora d={live} />}
        {S === 'clima' && <Clima e={e} />}
        {S === 'contaminantes' && <Contaminantes e={e} />}
      </motion.div>
      {S !== 'ahora' && <Curiosidades titulo="¿Sabías que…?" items={[
        so[i90] && so[kso] != null && <>España emite hoy un <b>{nf(Math.abs(pct(so[kso]!, so[i90]!)), 0)} % menos</b> de óxidos de azufre que en 1990: el cierre de las centrales de carbón casi ha acabado con la lluvia ácida.</>,
        (() => { const t = capas.find(c => c.id === 'transporte')!; return t.v[i] ? <>El transporte es ya la mayor fuente de gases de efecto invernadero: <b>{nf((t.v[i]! / (tot[i] ?? 1)) * 100, 0)} %</b> del total en {e.años[i]}.</> : null })(),
        (() => { const C = e.cont.es.NOX, k = ult(C?.NFR_TOT_NAT ?? []), bar = C?.NFR1A3D1_1?.[k], t = C?.NFR_TOT_NAT?.[k]; return bar && t ? <>Los barcos en ruta internacional que cruzan aguas españolas emiten <b>{nf(bar / 1000, 0)} mil toneladas</b> de óxidos de nitrógeno al año: {bar > t * 0.9 ? 'casi tanto como todo el país' : `el equivalente al ${nf((bar / t) * 100, 0)} % de lo que emite todo el país`}, y no entran en el total.</> : null })(),
        (() => { const b = e.gei.es.CRF4?.[i]; return b != null && b < 0 && tot[i] ? <>Los bosques y el suelo absorben cada año unos {nf(-b / 1000, 0)} millones de toneladas de CO₂: el {nf((-b / tot[i]!) * 100, 0)} % de lo que emitimos.</> : null })(),
      ]} />}
      <Fuentes ids={[]} extra={[{ n: 'Eurostat · Emisiones de gases de efecto invernadero (env_air_gge)', u: 'https://ec.europa.eu/eurostat/databrowser/view/env_air_gge/default/table' }, { n: 'Eurostat · Contaminantes del aire (env_air_emis)', u: 'https://ec.europa.eu/eurostat/databrowser/view/env_air_emis/default/table' }, { n: 'Agencia Europea de Medio Ambiente · Calidad del aire', u: 'https://eeadmz1-downloads-webapp.azurewebsites.net/' }]} />
      <p className="src">Emisiones: inventario nacional que España presenta cada año a la ONU y a la UE, con dos años de retraso. Datos de {e.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
