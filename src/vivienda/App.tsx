import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Gauge, Home, KeyRound, Landmark, Search, TrendingUp } from 'lucide-react'
import { Apiladas, Barras, CountUp, LineChart, nf } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { edificio } from '../holo3d/modelos'
import { ESCALA_CALOR, MapaProvincias, colorEscala } from '../geo/MapaProvincias'
import { ccaaCorta, codigoProvincia } from '../geo/provincias'
import { CCAA_DE_PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'

const ACC = '#ffd166', NUEVA = '#3987e5', USADA = '#d95926'
type Ser = [string, number][]
type Datos = {
  fecha: string; tablas: Record<string, number>
  ipv: Record<string, Partial<Record<'gi' | 'ga' | 'ni' | 'na' | 'ui' | 'ua', Ser>>>
  compraventas: Record<string, Partial<Record<'total' | 'nueva' | 'usada', Ser>>>
  hipotecas: Record<string, Partial<Record<'num' | 'imp', Ser>>>
  alquiler: Record<string, Partial<Record<'i' | 'a', Ser>>>
}
const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'precios', nombre: 'Precios', icon: TrendingUp },
  { id: 'compraventas', nombre: 'Compraventas', icon: Home },
  { id: 'hipotecas', nombre: 'Hipotecas', icon: Landmark },
  { id: 'alquiler', nombre: 'Alquiler', icon: KeyRound },
] as const
type Sec = (typeof SECCIONES)[number]['id']

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
/** «2026-09» → fecha; «2025-T4» → mitad del trimestre; «2024» → mitad del año. */
const toT = (p: string) => { const m = p.match(/^(\d{4})-(\d{2})$/); if (m) return Date.UTC(+m[1], +m[2] - 1, 15); const q = p.match(/^(\d{4})-T(\d)$/); if (q) return Date.UTC(+q[1], (+q[2] - 1) * 3 + 1, 15); return Date.UTC(+p.slice(0, 4), 6, 1) }
const per = (p: string) => { const m = p.match(/^(\d{4})-(\d{2})$/); if (m) return `${MES[+m[2] - 1]} ${m[1]}`; const q = p.match(/^(\d{4})-T(\d)$/); if (q) return `${q[2]}.º trim. ${q[1]}`; return p }
const anio = (t: number) => String(new Date(t).getUTCFullYear())
const pts = (s: Ser | undefined, desde = -Infinity) => (s ?? []).map(([p, v]) => [toT(p), v] as [number, number]).filter(x => x[0] >= desde)
const suma12 = (s: Ser | undefined, fin = 0) => (s ?? []).slice(-(12 + fin), fin ? -fin : undefined).reduce((t, x) => t + x[1], 0)
const pct = (v: number, d = 1) => `${v > 0 ? '+' : ''}${nf(v, d)} %`
const eur = (v: number) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const ineUrl = (t: number) => <a href={`https://www.ine.es/jaxiT3/Tabla.htm?t=${t}`} target="_blank" rel="noopener noreferrer">INE, tabla {t}</a>

/** Las provincias de una serie territorial (descartando las comunidades, que vienen mezcladas). */
function porProvincia<T>(d: Record<string, T>) {
  const m = new Map<string, T>()
  for (const [n, v] of Object.entries(d)) { if (n === 'España') continue; const c = codigoProvincia(n); if (c && (!ccaaCorta(n) || !m.has(c))) { if (!ccaaCorta(n) || ['Cantabria', 'La Rioja', 'Illes Balears'].includes(ccaaCorta(n)!)) m.set(c, v); else if (!m.has(c)) m.set(c, v) } }
  return m
}

