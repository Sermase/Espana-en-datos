import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { BedDouble, Euro, Globe2, Luggage, MapPin } from 'lucide-react'
import { Barras, Carrera, CountUp, LineChart, Sankey, nf, type Fotograma, type NodoSankey } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { globo, type Ruta } from '../holo3d/modelos'
import { MapaProvincias } from '../geo/MapaProvincias'
import { MapaMundo, nombrePais } from '../mundo/MapaMundo'
import { PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import { RelojTurismo } from './Reloj'

const ACC = '#ff9f43', C_ESP = '#3987e5', C_EXT = ACC
type S = (number | null)[]
type Serie = Record<string, number>
type D = {
  fecha: string
  paises: Record<string, { turistas: Serie }>; ccaa: Record<string, { turistas: Serie }>
  gastoPais: Record<string, { total?: Serie; persona?: Serie; diario?: Serie; dias?: Serie }>; gastoCcaa: Record<string, { total?: Serie }>
  partidas?: Record<string, { total?: Serie }>
  hotel: { meses: string[]; esp: S; ext: S; viajeros: S }
  provincias: { años: string[]; completos: number[]; tot: Record<string, S>; ext: Record<string, S> }
  ocupacion: Record<string, { hoteles?: number; plazas?: number; ocup?: number; empleo?: number }>
  puntos: { hasta: string; lista: { n: string; tot: number; ext: number }[] }
  viviendas: Record<string, { viv?: number; plazas?: number; pct?: number; per?: string }>
  europa: { años: string[]; ultimo: string; paises: { id: string; nombre: string; v: S }[] }
  poblacion: { año: number; p: Record<string, number> }
}
const SECCIONES = [
  { id: 'quien', nombre: 'Quién viene', icon: Luggage },
  { id: 'anio', nombre: 'El año', icon: BedDouble },
  { id: 'donde', nombre: 'Dónde', icon: MapPin },
  { id: 'gasto', nombre: 'Cuánto gasta', icon: Euro },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/** País de FRONTUR → código ISO (para el mapa) y punto en el globo. Los grupos («Resto…», «Países Nórdicos») no tienen ISO. */
const PAIS: Record<string, { iso?: string; lat: number; lon: number; corto?: string }> = {
  Alemania: { iso: 'DE', lat: 51, lon: 10 }, Bélgica: { iso: 'BE', lat: 50.6, lon: 4.6 }, Francia: { iso: 'FR', lat: 46.5, lon: 2.5 }, Irlanda: { iso: 'IE', lat: 53.2, lon: -8 },
  Italia: { iso: 'IT', lat: 42.8, lon: 12.5 }, 'Países Bajos': { iso: 'NL', lat: 52.2, lon: 5.5 }, 'Países Nórdicos': { lat: 62, lon: 15 }, Portugal: { iso: 'PT', lat: 39.6, lon: -8 },
  'Reino Unido': { iso: 'GB', lat: 54, lon: -2 }, Rusia: { iso: 'RU', lat: 56, lon: 38 }, Suiza: { iso: 'CH', lat: 46.8, lon: 8.2 },
  'Estados Unidos de América': { iso: 'US', lat: 39, lon: -98, corto: 'Estados Unidos' }, Japón: { iso: 'JP', lat: 36, lon: 138 }, China: { iso: 'CN', lat: 35, lon: 104 },
  Corea: { iso: 'KR', lat: 36.5, lon: 128, corto: 'Corea del Sur' }, Turquía: { iso: 'TR', lat: 39, lon: 35 }, Israel: { iso: 'IL', lat: 31.4, lon: 35 }, India: { iso: 'IN', lat: 22, lon: 79 },
  'Arabia Saudí': { iso: 'SA', lat: 24, lon: 45 }, Filipinas: { iso: 'PH', lat: 12.8, lon: 122 }, 'Emiratos Árabes Unidos': { iso: 'AE', lat: 24, lon: 54, corto: 'Emiratos' },
  Argentina: { iso: 'AR', lat: -34, lon: -64 }, Brasil: { iso: 'BR', lat: -10, lon: -52 }, Chile: { iso: 'CL', lat: -33, lon: -71 }, México: { iso: 'MX', lat: 23, lon: -102 },
  Venezuela: { iso: 'VE', lat: 7, lon: -66 }, Canadá: { iso: 'CA', lat: 56, lon: -106 },
}
const corto = (p: string) => PAIS[p]?.corto ?? p
const GRUPO = /^(total|resto|europa menos)/i
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mesLargo = (m: string) => `${MES[+m.slice(5) - 1]} de ${m.slice(0, 4)}`
const mesCorto = (m: string) => `${MES[+m.slice(5) - 1].slice(0, 3)} ${m.slice(0, 4)}`

// ---------- utilidades de series mensuales ----------
const mesesDe = (s?: Serie) => Object.keys(s ?? {}).filter(k => k.length === 7).sort()
const atras = (m: string, n: number) => { let y = +m.slice(0, 4), k = +m.slice(5) - n; while (k < 1) { k += 12; y-- } return `${y}-${String(k).padStart(2, '0')}` }
/** Suma de los 12 meses que acaban en `hasta` (null si falta alguno). */
const doce = (s: Serie | undefined, hasta: string) => { if (!s) return null; let t = 0; for (let i = 0; i < 12; i++) { const v = s[atras(hasta, i)]; if (v == null) return null; t += v } return t }
const millones = (v: number, d = 1) => `${nf(v / 1e6, d)} M`
const meur = (v: number) => v >= 1000 ? `${nf(v / 1000, 1)} mil M€` : `${nf(v, 0)} M€`
const masMenos = (v: number, d = 0) => `${nf(Math.abs(v), d)} % ${v >= 0 ? 'más' : 'menos'}`
const pct = (a: number, b: number) => (a / b - 1) * 100
const bonito = (n: string) => n.replace(/ (De|Del|La|Las|Los|El|D')(?= )/g, m => m.toLowerCase()).replace(/^Pajara$/, 'Pájara').replace(/^Tias$/, 'Tías')
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const FRONTUR = <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=10822" {...ext}>INE, FRONTUR</a>
const EGATUR = <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=10838" {...ext}>INE, EGATUR</a>
const EOH = <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=2074" {...ext}>INE, Encuesta de Ocupación Hotelera</a>
const VTE = <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=46141" {...ext}>INE, viviendas turísticas (estadística experimental)</a>
const EST = <a href="https://ec.europa.eu/eurostat/databrowser/view/tour_occ_ninat/default/table?lang=es" {...ext}>Eurostat, tour_occ_ninat</a>

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
function Chips<T extends string>({ items, v, set }: { items: { id: T; n: string; c?: string }[]; v: T; set: (x: T) => void }) {
  return <div className="chips" role="group">{items.map(x => <button key={x.id} className={v === x.id ? 'is-on' : ''} style={{ '--c': x.c ?? ACC } as CSSProperties} onClick={() => set(x.id)} aria-pressed={v === x.id}><i />{x.n}</button>)}</div>
}

// ---------- Quién viene ----------
function Quien({ d, hasta }: { d: D; hasta: string }) {
  const P = d.paises, tot = doce(P.Total?.turistas, hasta) ?? 0, totAnt = doce(P.Total?.turistas, atras(hasta, 12)) ?? 0
  const gas = doce(d.gastoPais.Total?.total, hasta) ?? 0
  const lista = Object.keys(P).filter(p => !GRUPO.test(p)).map(p => ({ p, v: doce(P[p].turistas, hasta) })).filter((x): x is { p: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const top = lista[0]
  const rutas: Ruta[] = lista.slice(0, 9).map(x => ({ lat: PAIS[x.p]?.lat ?? 0, lon: PAIS[x.p]?.lon ?? 0, peso: x.v / (top?.v || 1) }))
  // mapa: el último año completo de la tabla anual (tiene más países que la mensual)
  const añoMapa = Object.keys(P.Total?.turistas ?? {}).filter(k => k.length === 4).sort().at(-1) ?? ''
  const mapa = Object.entries(P).flatMap(([p, s]) => PAIS[p]?.iso && s.turistas[añoMapa] != null ? [{ pais: PAIS[p].iso!, valor: s.turistas[añoMapa] }] : [])
  const [sel, setSel] = useState<string | null>(null)
  const selN = sel ? Object.keys(PAIS).find(p => PAIS[p].iso === sel) : null
  // carrera: los 12 meses que acaban en cada mes, desde que hay un año entero de datos
  const ms = mesesDe(P.Total?.turistas)
  const fot = useMemo<Fotograma[]>(() => ms.slice(11).map(m => ({ t: mesCorto(m), items: Object.keys(P).filter(p => !GRUPO.test(p) && P[p].turistas[m] != null).flatMap(p => { const v = doce(P[p].turistas, m); return v == null ? [] : [{ id: p, nombre: corto(p), valor: v }] }) })), [P, ms])
  const eu = d.europa, ke = eu.años.indexOf(eu.ultimo), euL = eu.paises.map(p => ({ id: p.id, v: p.v[ke] ?? 0 })).sort((a, b) => b.v - a.v)
  const esPos = euL.findIndex(x => x.id === 'ES') + 1
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={globo(rutas)} color={ACC} alto={270} giro={0.16} etiqueta={`Globo con las rutas de los nueve países de los que más turistas llegan a España`} />
        <div className="sala-dato">
          <span className="sala-k">Turistas internacionales en los 12 meses hasta {mesLargo(hasta)}</span>
          <b><CountUp value={tot} fmt={v => millones(v, 1)} /></b>
          {totAnt > 0 && <span>Un {masMenos(pct(tot, totAnt), 1)} que un año antes. Se gastaron <b>{meur(gas)}</b>: {nf((gas * 1e6) / (tot || 1), 0)} € por turista.</span>}
          {top && <span>Los que más vienen son de <b>{corto(top.p)}</b>: {nf((top.v / (tot || 1)) * 100, 0)} de cada 100.</span>}
        </div>
      </div>
      <ul className="sala-lista" aria-label="Turistas por país en los últimos 12 meses">{lista.slice(0, 10).map(x => <li key={x.p} style={{ '--c': ACC } as CSSProperties}><i /><span>{corto(x.p)}</span><b>{millones(x.v, 1)}</b><em style={{ width: `${(x.v / (top?.v || 1)) * 100}%` }} /></li>)}</ul>
    </section>
    <Card wide t="La carrera de los países" lead={<>Turistas de los últimos 12 meses, mes a mes desde {fot[0]?.t}. Mira cómo se hunde todo en 2020 y quién vuelve antes. Dale al botón para volver a verla o arrastra la barra de tiempo.</>} fuente={FRONTUR}>
      <Carrera unidad="Turistas en los últimos 12 meses" fotogramas={fot} top={10} fmt={v => millones(v, 2)} titulo="Turistas internacionales por país de residencia, últimos 12 meses" ms={520} />
    </Card>
    <Card wide t={`De dónde vienen, ${añoMapa}`} lead={selN ? <>{corto(selN)}: <b>{nf(P[selN].turistas[añoMapa], 0)}</b> turistas en {añoMapa}.</> : <>Cuanto más intenso el país, más turistas manda. Los arcos salen de los diez primeros. Los países nórdicos y los «resto» van en grupo, así que no salen en el mapa. Toca un país.</>} fuente={FRONTUR}>
      <MapaMundo datos={mapa} color={ACC} fmt={v => millones(v, 2)} titulo={`Turistas internacionales por país de residencia, ${añoMapa}`} sentido="entra" sel={sel} onSel={setSel} rutas={10} />
    </Card>
    <Card t={`El turismo en Europa, ${eu.ultimo}`} lead={<>Noches de no residentes en hoteles, apartamentos y campings. {esPos === 1 ? <>España es <b>el país de Europa</b> con más noches de turistas extranjeros.</> : esPos > 0 ? <>España es la <b>{esPos}.ª</b>.</> : null}</>} fuente={EST}>
      <Barras unidad="Noches de turistas extranjeros al año" titulo={`Noches de no residentes en alojamientos turísticos, ${eu.ultimo}`} fmt={v => millones(v, 0)} items={euL.map(x => ({ id: x.id, nombre: nombrePais(x.id), valor: x.v, destacado: x.id === 'ES', color: x.id === 'ES' ? ACC : '#5b6b74' }))} limite={12} />
    </Card>
    <Card t="Quién gasta más" lead={(() => { const g = gastoPorPais(d, hasta); const a = g[0], z = g.at(-1); return a && z ? <>En los últimos 12 meses, quien más gasta por viaje viene de <b>{corto(a.p)}</b> ({nf(a.persona, 0)} €); quien menos, de {corto(z.p)} ({nf(z.persona, 0)} €).</> : null })()} fuente={EGATUR}>
      <Barras unidad="Euros por turista y viaje" titulo="Gasto medio por turista y viaje, últimos 12 meses" fmt={v => `${nf(v, 0)} €`} items={gastoPorPais(d, hasta).map(x => ({ id: x.p, nombre: corto(x.p), sub: `${nf(x.diario, 0)} € al día · ${nf(x.dias, 1)} días`, valor: x.persona, color: ACC }))} limite={10} />
    </Card>
  </div>
}
/** Gasto por turista (total / turistas) y por día, y estancia media ponderada, de los últimos 12 meses. */
function gastoPorPais(d: D, hasta: string) {
  return Object.keys(d.gastoPais).filter(p => !GRUPO.test(p)).flatMap(p => {
    const g = doce(d.gastoPais[p].total, hasta), t = doce(d.paises[p]?.turistas, hasta); if (!g || !t) return []
    let sd = 0, st = 0; for (let i = 0; i < 12; i++) { const m = atras(hasta, i), di = d.gastoPais[p].dias?.[m], tu = d.paises[p]?.turistas[m]; if (di != null && tu != null) { sd += di * tu; st += tu } }
    const dias = st ? sd / st : 0, persona = (g * 1e6) / t
    return [{ p, persona, dias, diario: dias ? persona / dias : 0 }]
  }).sort((a, b) => b.persona - a.persona)
}

// ---------- El año ----------
function Anio({ d }: { d: D }) {
  const H = d.hotel, años = [...new Set(H.meses.map(m => m.slice(0, 4)))]
  const comp = años.filter(a => H.meses.filter(m => m.startsWith(a)).length === 12)
  const suma = (s: S, a: string) => H.meses.reduce((t, m, i) => t + (m.startsWith(a) ? s[i] ?? 0 : 0), 0)
  const uA = comp.at(-1) ?? '', e = suma(H.esp, uA), x = suma(H.ext, uA)
  const max = comp.reduce((b, a) => (suma(H.esp, a) + suma(H.ext, a) > suma(H.esp, b) + suma(H.ext, b) ? a : b), comp[0])
  const c20 = comp.includes('2020') && comp.includes('2019') ? pct(suma(H.esp, '2020') + suma(H.ext, '2020'), suma(H.esp, '2019') + suma(H.ext, '2019')) : null
  const xs = comp.map(a => Date.UTC(+a, 6, 1))
  return <div className="graficos">
    <Card wide t="El reloj del turismo" lead={<>Cada gajo es un mes y crece con las noches de hotel: por dentro, las de quienes viven en España; por fuera, las de extranjeros. El reloj pasa año a año desde {años[0]}; la línea discontinua es el año anterior. Toca un mes para ver su dato.</>} fuente={EOH}>
      <RelojTurismo meses={H.meses} esp={H.esp} ext={H.ext} cEsp={C_ESP} cExt={C_EXT} />
    </Card>
    <Card wide t="Noches de hotel por año" lead={<>En {uA}, <b>{millones(e + x, 0)}</b> de noches de hotel, el {nf((x / (e + x || 1)) * 100, 0)} % de extranjeros.{max === uA ? ' Es el récord.' : ` El récord es de ${max}.`}{c20 != null && <> En 2020 se hundieron un {nf(Math.abs(c20), 0)} %.</>}</>} fuente={EOH}>
      <LineChart titulo="Pernoctaciones en hoteles por residencia del viajero" series={[
        { id: 'ext', nombre: 'Extranjeros', datos: comp.map((a, i) => [xs[i], suma(H.ext, a) / 1e6] as [number, number]), color: C_EXT, area: true },
        { id: 'esp', nombre: 'Residentes en España', datos: comp.map((a, i) => [xs[i], suma(H.esp, a) / 1e6] as [number, number]), color: C_ESP },
      ]} fx={t => String(new Date(t).getUTCFullYear())} ticksX={xs.filter((_, i, l) => (l.length - 1 - i) % 4 === 0)} fy={v => `${nf(v, 0)} M`} yMin={0} alto={220} />
    </Card>
  </div>
}

// ---------- Dónde ----------
type Ind = 'hab' | 'noches' | 'ext' | 'ocup' | 'viv'
function Donde({ d, hasta }: { d: D; hasta: string }) {
  const [ind, setInd] = useState<Ind>('hab')
  const [sel, setSel] = useState<string | null>(null)
  const Pv = d.provincias, j = Pv.completos.lastIndexOf(12), A = Pv.años[j], pob = d.poblacion.p
  const IND: { id: Ind; n: string; fmt: (v: number) => string; f: (c: string) => number | null; t: string; nota: string; raiz?: boolean }[] = [
    { id: 'hab', n: 'Noches por vecino', fmt: v => nf(v, 1), f: c => (Pv.tot[c]?.[j] != null && pob[c] ? Pv.tot[c][j]! / pob[c] : null), raiz: true, t: `Noches de hotel por habitante, ${A}`, nota: 'Noches en hoteles de cada provincia divididas entre sus vecinos empadronados.' },
    { id: 'noches', n: 'Noches de hotel', fmt: v => millones(v, 1), f: c => Pv.tot[c]?.[j] ?? null, raiz: true, t: `Noches de hotel, ${A}`, nota: 'Pernoctaciones en hoteles y hostales de la provincia.' },
    { id: 'ext', n: '% extranjeros', fmt: v => `${nf(v, 0)} %`, f: c => (Pv.tot[c]?.[j] ? ((Pv.ext[c]?.[j] ?? 0) / Pv.tot[c][j]!) * 100 : null), t: `Noches de hotel de extranjeros, ${A}`, nota: 'Qué parte de las noches de hotel son de personas que viven fuera de España.' },
    { id: 'ocup', n: 'Hoteles llenos', fmt: v => `${nf(v, 0)} %`, f: c => d.ocupacion[c]?.ocup ?? null, t: 'Ocupación hotelera por plazas, media de los últimos 12 meses', nota: 'Porcentaje de camas ocupadas en los hoteles abiertos, de media en el último año.' },
    { id: 'viv', n: 'Pisos turísticos', fmt: v => `${nf(v, 1)} %`, f: c => d.viviendas[c]?.pct ?? null, t: 'Viviendas turísticas sobre el total de viviendas', nota: 'Viviendas anunciadas como turísticas en las grandes plataformas, sobre el total de viviendas de la provincia (estadística experimental del INE).' },
  ]
  const I = IND.find(x => x.id === ind)!
  const rk = Object.keys(PROV).map(c => ({ c, v: I.f(c) })).filter((x): x is { c: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const nac = ind === 'hab' ? (Object.values(Pv.tot).reduce((t, s) => t + (s[j] ?? 0), 0) / (Object.values(pob).reduce((a, b) => a + b, 0) || 1)) : ind === 'ocup' ? d.ocupacion['00']?.ocup : ind === 'viv' ? d.viviendas['00']?.pct : ind === 'ext' ? (Object.values(Pv.ext).reduce((t, s) => t + (s[j] ?? 0), 0) / (Object.values(Pv.tot).reduce((t, s) => t + (s[j] ?? 0), 0) || 1)) * 100 : null
  const v = sel ? I.f(sel) : null
  const pts = d.puntos.lista.filter(p => !/establecimientos|^total/i.test(p.n)).slice(0, 15)
  const cc = Object.entries(d.ccaa).filter(([k]) => k !== 'Total').map(([k, s]) => ({ k, v: doce(s.turistas, hasta) })).filter((x): x is { k: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const ccT = doce(d.ccaa.Total?.turistas, hasta) ?? 1
  const per = d.viviendas['00']?.per
  return <div className="graficos">
    <Card wide t={I.t} lead={<>{nac != null && <>En España, <b>{I.fmt(nac)}</b>. </>}Más: <b>{PROV[rk[0]?.c]}</b> ({I.fmt(rk[0]?.v ?? 0)}); menos: {PROV[rk.at(-1)?.c ?? '']} ({I.fmt(rk.at(-1)?.v ?? 0)}).{sel && v != null && <> {PROV[sel]}: <b>{I.fmt(v)}</b>{nac ? <>, un {masMenos(pct(v, nac))} que la media</> : null}.</>}</>} fuente={ind === 'viv' ? VTE : EOH}>
      <Chips items={IND.map(x => ({ id: x.id, n: x.n }))} v={ind} set={x => setInd(x)} />
      <MapaProvincias valor={c => { const x = I.f(c); return x == null ? null : I.raiz ? Math.log(x) : x }} fmt={x => I.fmt(I.raiz ? Math.exp(x) : x)} titulo={I.t} color={ACC} sel={sel} onSel={setSel} nota={`${I.nota}${ind === 'viv' && per ? ` Dato de ${mesLargo(per)}.` : ''}`} />
    </Card>
    <Card t="Ranking de provincias" lead={<>{I.t.charAt(0).toLowerCase() + I.t.slice(1)}. Toca una para verla en el mapa.</>}>
      <Barras titulo={I.t} fmt={I.fmt} limite={12} items={rk.map(x => ({ id: x.c, nombre: PROV[x.c], valor: x.v, destacado: sel === x.c, onClick: () => setSel(x.c), color: ACC }))} />
    </Card>
    <Card t="Las ciudades con más noches de hotel" lead={pts[0] && <>En los 12 meses hasta {mesLargo(d.puntos.hasta)}, <b>{bonito(pts[0].n)}</b> sumó {millones(pts[0].tot, 1)} de noches de hotel, el {nf((pts[0].ext / pts[0].tot) * 100, 0)} % de extranjeros.</>} fuente={EOH}>
      <Barras unidad="Noches de hotel en los últimos 12 meses" suma titulo="Noches de hotel por punto turístico, últimos 12 meses" fmt={v => millones(v, 1)} limite={10} items={pts.map(p => ({ id: p.n, nombre: bonito(p.n), sub: `${nf((p.ext / p.tot) * 100, 0)} % extranjeros`, valor: p.tot, color: ACC }))} />
    </Card>
    <Card t="A qué comunidad van" lead={cc[0] && <>De los turistas internacionales de los últimos 12 meses, {nf((cc[0].v / ccT) * 100, 0)} de cada 100 fueron sobre todo a <b>{cc[0].k}</b>.</>} fuente={FRONTUR}>
      <Barras unidad="Turistas en los últimos 12 meses" suma titulo="Turistas internacionales por comunidad de destino principal, últimos 12 meses" fmt={v => millones(v, 1)} items={cc.map(x => ({ id: x.k, nombre: x.k, valor: x.v, color: ACC }))} limite={8} />
    </Card>
  </div>
}

// ---------- Cuánto gasta ----------
const PAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767']
function Gasto({ d }: { d: D }) {
  // el flujo y el reparto por comunidad, con el último año completo: la tabla anual trae más países y todas las comunidades
  const G = d.gastoPais, año = Object.keys(G.Total?.total ?? {}).filter(k => k.length === 4).sort().at(-1) ?? '', tot = G.Total?.total?.[año] ?? 0
  const pa = Object.keys(G).filter(p => !GRUPO.test(p)).map(p => ({ p, v: G[p].total?.[año] })).filter((x): x is { p: string; v: number } => !!x.v).sort((a, b) => b.v - a.v)
  const izq: NodoSankey[] = pa.slice(0, 7).map((x, k) => ({ id: x.p, nombre: corto(x.p), corto: corto(x.p).length <= 13 ? corto(x.p) : corto(x.p).split(' ')[0], valor: x.v, color: PAL[k] }))
  izq.push({ id: 'resto', nombre: 'Otros países', corto: 'Otros', valor: Math.max(0, tot - izq.reduce((t, n) => t + n.valor, 0)), color: '#5b6b74', rayado: true })
  const cc = Object.keys(d.gastoCcaa).filter(k => k !== 'Total').map(k => ({ k, v: d.gastoCcaa[k].total?.[año] })).filter((x): x is { k: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const der: NodoSankey[] = cc.slice(0, 7).map((x, k) => ({ id: x.k, nombre: x.k, corto: x.k.length <= 13 ? x.k : x.k.split(' ')[0], valor: x.v, color: PAL[k % PAL.length] }))
  der.push({ id: 'otras', nombre: 'Otras comunidades', corto: 'Otras', valor: Math.max(0, tot - der.reduce((t, n) => t + n.valor, 0)), color: '#5b6b74', rayado: true })
  const ms = mesesDe(G.Total?.total), xs = ms.map(m => Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 15))
  const dia = mesesDe(G.Total?.diario)
  const d0 = G.Total?.diario?.[dia.find(m => m.startsWith('2016')) ?? dia[0]], d1 = G.Total?.diario?.[dia.at(-1) ?? ''], d1a = G.Total?.diario?.[atras(dia.at(-1) ?? '', 12)]
  return <div className="graficos">
    <Card wide t="De dónde viene el dinero y a dónde va" lead={<>En {año}, los turistas internacionales gastaron <b>{meur(tot)}</b> en España. A la izquierda, de qué país son; a la derecha, la comunidad a la que fueron sobre todo. Toca una cinta para resaltarla.</>} fuente={EGATUR}>
      <Sankey izq={izq} der={der} centro="ESPAÑA" fmt={meur} titulo={`Gasto de los turistas internacionales por país de residencia y comunidad de destino, ${año}`} alto={420} />
    </Card>
    <Card wide t="Gasto de los turistas, mes a mes" lead={<>Gasto total de los turistas internacionales en cada mes, en millones de euros corrientes.</>} fuente={EGATUR}>
      <LineChart titulo="Gasto de los turistas internacionales por mes" series={[{ id: 'g', nombre: 'Gasto', datos: ms.map((m, i) => [xs[i], G.Total!.total![m]] as [number, number]), color: ACC, area: true }]} fx={t => mesCorto(new Date(t).toISOString().slice(0, 7))} ticksX={xs.filter((_, i) => ms[i].endsWith('-01') && +ms[i].slice(0, 4) % 2 === 0)} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => `${nf(v, 0)} M€`} yMin={0} alto={220} etiquetasFinal={false} />
    </Card>
    <Card t="Lo que gasta un turista al día" lead={d1 != null && d0 != null ? <>En {mesLargo(dia.at(-1)!)}, <b>{nf(d1, 0)} €</b> al día de media{d1a ? <>, un {masMenos(pct(d1, d1a))} que un año antes</> : null}. En {dia.find(m => m.startsWith('2016')) ? '2016' : mesLargo(dia[0])} eran {nf(d0, 0)} €, sin descontar la subida de precios.</> : null} fuente={EGATUR}>
      <LineChart titulo="Gasto medio diario por turista" series={[{ id: 'd', nombre: 'Euros al día', datos: dia.map(m => [Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 15), G.Total!.diario![m]] as [number, number]), color: ACC }]} fx={t => mesCorto(new Date(t).toISOString().slice(0, 7))} fxEje={t => String(new Date(t).getUTCFullYear())} ticksX={dia.filter(m => m.endsWith('-01') && +m.slice(0, 4) % 3 === 0).map(m => Date.UTC(+m.slice(0, 4), 0, 15))} fy={v => `${nf(v, 0)} €`} alto={200} etiquetasFinal={false} />
    </Card>
    <Card t={`Gasto por comunidad, ${año}`} lead={cc[0] && <>{cc[0].k} se lleva {nf((cc[0].v / (tot || 1)) * 100, 0)} de cada 100 € que gastan los turistas internacionales.</>} fuente={EGATUR}>
      <Barras suma titulo={`Gasto de los turistas internacionales por comunidad de destino principal, ${año}`} fmt={meur} items={cc.map(x => ({ id: x.k, nombre: x.k, valor: x.v, color: ACC }))} limite={8} />
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<D | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/turismo.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'quien')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Globe2 size={28} /><p>Contando maletas…</p></main>
  // último mes con turistas y gasto a la vez
  const hasta = mesesDe(d.paises.Total?.turistas).filter(m => d.gastoPais.Total?.total?.[m] != null).at(-1) ?? ''
  const H = d.hotel, pico = H.meses.reduce((b, _m, i) => ((H.esp[i] ?? 0) + (H.ext[i] ?? 0) > (H.esp[b] ?? 0) + (H.ext[b] ?? 0) ? i : b), 0)
  const pv = d.provincias, jp = pv.completos.lastIndexOf(12), pob = d.poblacion.p
  const bal = pv.tot['07']?.[jp] && pob['07'] ? pv.tot['07'][jp]! / pob['07'] : null
  const g = gastoPorPais(d, hasta), ttot = doce(d.paises.Total?.turistas, hasta) ?? 0, hab = Object.values(pob).reduce((a, b) => a + b, 0)
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Turismo</h1>
          <p>Quién nos visita, dónde duerme y cuánto gasta · INE y Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'quien' && <Quien d={d} hasta={hasta} />}
        {sec === 'anio' && <Anio d={d} />}
        {sec === 'donde' && <Donde d={d} hasta={hasta} />}
        {sec === 'gasto' && <Gasto d={d} />}
      </motion.div>
      <Curiosidades titulo="¿Sabías que…?" items={[
        ttot && hab ? <>En los últimos 12 meses llegaron <b>{nf(ttot / hab, 1)} turistas internacionales por cada vecino</b> de España.</> : null,
        bal ? <>En Baleares hubo <b>{nf(bal, 0)} noches de hotel por cada vecino</b> en {pv.años[jp]}.</> : null,
        H.meses[pico] ? <>El mes con más noches de hotel de la historia fue <b>{mesLargo(H.meses[pico])}</b>: {millones((H.esp[pico] ?? 0) + (H.ext[pico] ?? 0), 1)} de noches: {nf(((H.esp[pico] ?? 0) + (H.ext[pico] ?? 0)) / new Date(Date.UTC(+H.meses[pico].slice(0, 4), +H.meses[pico].slice(5), 0)).getUTCDate() / 1e6, 2)} millones de personas durmiendo en un hotel cada noche.</> : null,
        g[0] ? <>Un turista de {corto(g[0].p)} gasta de media {nf(g[0].persona, 0)} € por viaje y se queda {nf(g[0].dias, 1)} días.</> : null,
      ]} />
      <Fuentes ids={[]} extra={[
        { n: 'INE · FRONTUR (turistas internacionales)', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=10822' },
        { n: 'INE · EGATUR (gasto turístico)', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=10838' },
        { n: 'INE · Encuesta de Ocupación Hotelera', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=2074' },
        { n: 'INE · Viviendas turísticas (experimental)', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=46141' },
        { n: 'Eurostat · Noches en alojamientos turísticos (tour_occ_ninat)', u: 'https://ec.europa.eu/eurostat/databrowser/view/tour_occ_ninat/default/table?lang=es' },
      ]} />
      <p className="src">Turistas: quienes vienen del extranjero y pasan al menos una noche. Noches de hotel: hoteles y hostales (sin apartamentos, campings ni pisos turísticos). Gasto en euros corrientes. Datos de {d.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
