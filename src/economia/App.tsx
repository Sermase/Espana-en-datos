import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Banknote, ChartLine, Gauge, HandCoins, Home, Landmark, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import { Barras, Columnas, CountUp, LineChart, nf, compact, type Serie as LSerie } from '../graficos'
import { fechaDe, periodo, toT, useDatos, type Datos, type Serie } from './datos'

const ES = '#3df5b0', UE = '#9fb6bf'
const CAT = ['#3987e5', '#d95926', '#d55181', '#9085e9'] // huecos categóricos validados para fondo oscuro
type Rango = 5 | 10 | 25 | 0

const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'pib', nombre: 'Crecimiento', icon: TrendingUp },
  { id: 'precios', nombre: 'Precios', icon: ShoppingCart },
  { id: 'empleo', nombre: 'Empleo', icon: Users },
  { id: 'salarios', nombre: 'Salarios', icon: Banknote },
  { id: 'vivienda', nombre: 'Vivienda', icon: Home },
  { id: 'publico', nombre: 'Cuentas públicas', icon: Landmark },
  { id: 'hogares', nombre: 'Hogares', icon: HandCoins },
] as const
type Sec = (typeof SECCIONES)[number]['id']

const hay = (g: Record<string, unknown>) => Object.keys(g).length > 0
const pct = (v: number, d = 1) => `${nf(v, d)} %`
const signo = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)}`
const pp = (v: number) => `${signo(v)} puntos`

function useD(d: Datos) {
  const s = (tema: string, k: string): Serie | null => d.temas[tema]?.[k] ?? null
  const last = (x: Serie | null) => x?.d.at(-1) ?? null
  const ago = (x: Serie | null, n: number) => x?.d.at(-1 - n) ?? null
  const nombre = (dim: string, k: string) => d.nombres[dim]?.[k] ?? k
  /** Todas las series de una clave con varias geografías: { ES: Serie, DE: Serie… } */
  const grupo = (tema: string, k: string) => Object.fromEntries(Object.entries(d.temas[tema] ?? {}).filter(([kk]) => kk.startsWith(k + ':')).map(([kk, v]) => [kk.slice(k.length + 1), v]))
  return { s, last, ago, nombre, grupo }
}

/** Serie del pipeline → serie del gráfico, recortada al rango elegido. */
function ls(x: Serie | null, nombre: string, rango: Rango, extra: Partial<LSerie> = {}): LSerie | null {
  if (!x) return null
  const t0 = rango ? Date.now() - rango * 365.25 * 864e5 : -Infinity
  const datos = x.d.map(([p, v]) => [toT(p), v] as [number, number]).filter(p => p[0] >= t0)
  return datos.length > 1 ? { id: nombre, nombre, datos, ...extra } : null
}

function Card({ t, lead, children, wide, fuente, si = true }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: string; si?: boolean }) {
  if (!si) return null
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}

function Linea({ series, fy, frec, alto = 200, titulo, cero }: { series: (LSerie | null)[]; fy: (v: number) => string; frec: Serie['frec']; alto?: number; titulo: string; cero?: boolean }) {
  const ok = series.filter((x): x is LSerie => !!x)
  if (!ok.length) return <p className="note">Sin datos todavía para este gráfico.</p>
  const ys = ok.flatMap(s => s.datos.map(p => p[1])), ts = ok.flatMap(s => s.datos.map(p => p[0]))
  // Una marca por año (o cada 2, 5…), en el 1 de enero, para que no se repitan años en el eje
  const a0 = new Date(Math.min(...ts)).getUTCFullYear() + 1, a1 = new Date(Math.max(...ts)).getUTCFullYear()
  const max = typeof innerWidth === 'number' && innerWidth < 640 ? 4 : 9
  const paso = [1, 2, 5, 10].find(p => (a1 - a0) / p <= max) ?? 10
  const ticksX: number[] = []; for (let a = Math.ceil(a0 / paso) * paso; a <= a1; a += paso) ticksX.push(Date.UTC(a, 0, 1))
  return <LineChart titulo={titulo} series={ok} fx={t => fechaDe(t, frec)} fxEje={t => String(new Date(t).getUTCFullYear())} ticksX={ticksX} fy={fy} alto={alto} yMin={cero ? Math.min(0, ...ys) : undefined} />
}

/** Último valor de cada país o comunidad, con España resaltada. */
function Ranking({ g, nombre, fmt, titulo, orden = 'desc', limite = 12 }: { g: Record<string, Serie>; nombre: (k: string) => string; fmt: (v: number) => string; titulo: string; orden?: 'asc' | 'desc'; limite?: number }) {
  const items = Object.entries(g).map(([k, s]) => ({ k, p: s.d.at(-1)! })).filter(x => x.p)
  if (!items.length) return null
  const año = items.map(x => x.p[0]).sort().at(-1)!
  const rows = items.filter(x => x.p[0] === año || items.length < 6).sort((a, b) => (orden === 'desc' ? b.p[1] - a.p[1] : a.p[1] - b.p[1]))
  return <>
    <Barras titulo={titulo} fmt={fmt} limite={limite} items={rows.map(x => ({ id: x.k, nombre: nombre(x.k), valor: x.p[1], destacado: x.k === 'ES', color: x.k === 'ES' ? ES : x.k === 'EU27_2020' ? UE : '#3987e5' }))} />
    <p className="note">Dato de {periodo(año)}.</p>
  </>
}

/** Tarjeta del resumen: valor actual, cambio y la evolución reciente en pequeño. */
function Kpi({ label, s, fmt, cambio, onClick, invert, neutro, ud = ' p.p.' }: { label: string; s: Serie | null; fmt: (v: number) => string; cambio?: 'anterior' | 'año'; onClick: () => void; invert?: boolean; neutro?: boolean; ud?: string }) {
  if (!s || s.d.length < 2) return null
  const [p, v] = s.d.at(-1)!
  const back = cambio === 'año' ? ({ M: 12, T: 4, S: 2, A: 1 } as const)[s.frec] : 1
  const prev = s.d.at(-1 - back)?.[1]
  const delta = prev == null ? null : v - prev
  const pts = s.d.slice(-36).map(x => x[1]), lo = Math.min(...pts), hi = Math.max(...pts)
  const path = pts.map((y, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100} ${28 - ((y - lo) / (hi - lo || 1)) * 26}`).join('')
  const good = delta == null || neutro ? null : invert ? delta < 0 : delta > 0
  return (
    <button className="kpi" onClick={onClick}>
      <span className="kpi-l">{label}</span>
      <span className="kpi-v"><CountUp value={v} fmt={fmt} /></span>
      {delta != null && <span className={`kpi-d ${Math.abs(delta) < 1e-9 || good == null ? '' : good ? 'is-good' : 'is-bad'}`}>{signo(delta, Math.abs(delta) >= 10 ? 0 : Math.abs(delta) < 1 ? 2 : 1)}{ud} {cambio === 'año' ? 'en un año' : 'sobre el dato anterior'}</span>}
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden><motion.path d={path} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} /></svg>
      <span className="kpi-p">{periodo(p)}</span>
    </button>
  )
}