function Resumen({ d, euribor, go }: { d: Datos; euribor: Ser | null; go: (s: Sec) => void }) {
  const e = d.ipv['España'], cv = d.compraventas['España'], hp = d.hipotecas['España']
  const ga = e?.ga?.at(-1), c12 = suma12(cv?.total), c12a = suma12(cv?.total, 12)
  const h12 = suma12(hp?.num), imp = hp?.imp && hp.num ? (hp.imp.at(-1)![1] * 1000) / hp.num.at(-1)![1] : null
  const al = d.alquiler['España']?.a?.at(-1), eu = euribor?.at(-1)
  const pico = cv?.total ? [...cv.total].sort((a, b) => b[1] - a[1])[0] : null
  const boom = cv?.total ? cv.total.filter(x => x[0] < '2008-12').reduce((m, x) => (x[1] > m[1] ? x : m), cv.total[0]) : null
  const suelo = cv?.total ? cv.total.filter(x => x[0] > '2009' && x[0] < '2015').reduce((m, x) => (x[1] < m[1] ? x : m), ['', Infinity] as [string, number]) : null
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={edificio(Math.min(0.9, Math.max(0.2, (ga?.[1] ?? 5) / 15)))} color={ACC} alto={250} etiqueta="Holograma: bloque de viviendas" />
        <div className="sala-dato">
          <span className="sala-k">Precio de la vivienda, {ga ? per(ga[0]) : ''}</span>
          <b>{ga ? <CountUp value={ga[1]} fmt={v => pct(v)} /> : '—'}</b>
          <span>es lo que ha subido el precio de la vivienda en un año en España{e?.na && e?.ua && <>: la nueva un {pct(e.na.at(-1)![1])} y la de segunda mano un {pct(e.ua.at(-1)![1])}</>}. {c12 > 0 && <>En los últimos 12 meses se vendieron <b>{nf(c12)}</b> viviendas, un {nf(Math.abs(c12 / c12a - 1) * 100, 0)} % {c12 >= c12a ? 'más' : 'menos'} que el año anterior.</>}</span>
        </div>
      </div>
    </section>
    <div className="kpis is-wide">
      {ga && <button className="kpi" onClick={() => go('precios')}><span className="kpi-l">Precio, en un año</span><span className="kpi-v"><CountUp value={ga[1]} fmt={v => pct(v)} /></span><span className="kpi-p">{per(ga[0])}</span></button>}
      {c12 > 0 && <button className="kpi" onClick={() => go('compraventas')}><span className="kpi-l">Viviendas vendidas</span><span className="kpi-v"><CountUp value={c12} fmt={v => nf(v)} /></span><span className="kpi-p">últimos 12 meses, hasta {per(cv!.total!.at(-1)![0])}</span></button>}
      {imp && <button className="kpi" onClick={() => go('hipotecas')}><span className="kpi-l">Hipoteca media</span><span className="kpi-v"><CountUp value={imp} fmt={eur} /></span><span className="kpi-p">{nf(h12)} hipotecas en 12 meses</span></button>}
      {al && <button className="kpi" onClick={() => go('alquiler')}><span className="kpi-l">Alquiler, en un año</span><span className="kpi-v"><CountUp value={al[1]} fmt={v => pct(v)} /></span><span className="kpi-p">contratos vivos, {al[0]}</span></button>}
      {eu && <div className="kpi"><span className="kpi-l">Euríbor a 12 meses</span><span className="kpi-v"><CountUp value={eu[1]} fmt={v => `${nf(v, 2)} %`} /></span><span className="kpi-p">{per(eu[0])}</span></div>}
    </div>
    {cv?.total && <Card t="La vivienda en España, desde 2007" wide lead={<>Compraventas de viviendas cada mes. {boom && suelo && <>Tras la burbuja, se pasó de {nf(boom[1])} ventas en {per(boom[0])} a solo {nf(suelo[1])} en {per(suelo[0])}. </>}{pico && pico[0] > '2014' && <>Desde entonces, el mes con más ventas fue {per(pico[0])}, con {nf(pico[1])}.</>}</>} fuente={ineUrl(d.tablas.compraventas)}>
      <Apiladas unidad="Viviendas vendidas al mes" xs={cv.total.map(x => toT(x[0]))} capas={[{ id: 'u', nombre: 'Segunda mano', color: USADA, v: (cv.usada ?? []).map(x => x[1]) }, { id: 'n', nombre: 'Nueva', color: NUEVA, v: (cv.nueva ?? []).map(x => x[1]) }]} titulo="Compraventas de viviendas al mes" fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={v => nf(v)} alto={240} />
    </Card>}
  </div>
}

