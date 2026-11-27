import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Gauge, Home, KeyRound, Landmark, Moon, Scale, Search, TrendingUp } from 'lucide-react'
import { Apiladas, Barras, ColApiladas, CountUp, LineChart, nf } from '../graficos'
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
  { id: 'vacias', nombre: 'Vacías', icon: Moon },
  { id: 'tenencia', nombre: 'Tenencia', icon: Scale },
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

type Fila = { cod: string; n: string; t: number; v: number; m?: number; b?: number; e?: number; ccaa?: string }
type Tenen = Record<string, Record<string, [number, number][]>>
type Extra = {
  nacional?: Fila; ccaa?: Fila[]; provincias?: Fila[]; topAbs?: Fila[]; topPct?: Fila[]; menosPct?: Fila[]; nMunicipios?: number
  tenenciaCcaa?: Tenen; tenenciaEdad?: Tenen; tenenciaTamano?: { reg: string; tam: string; v: number }[]
}
const CAT = [
  { id: 'Propiedad sin hipoteca', nombre: 'Propiedad, sin hipoteca', color: '#3987e5' },
  { id: 'Propiedad con hipoteca', nombre: 'Propiedad, con hipoteca', color: '#9085e9' },
  { id: 'Alquiler a precio de mercado', nombre: 'Alquiler a precio de mercado', color: '#d95926' },
  { id: 'Alquiler inferior al precio de mercado', nombre: 'Alquiler más barato que el mercado', color: '#c98500' },
  { id: 'Cesión', nombre: 'Cesión gratuita o semigratuita', color: '#199e70' },
]
const ultimo = (s?: [number, number][]) => s?.at(-1)