function Seccion({ id, d, rango, go }: { id: Sec; d: Datos; rango: Rango; go: (s: Sec) => void }) {
  const { s, last, grupo, nombre } = useD(d)
  const geo = (k: string) => nombre('geo', k)
  const cmp = (tema: string, k: string, label: string, extra = false) => [
    ls(s(tema, `${k}:ES`), `España${extra ? ` · ${label}` : ''}`, rango, { color: ES, area: true }),
    ls(s(tema, `${k}:EU27_2020`), 'UE', rango, { color: UE, fondo: true }),
  ]
  const vsUE = (tema: string, k: string) => { const a = last(s(tema, `${k}:ES`)), b = last(s(tema, `${k}:EU27_2020`)); return a && b ? a[1] - b[1] : null }

  if (id === 'resumen') return (
    <div className="kpis">
      <Kpi label="Crecimiento del PIB" s={s('pib', 'pib_anual:ES')} fmt={v => pct(v)} onClick={() => go('pib')} />
      <Kpi label="Inflación" s={s('precios', 'ipc:ES')} fmt={v => pct(v)} onClick={() => go('precios')} invert />
      <Kpi label="Inflación subyacente" s={s('precios', 'ipc_sub')} fmt={v => pct(v)} onClick={() => go('precios')} invert />
      <Kpi label="Paro" s={s('empleo', 'paro:ES')} fmt={v => pct(v)} cambio="año" onClick={() => go('empleo')} invert />
      <Kpi label="Paro juvenil" s={s('empleo', 'paro_joven:ES')} fmt={v => pct(v)} cambio="año" onClick={() => go('empleo')} invert />
      <Kpi label="Euríbor a 12 meses" s={s('vivienda', 'euribor')} fmt={v => pct(v, 2)} onClick={() => go('vivienda')} invert />
      <Kpi label="Precio de la vivienda" s={s('vivienda', 'vivienda_var:ES')} fmt={v => pct(v)} onClick={() => go('vivienda')} neutro />
      <Kpi label="Salario mínimo" s={s('salarios', 'smi:ES')} fmt={v => `${nf(v)} €`} cambio="año" onClick={() => go('salarios')} ud=" €" />
      <Kpi label="Deuda pública" s={s('publico', 'deuda:ES')} fmt={v => `${nf(v, 1)} % PIB`} onClick={() => go('publico')} invert />
      <Kpi label="Déficit público" s={s('publico', 'deficit:ES')} fmt={v => `${nf(v, 1)} % PIB`} onClick={() => go('publico')} />
      <Kpi label="Riesgo de pobreza" s={s('hogares', 'riesgo_pobreza:ES')} fmt={v => pct(v)} onClick={() => go('hogares')} invert />
      <Kpi label="PIB por habitante (UE = 100)" s={s('pib', 'pib_pc_ppa:ES')} fmt={v => nf(v)} onClick={() => go('pib')} ud="" neutro />
    </div>
  )

  if (id === 'pib') {
    const a = last(s('pib', 'pib_anual:ES')), t = s('pib', 'pib_trim:ES'), dif = vsUE('pib', 'pib_anual')
    const niv = s('pib', 'pib_nivel'), ppa = last(s('pib', 'pib_pc_ppa:ES'))
    return <div className="graficos">
      {a && <Card t="¿Cuánto crece la economía?" wide lead={<>El PIB de España crece un <b>{pct(a[1])}</b> respecto al mismo trimestre del año anterior ({periodo(a[0])}){dif != null && <>, {Math.abs(dif) < 0.05 ? 'igual que la UE' : <>{pp(dif)} {dif > 0 ? 'más' : 'menos'} que la UE</>}</>}.</>} fuente="Eurostat · cuentas nacionales trimestrales, volumen encadenado, corregido de estacionalidad">
        <Linea titulo="Crecimiento anual del PIB" series={cmp('pib', 'pib_anual', 'PIB')} fy={v => pct(v)} frec="T" cero />
      </Card>}
      {t && <Card t="Trimestre a trimestre" lead="Cuánto crece cada trimestre sobre el anterior. Las barras rojas son trimestres en que la economía se encogió.">
        <Columnas titulo="Crecimiento trimestral del PIB" items={t.d.filter(x => !rango || toT(x[0]) > Date.now() - rango * 365.25 * 864e5).map(([p, v]) => ({ x: p.replace('-Q', 'T'), valor: v, color: v < 0 ? '#ff4d5e' : ES }))} fmt={v => pct(v)} cadaX={8} />
      </Card>}
      {niv && <Card t="El tamaño de la economía" lead={<>España produce <b>{nf(niv.d.at(-1)![1] / 1e6, 2)} billones de euros</b> al año ({niv.d.at(-1)![0]}), a precios de cada año.</>}>
        <Columnas titulo="PIB a precios corrientes" items={niv.d.map(([p, v]) => ({ x: p, valor: v / 1e3 }))} fmt={v => `${nf(v)} mil M€`} cadaX={5} />
      </Card>}
      {ppa && <Card si={hay(grupo('pib', 'pib_pc_ppa'))} t="Riqueza por habitante en Europa" lead={<>Corrigiendo por lo que cuestan las cosas en cada país, el PIB por habitante de España es <b>{nf(ppa[1])}</b> sobre una media europea de 100.</>}>
        <Ranking g={grupo('pib', 'pib_pc_ppa')} nombre={geo} fmt={v => nf(v)} titulo="PIB por habitante en poder de compra" />
      </Card>}
      <Card t="Por comunidades" lead="PIB por habitante en euros, último año publicado.">
        <Ranking g={Object.fromEntries(Object.entries(grupo('pib', 'pib_pc_ccaa')).filter(([k]) => k !== 'ES'))} nombre={geo} fmt={v => `${nf(v)} €`} titulo="PIB por habitante por comunidad" limite={19} />
      </Card>
    </div>
  }

  if (id === 'precios') {
    const ipc = last(s('precios', 'ipc:ES')), sub = last(s('precios', 'ipc_sub')), dif = vsUE('precios', 'ipc')
    const g = grupo('precios', 'ipc_grupos')
    const gl = Object.entries(g).map(([k, x]) => ({ k, v: x.d.at(-1)! })).sort((a, b) => b.v[1] - a.v[1])
    return <div className="graficos">
      {ipc && <Card t="Inflación" wide lead={<>Los precios suben un <b>{pct(ipc[1])}</b> en un año ({periodo(ipc[0])}){dif != null && <>, {pp(dif)} frente a la UE</>}{sub && <>. Sin energía ni alimentos frescos, la subyacente está en {pct(sub[1])}</>}.</>} fuente="Eurostat · índice de precios armonizado (IPCA), tasa anual">
        <Linea titulo="Inflación anual" series={[...cmp('precios', 'ipc', 'IPCA'), ls(s('precios', 'ipc_sub'), 'Subyacente', rango, { color: CAT[0] })]} fy={v => pct(v)} frec="M" cero />
      </Card>}
      {gl.length > 0 && <Card t="Qué sube más" lead={<>En {periodo(gl[0].v[0])}, lo que más se encarece es <b>{(nombre('coicop', gl[0].k)).toLowerCase()}</b> ({pct(gl[0].v[1])}) y lo que menos, {nombre('coicop', gl.at(-1)!.k).toLowerCase()} ({pct(gl.at(-1)!.v[1])}).</>}>
        <Barras titulo="Inflación por grupos" fmt={v => pct(v)} limite={12} items={gl.map(x => ({ id: x.k, nombre: nombre('coicop', x.k), valor: x.v[1], color: x.v[1] < 0 ? '#3987e5' : '#d95926' }))} />
      </Card>}
      {g.CP01 && <Card t="La cesta de la compra y la energía" lead="Alimentos y energía son lo que más se nota en el bolsillo y lo que más se mueve.">
        <Linea titulo="Inflación de alimentos, energía y servicios" series={[ls(g.CP01, 'Alimentos', rango, { color: CAT[1] }), ls(g.NRG, 'Energía', rango, { color: CAT[0] }), ls(g.SERV, 'Servicios', rango, { color: CAT[3] })]} fy={v => pct(v)} frec="M" cero />
      </Card>}
      <Card si={hay(grupo('precios', 'ipc_paises'))} t="Inflación en Europa" lead="Último mes publicado, de más a menos.">
        <Ranking g={grupo('precios', 'ipc_paises')} nombre={geo} fmt={v => pct(v)} titulo="Inflación por países" />
      </Card>
    </div>
  }

  if (id === 'empleo') {
    const p = last(s('empleo', 'paro:ES')), j = last(s('empleo', 'paro_joven:ES')), dif = vsUE('empleo', 'paro')
    const pmin = s('empleo', 'paro:ES')?.d.reduce((m, x) => (x[1] < m[1] ? x : m))
    const ccaa = grupo('empleo', 'paro_ccaa'), tmp = last(s('empleo', 'temporal:ES'))
    return <div className="graficos">
      {p && <Card t="Paro" wide lead={<>La tasa de paro está en el <b>{pct(p[1])}</b> ({periodo(p[0])}), {pp(dif ?? 0)} sobre la media europea.{pmin && pmin[0] !== p[0] && <> El mínimo de la serie fue {pct(pmin[1])} en {periodo(pmin[0])}.</>}</>} fuente="Eurostat · tasa de paro mensual, corregida de estacionalidad">
        <Linea titulo="Tasa de paro" series={cmp('empleo', 'paro', 'paro')} fy={v => pct(v)} frec="M" />
      </Card>}
      {j && <Card t="Paro juvenil" lead={<>Uno de cada {nf(100 / j[1], 0)} menores de 25 que buscan trabajo no lo encuentra: <b>{pct(j[1])}</b>.</>}>
        <Linea titulo="Paro de menores de 25 años" series={cmp('empleo', 'paro_joven', 'juvenil')} fy={v => pct(v)} frec="M" />
      </Card>}
      <Card t="Hombres y mujeres" lead="La brecha se ha ido cerrando, pero el paro sigue siendo más alto entre las mujeres.">
        <Linea titulo="Tasa de paro por sexo" series={[ls(s('empleo', 'paro_sexo:M'), 'Hombres', rango, { color: CAT[0] }), ls(s('empleo', 'paro_sexo:F'), 'Mujeres', rango, { color: CAT[1] })]} fy={v => pct(v)} frec="M" />
      </Card>
      <Card t="Por comunidades" lead="Tasa de paro anual de cada comunidad.">
        <Ranking g={ccaa} nombre={geo} fmt={v => pct(v)} titulo="Paro por comunidad" limite={19} />
      </Card>
      {tmp && <Card t="Contratos temporales" lead={<>El <b>{pct(tmp[1])}</b> de los asalariados tiene contrato temporal ({tmp[0]}).</>}>
        <Linea titulo="Asalariados con contrato temporal" series={cmp('empleo', 'temporal', 'temporal')} fy={v => pct(v)} frec="A" />
      </Card>}
      <Card si={hay(grupo('empleo', 'paro_paises'))} t="Paro en Europa" lead="Último mes publicado.">
        <Ranking g={grupo('empleo', 'paro_paises')} nombre={geo} fmt={v => pct(v)} titulo="Paro por países" />
      </Card>
    </div>
  }

  if (id === 'salarios') {
    const smi = s('salarios', 'smi:ES'), sm = last(smi), sm0 = smi?.d.find(x => x[0].startsWith('2018'))
    return <div className="graficos">
      {sm && <Card t="Salario mínimo" wide lead={<>El salario mínimo es de <b>{nf(sm[1])} € al mes</b> en 12 pagas ({periodo(sm[0])}){sm0 && <>, un {pct(((sm[1] - sm0[1]) / sm0[1]) * 100, 0)} más que en 2018</>}.</>} fuente="Eurostat · salario mínimo mensual, prorrateado a 12 pagas">
        <Linea titulo="Salario mínimo mensual" series={[ls(smi, 'España', rango, { color: ES, area: true }), ls(s('salarios', 'smi:PT'), 'Portugal', rango, { color: CAT[0], fondo: true }), ls(s('salarios', 'smi:FR'), 'Francia', rango, { color: CAT[1], fondo: true }), ls(s('salarios', 'smi:DE'), 'Alemania', rango, { color: CAT[3], fondo: true })]} fy={v => `${nf(v)} €`} frec="S" />
      </Card>}
      <Card si={hay(grupo('salarios', 'smi'))} t="El salario mínimo en Europa">
        <Ranking g={grupo('salarios', 'smi')} nombre={geo} fmt={v => `${nf(v)} €`} titulo="Salario mínimo por países" />
      </Card>
      <Card t="Lo que cuesta una hora de trabajo" lead="Variación anual del coste laboral por hora: sueldos más cotizaciones.">
        <Linea titulo="Coste laboral por hora" series={cmp('salarios', 'coste_laboral', 'coste')} fy={v => pct(v)} frec="T" cero />
      </Card>
      <Card si={hay(grupo('salarios', 'salario_medio'))} t="Salario medio a tiempo completo" lead="Sueldo bruto medio anual por empleado equivalente a tiempo completo.">
        <Ranking g={grupo('salarios', 'salario_medio')} nombre={geo} fmt={v => `${nf(v)} €`} titulo="Salario medio por países" />
      </Card>
    </div>
  }

  if (id === 'vivienda') {
    const v = last(s('vivienda', 'vivienda_var:ES')), eu = s('vivienda', 'euribor'), e = last(eu)
    const emax = eu?.d.filter(x => x[0] >= '2010').reduce((m, x) => (x[1] > m[1] ? x : m))
    return <div className="graficos">
      {v && <Card t="Precio de la vivienda" wide lead={<>La vivienda se ha encarecido un <b>{pct(v[1])}</b> en un año ({periodo(v[0])}).</>} fuente="Eurostat · índice de precios de vivienda (con datos del INE)">
        <Linea titulo="Precio de la vivienda, variación anual" series={cmp('vivienda', 'vivienda_var', 'vivienda')} fy={x => pct(x)} frec="T" cero />
      </Card>}
      <Card t="Nueva y usada" lead="Índice de precios: 2015 = 100.">
        <Linea titulo="Índice de precios de vivienda nueva y usada" series={[ls(s('vivienda', 'vivienda_ind:DW_NEW'), 'Nueva', rango, { color: CAT[0] }), ls(s('vivienda', 'vivienda_ind:DW_EXST'), 'Usada', rango, { color: CAT[1] })]} fy={x => nf(x)} frec="T" />
      </Card>
      {e && <Card t="Euríbor" lead={<>El euríbor a 12 meses, que marca la cuota de la mayoría de hipotecas variables, está en <b>{pct(e[1], 2)}</b>{emax && <>; su pico desde 2010 fue {pct(emax[1], 2)} en {periodo(emax[0])}</>}.</>}>
        <Linea titulo="Euríbor a 12 meses" series={[ls(eu, 'Euríbor 12 meses', rango, { color: ES, area: true })]} fy={x => pct(x, 1)} frec="M" cero />
      </Card>}
      <Card si={hay(grupo('vivienda', 'propiedad'))} t="Vivir en propiedad" lead="Hogares que viven en una vivienda suya, con o sin hipoteca.">
        <Ranking g={grupo('vivienda', 'propiedad')} nombre={geo} fmt={x => pct(x)} titulo="Hogares en vivienda en propiedad" />
      </Card>
    </div>
  }

  if (id === 'publico') {
    const deu = last(s('publico', 'deuda:ES')), def = s('publico', 'deficit:ES'), gasto = grupo('publico', 'gasto')
    const gl = Object.entries(gasto).map(([k, x]) => ({ k, v: x.d.at(-1)! })).sort((a, b) => b.v[1] - a.v[1])
    const tot = gl.reduce((t, x) => t + x.v[1], 0)
    return <div className="graficos">
      {deu && <Card t="Deuda pública" wide lead={<>Las administraciones deben el <b>{nf(deu[1], 1)} % del PIB</b> ({deu[0]}), {pp(vsUE('publico', 'deuda') ?? 0)} sobre la media europea.</>} fuente="Eurostat · deuda según el protocolo de déficit excesivo">
        <Linea titulo="Deuda pública" series={cmp('publico', 'deuda', 'deuda')} fy={x => `${nf(x)} %`} frec="A" />
      </Card>}
      {def && <Card t="Déficit" lead={<>Cada año se gasta más de lo que se ingresa: en {def.d.at(-1)![0]} la diferencia fue del {nf(Math.abs(def.d.at(-1)![1]), 1)} % del PIB. Por encima de cero, superávit.</>}>
        <Columnas titulo="Déficit o superávit público" items={def.d.filter(x => !rango || Number(x[0]) > new Date().getFullYear() - rango).map(([p, x]) => ({ x: p, valor: x, color: x < 0 ? '#ff4d5e' : ES }))} fmt={x => `${nf(x, 1)} %`} cadaX={4} />
      </Card>}
      {gl.length > 0 && <Card t="¿En qué se gasta?" lead={<>El gasto público es el <b>{nf(tot, 1)} % del PIB</b>; casi {nf((gl[0].v[1] / tot) * 100, 0)} de cada 100 euros van a {nombre('cofog99', gl[0].k).toLowerCase()}.</>}>
        <Barras titulo="Gasto público por funciones" fmt={x => `${nf(x, 1)} % PIB`} limite={10} items={gl.map(x => ({ id: x.k, nombre: nombre('cofog99', x.k), valor: x.v[1], color: ES }))} />
      </Card>}
      <Card si={hay(grupo('publico', 'deuda'))} t="Deuda en Europa">
        <Ranking g={grupo('publico', 'deuda')} nombre={geo} fmt={x => `${nf(x)} %`} titulo="Deuda pública por países" />
      </Card>
    </div>
  }

  // hogares
  const rp = last(s('hogares', 'riesgo_pobreza:ES'))
  return <div className="graficos">
    {rp && <Card t="Riesgo de pobreza o exclusión" wide lead={<>El <b>{pct(rp[1])}</b> de la población está en riesgo de pobreza o exclusión social ({rp[0]}), {pp(vsUE('hogares', 'riesgo_pobreza') ?? 0)} frente a la UE.</>} fuente="Eurostat · encuesta de condiciones de vida (indicador AROPE)">
      <Linea titulo="Población en riesgo de pobreza o exclusión" series={cmp('hogares', 'riesgo_pobreza', 'riesgo')} fy={x => pct(x)} frec="A" />
    </Card>}
    <Card si={hay(grupo('hogares', 'gini'))} t="Desigualdad" lead="Índice de Gini: 0 sería que todos ingresan lo mismo y 100 que una persona se lo lleva todo.">
      <Ranking g={grupo('hogares', 'gini')} nombre={geo} fmt={x => nf(x, 1)} titulo="Índice de Gini por países" />
    </Card>
    <Card si={hay(grupo('hogares', 'renta_mediana'))} t="Renta mediana" lead="La renta anual de la persona que está justo en el medio, ni rica ni pobre.">
      <Ranking g={grupo('hogares', 'renta_mediana')} nombre={geo} fmt={x => `${nf(x)} €`} titulo="Renta mediana por países" />
    </Card>
  </div>
}