function Precios({ d }: { d: Datos }) {
  const [sel, setSel] = useState<string | null>(null)
  const e = d.ipv['España']
  const ccaa = Object.entries(d.ipv).filter(([k]) => k !== 'España').map(([k, v]) => ({ k, n: ccaaCorta(k) ?? k, a: v.ga?.at(-1)?.[1] ?? null, i: v.gi?.at(-1)?.[1] ?? null })).filter(x => x.a != null).sort((a, b) => b.a! - a.a!)
  const porCcaa = new Map(ccaa.map(x => [x.n, x.a]))
  const ult = e?.ga?.at(-1)
  const max07 = e?.gi ? e.gi.filter(x => x[0] < '2009').reduce((m, x) => (x[1] > m[1] ? x : m), e.gi[0]) : null
  const gi = e?.gi?.at(-1)
  // ¿Qué año vale 100? Se calcula del propio dato (el INE cambia de base: 2015, 2025…)
  const base = (() => { const m = new Map<string, number[]>(); for (const [p, v] of e?.gi ?? []) m.set(p.slice(0, 4), [...(m.get(p.slice(0, 4)) ?? []), v]); return [...m].map(([y, vs]) => [y, Math.abs(vs.reduce((a, b) => a + b, 0) / vs.length - 100)] as const).sort((a, b) => a[1] - b[1])[0]?.[0] })()
  return <div className="graficos">
    <Card t="¿Cuánto sube la vivienda?" wide lead={<>{ult && <>En el {per(ult[0])} el precio subía un <b>{pct(ult[1])}</b> en un año. </>}{max07 && gi && <>El índice está en {nf(gi[1], 0)}, {gi[1] > max07[1] ? <>ya por encima del máximo de la burbuja ({nf(max07[1], 0)} en {per(max07[0])})</> : <>todavía por debajo del máximo de la burbuja ({nf(max07[1], 0)} en {per(max07[0])})</>}. {(() => { const y15 = e?.gi?.filter(x => x[0].startsWith('2015')); const v15 = y15?.length ? y15.reduce((a, b) => a + b[1], 0) / y15.length : null; return <> Cómo leerlo: {base} vale 100{v15 && base !== '2015' ? <>, y 2015 vale {nf(v15, 0)}: una casa que en {base} costaba 100.000 € costaba unos {nf(v15 * 1000, 0)} € en 2015</> : ''}.</> })()}</>}</>} fuente={<>{ineUrl(d.tablas.ipv)} · índice de precios de vivienda, base {base} = 100</>}>
      <LineChart unidad={`Índice: la media de ${base} vale 100 (por eso cada trimestre de ${base} queda algo por encima o por debajo)`} titulo="Índice de precios de vivienda" series={[{ id: 'g', nombre: 'General', datos: pts(e?.gi), color: ACC, area: true }, { id: 'n', nombre: 'Nueva', datos: pts(e?.ni), color: NUEVA }, { id: 'u', nombre: 'Segunda mano', datos: pts(e?.ui), color: USADA }]} fx={t => per(new Date(t).toISOString().slice(0, 7).replace(/-(\d\d)$/, (_, m) => `-T${Math.ceil(+m / 3)}`))} fxEje={anio} fy={v => nf(v, 0)} />
    </Card>
    <Card t="Por comunidades" lead={<>Variación anual del precio. Donde más sube: <b>{ccaa[0]?.n}</b> ({pct(ccaa[0]?.a ?? 0)}); donde menos, {ccaa.at(-1)?.n} ({pct(ccaa.at(-1)?.a ?? 0)}). Toca el mapa.</>}>
      <MapaProvincias grupo={c => CCAA_DE_PROV[c] ?? null} claveGrupo="ccaa" valor={r => porCcaa.get(r) ?? null} fmt={v => pct(v)} titulo="Subida del precio de la vivienda por comunidad" color={ACC} escala={ESCALA_CALOR} sel={sel} onSel={setSel} nota="Cuanto más sube, más oscuro y rojo. El INE da este dato por comunidad, no por provincia." />
    </Card>
    <Card t="Ranking">
      <Barras titulo="Subida anual del precio por comunidad" fmt={v => pct(v)} limite={19} items={ccaa.map(x => ({ id: x.k, nombre: x.n, valor: x.a!, color: colorEscala(ESCALA_CALOR, (x.a! - ccaa.at(-1)!.a!) / ((ccaa[0].a! - ccaa.at(-1)!.a!) || 1)), destacado: sel === x.n, onClick: () => setSel(x.n) }))} />
    </Card>
  </div>
}