function Vacias({ x }: { x: Extra }) {
  const [sel, setSel] = useState<string | null>(null)
  const [modo, setModo] = useState<'pct' | 'num'>('pct')
  const prov = x.provincias ?? [], nac = x.nacional
  if (!nac) return <div className="graficos"><Card t="Viviendas vacías"><p className="note">Todavía no hay datos del Censo cargados.</p></Card></div>
  const porCod = new Map(prov.map(p => [p.cod, p]))
  const pctV = (f: Fila) => (f.v / f.t) * 100
  const valor = (c: string) => { const f = porCod.get(c); return f ? (modo === 'pct' ? pctV(f) : f.v) : null }
  const rk = [...prov].sort((a, b) => (modo === 'pct' ? pctV(b) - pctV(a) : b.v - a.v))
  const provDe = (cod: string) => porCod.get(cod.slice(0, 2))?.n
  const s = sel ? porCod.get(sel) : null
  const esp = nac.e ?? 0, bajo = nac.b ?? 0
  return <div className="graficos">
    <Card t="Casas sin nadie dentro" wide lead={<>El Censo 2021 del INE mira el consumo de luz de cada vivienda durante un año: si es casi cero, la da por <b>vacía</b>. Salen <b>{nf(nac.v)}</b> de {nf(nac.t)}: un <b>{nf(pctV(nac), 1)} %</b>. Otras {nf(esp)} ({nf((esp / nac.t) * 100, 1)} %) tienen un uso esporádico, típico de segundas residencias. Es una <b>estimación</b>: vacía no significa que esté en venta ni en alquiler.</>} fuente={<a href="https://www.ine.es/jaxiT3/Tabla.htm?t=59531" target="_blank" rel="noopener noreferrer">INE, Censos 2021, tabla 59531</a>}>
      <div className="modo" role="radiogroup" aria-label="Qué ver">{(['pct', 'num'] as const).map(m => <button key={m} role="radio" aria-checked={modo === m} className={modo === m ? 'is-on' : ''} onClick={() => setModo(m)}>{m === 'pct' ? 'Qué parte' : 'Cuántas'}</button>)}</div>
      <MapaProvincias valor={valor} fmt={modo === 'pct' ? (v => `${nf(v, 1)} %`) : (v => nf(v))} titulo="Viviendas vacías por provincia" color={ACC} escala={ESCALA_CALOR} sel={sel} onSel={setSel} nota="Cuanto más oscuro y rojo, más viviendas vacías." />
    </Card>
    {s && <Card t={s.n} lead={<>{nf(s.v)} viviendas vacías de {nf(s.t)} ({nf(pctV(s), 1)} %), y {nf(s.e ?? 0)} de uso esporádico. {pctV(s) > pctV(nac) ? 'Más' : 'Menos'} que la media de España ({nf(pctV(nac), 1)} %).</>}>
      <Barras titulo={`Uso de las viviendas en ${s.n}`} fmt={v => nf(v)} unidad="viviendas" limite={4} items={[{ id: 'v', nombre: 'Vacías', valor: s.v, color: ACC }, { id: 'e', nombre: 'Uso esporádico', valor: s.e ?? 0, color: '#d95926' }, { id: 'b', nombre: 'Consumo bajo', valor: s.b ?? 0, color: '#3987e5' }]} />
    </Card>}
    <Card t="Ranking de provincias" lead={rk[0] && <>{modo === 'pct' ? 'Mayor proporción' : 'Más viviendas vacías'}: <b>{rk[0].n}</b> ({modo === 'pct' ? `${nf(pctV(rk[0]), 1)} %` : nf(rk[0].v)}). En el otro extremo, {rk.at(-1)!.n} ({modo === 'pct' ? `${nf(pctV(rk.at(-1)!), 1)} %` : nf(rk.at(-1)!.v)}).</>}>
      <Barras titulo="Provincias por viviendas vacías" fmt={modo === 'pct' ? (v => `${nf(v, 1)} %`) : (v => nf(v))} limite={12} items={rk.map(p => ({ id: p.cod, nombre: p.n, valor: modo === 'pct' ? pctV(p) : p.v, color: ACC, destacado: p.cod === sel, onClick: () => setSel(p.cod) }))} />
    </Card>
    {x.topPct && <Card t="Pueblos con más casas vacías" lead={<>Entre los {nf(x.nMunicipios ?? 0)} municipios con dato, los que tienen al menos 5.000 viviendas y mayor proporción de vacías. Suelen ser zonas de turismo de costa o de despoblación.</>}>
      <Barras titulo="Municipios con mayor proporción de viviendas vacías" fmt={v => `${nf(v, 0)} %`} limite={12} items={x.topPct.map(f => ({ id: f.cod, nombre: `${f.n}${provDe(f.cod) ? ` (${provDe(f.cod)})` : ''}`, valor: pctV(f), color: ACC }))} />
    </Card>}
    {x.topAbs && <Card t="Ciudades con más vacías" lead="En cifras absolutas mandan las ciudades grandes, aunque su proporción sea baja.">
      <Barras titulo="Municipios con más viviendas vacías" fmt={v => nf(v)} unidad="viviendas" limite={10} items={x.topAbs.map(f => ({ id: f.cod, nombre: f.n, valor: f.v, color: '#3987e5' }))} />
    </Card>}
    {x.ccaa && <Curiosidades titulo="¿Sabías que…?" items={[
      (() => { const c = [...x.ccaa!].sort((a, b) => pctV(b) - pctV(a)); return <>Por comunidades, la proporción más alta de viviendas vacías es la de <b>{c[0].n}</b> ({nf(pctV(c[0]), 1)} %) y la más baja la de {c.at(-1)!.n} ({nf(pctV(c.at(-1)!), 1)} %).</> })(),
      <>Sumando vacías y de uso esporádico, <b>{nf(((nac.v + esp) / nac.t) * 100, 0)} de cada 100</b> viviendas de España se usan poco o nada.</>,
      bajo > 0 && <>Otras {nf(bajo)} viviendas tienen un consumo bajo pero no nulo: alguien las usa, aunque poco.</>,
    ]} />}
    <Card t="Lo que no hay en abierto">
      <p className="note">No existe una cifra oficial abierta de «viviendas en venta» ni de «viviendas en alquiler disponibles», ni de demanda real: los portales inmobiliarios no publican datos libres. Tampoco he podido descargar los titulares del Catastro (cuántas viviendas tiene cada propietario, personas físicas o empresas): su portal de estadísticas no ofrece el fichero de forma automática. Cuando haya una fuente libre y estable, entrará aquí.</p>
    </Card>
  </div>
}