export default function App() {
  const { d, err } = useDatos()
  const init = (location.hash.slice(1) as Sec) || 'resumen'
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const [rango, setRango] = useState<Rango>(10)
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  useEffect(() => { const f = () => { const h = location.hash.slice(1) as Sec; if (SECCIONES.some(x => x.id === h)) setSec(h) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const total = useMemo(() => d ? Object.values(d.temas).reduce((t, x) => t + Object.keys(x).length, 0) : 0, [d])

  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><ChartLine size={28} /><p>Cargando la economía…</p></main>
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Economía</h1>
          <p>{compact(total)} series oficiales · actualizado el {new Date(d.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
        </div>
        {sec !== 'resumen' && <div className="rango" role="radiogroup" aria-label="Periodo de los gráficos">
          {([5, 10, 25, 0] as Rango[]).map(r => <button key={r} role="radio" aria-checked={rango === r} className={rango === r ? 'is-on' : ''} onClick={() => setRango(r)}>{r ? `${r} años` : 'Todo'}</button>)}
        </div>}
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <p className="intro">Los grandes números de la economía española, del último dato publicado. Toca uno para ver su evolución y cómo queda España frente a Europa.</p>}
        <Seccion id={sec} d={d} rango={rango} go={go} />
      </motion.div>
      <p className="src">Fuente: Eurostat (con datos del INE, el Banco de España y el resto de institutos europeos). Se actualiza cada día; cada serie llega cuando su organismo la publica.</p>
    </main>
  )
}