function Compraventas({ d }: { d: Datos }) {
  const [sel, setSel] = useState<string | null>(null)
  const prov = useMemo(() => porProvincia(d.compraventas), [d])
  const cambio = (c: string) => { const s = prov.get(c)?.total; if (!s || s.length < 24) return null; const a = suma12(s), b = suma12(s, 12); return b ? (a / b - 1) * 100 : null }
  const vol = (c: string) => { const s = prov.get(c)?.total; return s ? suma12(s) : null }
  const [modo, setModo] = useState<'vol' | 'cambio'>('vol')
  const rk = [...prov.keys()].map(c => ({ c, v: modo === 'vol' ? vol(c) : cambio(c) })).filter(x => x.v != null).sort((a, b) => b.v! - a.v!)
  const nombre = (c: string) => [...Object.keys(d.compraventas)].find(n => codigoProvincia(n) === c && !ccaaCorta(n)) ?? c
  const s = sel ? prov.get(sel) : null
  const tot = d.compraventas['España']?.total, nuevaPct = tot && d.compraventas['España']?.nueva ? (suma12(d.compraventas['España'].nueva) / suma12(tot)) * 100 : null
  return <div className="graficos">
    <Card t="Dónde se venden casas" wide lead={<>Viviendas vendidas en los últimos 12 meses en cada provincia{modo === 'cambio' ? ', comparado con los 12 anteriores' : ''}. {nuevaPct != null && <>Solo el <b>{nf(nuevaPct, 0)} %</b> de las que se venden en España son nuevas.</>}</>} fuente={ineUrl(d.tablas.compraventas)}>
      <div className="modo" role="radiogroup" aria-label="Qué ver">{(['vol', 'cambio'] as const).map(m => <button key={m} role="radio" aria-checked={modo === m} className={modo === m ? 'is-on' : ''} onClick={() => setModo(m)}>{m === 'vol' ? 'Cuántas' : 'Cuánto cambian'}</button>)}</div>
      <MapaProvincias valor={modo === 'vol' ? vol : cambio} fmt={modo === 'vol' ? (v => nf(v)) : (v => pct(v, 0))} titulo="Compraventas de viviendas por provincia" color={ACC} divergente={modo === 'cambio' ? ['#3987e5', '#ffd166'] : undefined} sel={sel} onSel={setSel} />
    </Card>
    {sel && s?.total && <Card t={nombre(sel)} lead={<>{nf(suma12(s.total))} viviendas vendidas en 12 meses{cambio(sel) != null && <> ({pct(cambio(sel)!, 0)} sobre el año anterior)</>}.</>}>
      <LineChart unidad="Viviendas vendidas al mes" titulo={`Compraventas en ${nombre(sel)}`} series={[{ id: 't', nombre: 'Total', datos: pts(s.total), color: ACC, area: true }]} fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={v => nf(v)} alto={190} />
    </Card>}
    <Card t="Ranking de provincias">
      <Barras titulo="Provincias por compraventas" fmt={modo === 'vol' ? (v => nf(v)) : (v => pct(v, 0))} limite={12} items={rk.map(x => ({ id: x.c, nombre: nombre(x.c), valor: x.v!, color: ACC, destacado: x.c === sel, onClick: () => setSel(x.c) }))} />
    </Card>
  </div>
}