function Tenencia({ x }: { x: Extra }) {
  const [sel, setSel] = useState<string | null>(null)
  const [cat, setCat] = useState<'Propiedad' | 'Alquiler a precio de mercado'>('Propiedad')
  const nac = x.tenenciaCcaa?.['Total Nacional']
  if (!nac) return <div className="graficos"><Card t="Régimen de tenencia"><p className="note">Todavía no hay datos de tenencia cargados.</p></Card></div>
  const anios = (nac.Propiedad ?? []).map(a => a[0])
  const aniosCat = (nac['Propiedad sin hipoteca'] ?? []).map(a => a[0])
  const val = (s: Record<string, [number, number][]> | undefined, c: string, y: number) => s?.[c]?.find(a => a[0] === y)?.[1] ?? 0
  const ult = anios.at(-1)!
  const prop = ultimo(nac.Propiedad)![1], mer = ultimo(nac['Alquiler a precio de mercado'])?.[1] ?? 0
  const prop0 = nac.Propiedad.find(a => a[0] === 2008)?.[1], mer0 = nac['Alquiler a precio de mercado'].find(a => a[0] === 2008)?.[1]
  const ccaa = Object.entries(x.tenenciaCcaa ?? {}).filter(([k]) => k !== 'Total Nacional').map(([k, v]) => ({ k, n: ccaaCorta(k) ?? k, v: ultimo(v[cat])?.[1] ?? null })).filter(c => c.v != null).sort((a, b) => b.v! - a.v!)
  const porCcaa = new Map(ccaa.map(c => [c.n, c.v]))
  const edades = ['De 16 a 29 años', 'De 30 a 44 años', 'De 45 a 64 años', '65 y más años']
  const ed = (g: string) => x.tenenciaEdad?.[`Ambos sexos · ${g} · Total Nacional`]
  const joven = ed(edades[0]), mayor = ed(edades[3])
  const tam = (x.tenenciaTamano ?? []).filter(r => r.tam !== 'Total (tamaño de municipio)')
  const tams = [...new Set(tam.map(r => r.tam))]
  const propTam = tams.map(t => { const tot = tam.find(r => r.tam === t && r.reg === 'Total (régimen de tenencia)')?.v, p = tam.find(r => r.tam === t && r.reg === 'En propiedad')?.v; return tot && p ? { t, v: (p / tot) * 100 } : null }).filter((r): r is { t: string; v: number } => !!r)
  return <div className="graficos">
    <Card t="¿Propietarios o inquilinos?" wide lead={<>En {ult}, el <b>{nf(prop, 1)} %</b> de los hogares vivía en una casa en propiedad y el <b>{nf(mer, 1)} %</b> en alquiler a precio de mercado.{prop0 != null && mer0 != null && <> En 2008 eran el {nf(prop0, 1)} % y el {nf(mer0, 1)} %: la propiedad {prop < prop0 ? 'baja' : 'sube'} y el alquiler {mer > mer0 ? 'sube' : 'baja'}.</>} Encuesta de Condiciones de Vida; el desglose por tipo empieza en {aniosCat[0]}.</>} fuente={<a href="https://www.ine.es/jaxiT3/Tabla.htm?t=9997" target="_blank" rel="noopener noreferrer">INE, ECV, tabla 9997</a>}>
      <ColApiladas titulo="Cómo viven los hogares españoles" xs={aniosCat.map(String)} cadaX={2} total={false} unidad="% de hogares" fy={v => `${nf(v, 0)} %`} tramos={CAT.map(c => ({ id: c.id, nombre: c.nombre, color: c.color, v: aniosCat.map(y => val(nac, c.id, y)) }))} alto={240} />
    </Card>
    {joven && mayor && <Card t="Según la edad" lead={<>Entre 16 y 29 años, solo el <b>{nf(ultimo(joven.Propiedad)?.[1] ?? 0, 0)} %</b> vive en una casa propia y casi la mitad ({nf(ultimo(joven['Alquiler a precio de mercado'])?.[1] ?? 0, 0)} %) paga alquiler de mercado; a partir de los 65 años, el {nf(ultimo(mayor.Propiedad)?.[1] ?? 0, 0)} % es propietario. Edad de la persona de referencia del hogar.</>}>
      <ColApiladas titulo="Tenencia por edad de la persona de referencia" xs={edades.map(g => g.replace('De ', '').replace(' años', '').replace('y más', '+'))} total={false} unidad="% de hogares" fy={v => `${nf(v, 0)} %`} tramos={CAT.map(c => ({ id: c.id, nombre: c.nombre, color: c.color, v: edades.map(g => ultimo(ed(g)?.[c.id])?.[1] ?? 0) }))} alto={220} />
    </Card>}
    <Card t="Por comunidades" lead={<>{cat === 'Propiedad' ? 'Hogares en propiedad' : 'Hogares en alquiler a precio de mercado'} en {ult}. {ccaa[0] && <>Más: <b>{ccaa[0].n}</b> ({nf(ccaa[0].v!, 1)} %); menos: {ccaa.at(-1)!.n} ({nf(ccaa.at(-1)!.v!, 1)} %). </>}El dato es de comunidad, no de provincia.</>}>
      <div className="modo" role="radiogroup" aria-label="Qué ver">{([['Propiedad', 'Propiedad'], ['Alquiler a precio de mercado', 'Alquiler']] as const).map(([m, t]) => <button key={m} role="radio" aria-checked={cat === m} className={cat === m ? 'is-on' : ''} onClick={() => setCat(m)}>{t}</button>)}</div>
      <MapaProvincias grupo={c => CCAA_DE_PROV[c] ?? null} claveGrupo="ccaa" valor={r => porCcaa.get(r) ?? null} fmt={v => `${nf(v, 1)} %`} titulo="Régimen de tenencia por comunidad" color={ACC} escala={ESCALA_CALOR} sel={sel} onSel={setSel} nota="Cuanto más alto, más oscuro y rojo." />
      <Barras titulo="Ranking de comunidades" fmt={v => `${nf(v, 1)} %`} limite={19} items={ccaa.map(c => ({ id: c.k, nombre: c.n, valor: c.v!, color: ACC, destacado: sel === c.n, onClick: () => setSel(c.n) }))} />
    </Card>
    {propTam.length > 0 && <Card t="Pueblo o ciudad" lead={<>Según el Censo 2021, el {nf(propTam[0].v, 0)} % de los hogares de los municipios más pequeños vive en casa propia, frente al {nf(propTam.at(-1)!.v, 0)} % en las ciudades de más de 500.000 habitantes. Primera residencia.</>} fuente={<a href="https://www.ine.es/jaxiT3/Tabla.htm?t=59523" target="_blank" rel="noopener noreferrer">INE, Censos 2021, tabla 59523</a>}>
      <Barras titulo="Hogares en propiedad según el tamaño del municipio" fmt={v => `${nf(v, 0)} %`} limite={12} items={propTam.map(r => ({ id: r.t, nombre: r.t.replace('Menos de 101 habitantes', 'Menos de 101').replace('Más de 500.000', 'Más de 500.000 hab.'), valor: r.v, color: ACC }))} />
    </Card>}
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
  const [extra, setExtra] = useState<Extra>({})
  useEffect(() => {
    fetch('./data/vivienda.json').then(r => r.json()).then(setD, () => setErr(true))
    fetch('./data/extra.json').then(r => r.json()).then(setExtra, () => {})
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
        {sec === 'vacias' && <Vacias x={extra} />}
        {sec === 'tenencia' && <Tenencia x={extra} />}
      </motion.div>
      {sec === 'resumen' && e?.gi && cv?.total && <Curiosidades titulo="¿Sabías que…?" items={[
        (() => { const a = e.gi!.at(-1)!, b = e.gi!.find(x => x[0].startsWith('2015')); return b && <>Desde 2015 la vivienda se ha encarecido un <b>{nf((a[1] / b[1] - 1) * 100, 0)} %</b>.</> })(),
        (() => { const año = new Map<string, number>(); for (const [p, v] of cv.total!) año.set(p.slice(0, 4), (año.get(p.slice(0, 4)) ?? 0) + v); const c = [...año].filter(([y]) => +y < new Date().getFullYear()); const m = c.reduce((x, y) => (y[1] > x[1] ? y : x)), n = c.reduce((x, y) => (y[1] < x[1] ? y : x)); return <>El año con más ventas fue <b>{m[0]}</b> ({nf(m[1])} viviendas) y el de menos, {n[0]} ({nf(n[1])}).</> })(),
        cv.nueva && <>De cada 10 casas que se venden, {nf((suma12(cv.nueva) / suma12(cv.total)) * 10, 0)} son nuevas: el resto, de segunda mano.</>,
      ]} />}
      <Fuentes ids={[]} extra={[{ n: 'INE · Índice de precios de vivienda', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.ipv}` }, { n: 'INE · Transmisiones de derechos de la propiedad', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.compraventas}` }, { n: 'INE · Hipotecas', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.hipotecas}` }, { n: 'INE · Índice de alquiler', u: `https://www.ine.es/jaxiT3/Tabla.htm?t=${d.tablas.alquiler}` }, { n: 'INE · Censos 2021: viviendas por intensidad de uso', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=59531' }, { n: 'INE · Encuesta de Condiciones de Vida: tenencia', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=9997' }]} />
      <p className="src">Datos del INE descargados cada semana. El precio es un índice, no euros por metro cuadrado: el valor por metro cuadrado del Ministerio de Vivienda llegará en una próxima versión.</p>
    </main>
  )
}