function Hipotecas({ d, euribor }: { d: Datos; euribor: Ser | null }) {
  const [sel, setSel] = useState<string | null>(null)
  const prov = useMemo(() => porProvincia(d.hipotecas), [d])
  const media = (c: string) => { const h = prov.get(c); if (!h?.imp || !h.num) return null; const i = suma12(h.imp), n = suma12(h.num); return n ? (i * 1000) / n : null }
  const e = d.hipotecas['España']
  const mediaEs = e?.imp && e?.num ? (suma12(e.imp) * 1000) / suma12(e.num) : null
  const serieMedia = (e?.num ?? []).map(([p, n], i) => [toT(p), n ? ((e!.imp![i]?.[1] ?? 0) * 1000) / n : 0] as [number, number])
  const rk = [...prov.keys()].map(c => ({ c, v: media(c) })).filter(x => x.v != null).sort((a, b) => b.v! - a.v!)
  const nombre = (c: string) => Object.keys(d.hipotecas).find(n => codigoProvincia(n) === c) ?? c
  return <div className="graficos">
    <Card t="Hipotecas sobre viviendas" wide lead={<>Cuántas se firman cada mes y de cuánto son de media. En los últimos 12 meses, la hipoteca media fue de <b>{mediaEs ? eur(mediaEs) : '—'}</b>.</>} fuente={ineUrl(d.tablas.hipotecas)}>
      <LineChart unidad="Hipotecas sobre viviendas al mes" titulo="Hipotecas sobre viviendas al mes" series={[{ id: 'n', nombre: 'Hipotecas firmadas', datos: pts(e?.num), color: ACC, area: true }]} fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={v => nf(v)} alto={200} />
      <LineChart titulo="Importe medio de la hipoteca" series={[{ id: 'm', nombre: 'Importe medio', datos: serieMedia, color: NUEVA }]} fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={v => `${nf(v / 1000, 0)} mil €`} alto={180} />
    </Card>
    {euribor && <Card t="Euríbor" lead="El tipo al que se revisan la mayoría de hipotecas variables.">
      <LineChart titulo="Euríbor a 12 meses" series={[{ id: 'e', nombre: 'Euríbor', datos: pts(euribor), color: ACC, area: true }]} fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={v => `${nf(v, 1)} %`} alto={180} />
    </Card>}
    <Card t="Hipoteca media por provincia" wide lead={rk[0] && <>Últimos 12 meses. La más alta, <b>{nombre(rk[0].c)}</b> ({eur(rk[0].v!)}); la más baja, {nombre(rk.at(-1)!.c)} ({eur(rk.at(-1)!.v!)}).</>}>
      <MapaProvincias valor={media} fmt={eur} titulo="Importe medio de la hipoteca por provincia" color={ACC} escala={ESCALA_CALOR} sel={sel} onSel={setSel} nota="Cuanto más alta la hipoteca, más oscuro y rojo." />
      <Barras titulo="Ranking de hipoteca media" fmt={eur} limite={10} items={rk.map(x => ({ id: x.c, nombre: nombre(x.c), valor: x.v!, color: ACC, destacado: x.c === sel, onClick: () => setSel(x.c) }))} />
    </Card>
  </div>
}

function Alquiler({ d }: { d: Datos }) {
  const [q, setQ] = useState('')
  const e = d.alquiler['España']
  const munis = Object.entries(d.alquiler).filter(([k, v]) => k !== 'España' && !k.startsWith('Resto') && v.a?.length).map(([k, v]) => ({ k, a: v.a!.at(-1)!, i: v.i?.at(-1) ?? null, cinco: v.i && v.i.length > 5 ? (v.i.at(-1)![1] / v.i.at(-6)![1] - 1) * 100 : null }))
  const sube = [...munis].sort((a, b) => b.a[1] - a.a[1]), año = e?.a?.at(-1)?.[0]
  const qn = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const busca = q.length >= 2 ? munis.filter(m => m.k.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(qn)).slice(0, 8) : []
  return <div className="graficos">
    <Card t="Lo que sube el alquiler" wide lead={<>Índice de precios de vivienda en alquiler del INE, sacado de las declaraciones de la renta. En {año}, los alquileres subieron un <b>{pct(e?.a?.at(-1)?.[1] ?? 0)}</b> en España. Es un dato anual que se publica con retraso: refleja contratos vivos, no solo los nuevos.</>} fuente={<>{ineUrl(d.tablas.alquiler)} · índice de precios de vivienda en alquiler (2015 = 100)</>}>
      <LineChart unidad={`Índice: ${baseDe(e?.i) ?? "el año base"} = 100`} titulo="Índice de alquiler en España" series={[{ id: 'i', nombre: 'Índice', datos: pts(e?.i), color: ACC, area: true }]} fx={anio} fy={v => nf(v, 0)} alto={190} />
    </Card>
    <Card t="Busca tu municipio" lead={`Los ${nf(munis.length)} municipios con dato del INE.`}>
      <label className="buscar"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Escribe un municipio…" aria-label="Buscar municipio" /></label>
      {busca.length > 0 && <ul className="resultados">{busca.map(m => <li key={m.k}><b>{m.k}</b><span>{pct(m.a[1])} en {m.a[0]}{m.cinco != null && <> · {pct(m.cinco, 0)} en 5 años</>}</span></li>)}</ul>}
      {q.length >= 2 && busca.length === 0 && <p className="note">No hay dato para ese municipio: el INE solo publica los que tienen suficientes alquileres declarados.</p>}
    </Card>
    <Card t="Donde más sube">
      <Barras titulo="Municipios donde más sube el alquiler" fmt={v => pct(v)} limite={12} items={sube.slice(0, 30).map(m => ({ id: m.k, nombre: m.k, valor: m.a[1], color: ACC }))} />
    </Card>
    <Card t="Donde menos sube">
      <Barras titulo="Municipios donde menos sube el alquiler" fmt={v => pct(v)} limite={12} items={sube.slice(-30).reverse().map(m => ({ id: m.k, nombre: m.k, valor: m.a[1], color: '#3987e5' }))} />
    </Card>
  </div>
}

/** El año cuya media vale 100 (el INE cambia de base: 2015, 2025…). */
function baseDe(serie?: [string, number][]) {
  const m = new Map<string, number[]>(); for (const [p, v] of serie ?? []) m.set(String(p).slice(0, 4), [...(m.get(String(p).slice(0, 4)) ?? []), v])
  return [...m].map(([y, vs]) => [y, Math.abs(vs.reduce((a, b) => a + b, 0) / vs.length - 100)] as const).sort((a, b) => a[1] - b[1])[0]?.[0]
}

export default function App() {
  const [d, setD] = useState<Datos | null>(null), [err, setErr] = useState(false)
  const [euribor, setEuribor] = useState<Ser | null>(null)
  useEffect(() => {
    fetch('./data/vivienda.json').then(r => r.json()).then(setD, () => setErr(true))
    fetch('../economia/data/series.json').then(r => r.json()).then(j => setEuribor(j.temas?.vivienda?.euribor?.d ?? null), () => {})
  }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Home size={28} /><p>Cargando la vivienda…</p></main>
  const e = d.ipv['España'], cv = d.compraventas['España']
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Vivienda</h1>
          <p>Comprar, alquilar e hipotecarse en España · INE</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <Resumen d={d} euribor={euribor} go={go} />}
        {sec === 'precios' && <Precios d={d} />}
        {sec === 'compraventas' && <Compraventas d={d} />}
        {sec === 'hipotecas' && <Hipotecas d={d} euribor={euribor} />}
        {sec === 'alquiler' && <Alquiler d={d} />}
      </motion.div>
      {sec === 'resumen' && e?.gi && cv?.total && <Curiosidades titulo="¿Sabías que…?" items={[
        (() => { const a = e.gi!.at(-1)!, b = e.gi!.find(x => x[0].startsWith('2015')); return b && <>Desde 2015 la vivienda se ha encarecido un <b>{nf((a[1] / b[1] - 1) * 100, 0)} %</b>.</> })(),
        (() => { const año = new Map<string, number>(); for (const [p, v] of cv.total!) año.set(p.slice(0, 4), (año.get(p.slice(0, 4)) ?? 0) + v); const c = [...año].filter(([y]) => +y < new Date().getFullYear()); const m = c.reduce((x, y) => (y[1] > x[1] ? y : x)), n = c.reduce((x, y) => (y[1] < x[1] ? y : x)); return <>El año con más ventas fue <b>{m[0]}</b> ({nf(m[1])} viviendas) y el de menos, {n[0]} ({nf(n[1])}).</> })(),
        cv.nueva && <>De cada 10 casas que se venden, {nf((suma12(cv.nueva) / suma12(cv.total)) * 10, 0)} son nuevas: el resto, de segunda mano.</>,
      ]} />}
      <Fuentes ids={[]} extra={[{ n: 'INE · Índice de precios de vivienda', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.ipv}` }, { n: 'INE · Transmisiones de derechos de la propiedad', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.compraventas}` }, { n: 'INE · Hipotecas', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.hipotecas}` }, { n: 'INE · Índice de alquiler', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.alquiler}` }]} />
      <p className="src">Datos del INE descargados cada semana. El precio es un índice, no euros por metro cuadrado: el valor por metro cuadrado del Ministerio de Vivienda llegará en una próxima versión.</p>
    </main>
  )
}
