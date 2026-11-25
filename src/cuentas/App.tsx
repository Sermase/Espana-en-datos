import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowLeftRight, Building2, Gauge, Globe2, Landmark, Receipt, Scale, Workflow } from 'lucide-react'
import { Apiladas, Barras, Columnas, CountUp, LineChart, Sankey, nf, type NodoSankey } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { parlamento } from '../holo3d/modelos'
import { Fuentes, eurostatUrl } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import { FUNCION, GASTO_TIPO, INGRESO, PAIS, SECTOR, SUBFUNCION } from './nombres'

const ACC = '#7fd4c8'
type Anual = Record<string, number>
type Datos = {
  fecha: string
  ing: Record<string, Anual>; imp: Record<string, Anual>
  eco: Record<string, Record<string, Anual>>
  fun: Record<string, Anual>; funSec: Record<string, Record<string, Anual>>
  deuda: Record<string, Anual>; pib: Anual; pob: Anual
  ueFun: Record<string, Record<string, Anual>>; ueTot: Record<string, Record<string, Anual>>; ueDeuda: Record<string, Anual>
}
const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'flujo', nombre: 'Entra y sale', icon: Workflow },
  { id: 'quien', nombre: 'Quién gasta', icon: Building2 },
  { id: 'tipo', nombre: 'En qué tipo de gasto', icon: Receipt },
  { id: 'impuestos', nombre: 'De dónde sale', icon: Landmark },
  { id: 'deuda', nombre: 'Déficit y deuda', icon: Scale },
  { id: 'europa', nombre: 'Compáralo con Europa', icon: Globe2 },
] as const
type Sec = (typeof SECCIONES)[number]['id']

const F10 = Object.keys(FUNCION)
const años = (o?: Anual) => Object.keys(o ?? {}).sort()
const ult = (o?: Anual) => años(o).at(-1) ?? ''
/** millones de euros → «725.655 M€» o «725,7 mil M€» */
const mm = (v: number) => (Math.abs(v) >= 1000 ? `${nf(v / 1000, 1)} mil M€` : `${nf(v)} M€`)
const eur = (v: number) => `${nf(v)} €`
const pct = (v: number, d = 1) => `${nf(v, d)} %`
const toT = (y: string) => Date.UTC(+y, 6, 1)
const anio = (t: number) => String(new Date(t).getUTCFullYear())
const serie = (o: Anual | undefined, f: (v: number, y: string) => number | null = v => v) => años(o).map(y => [toT(y), f(o![y], y)] as [number, number | null]).filter((p): p is [number, number] => p[1] != null && isFinite(p[1]))
const es = (code: string, txt = 'Eurostat') => <a href={eurostatUrl(code)} target="_blank" rel="noopener noreferrer">{txt}, {code}</a>

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
function Años({ lista, a, set }: { lista: string[]; a: string; set: (a: string) => void }) {
  return <label className="anio-sel">Año
    <select value={a} onChange={e => set(e.target.value)}>{[...lista].reverse().map(y => <option key={y}>{y}</option>)}</select>
  </label>
}

/** Ingresos por tipo de un año, con «otros» como lo que falta hasta el total. */
function ingresos(d: Datos, a: string) {
  const tr = d.ing.TR?.[a] ?? 0
  const base = ['D61REC', 'D5REC', 'D2REC', 'P11_P12_P131', 'D4REC'].map(k => ({ k, v: d.ing[k]?.[a] ?? 0 }))
  return [...base, { k: 'OTROS', v: tr - base.reduce((s, x) => s + x.v, 0) }].filter(x => x.v > 0)
}
function tipos(d: Datos, a: string, s = 'S13') {
  const e = d.eco[s] ?? {}, te = e.TE?.[a] ?? 0
  const base = [{ k: 'PRES', v: (e.D62PAY?.[a] ?? 0) + (e.D632PAY?.[a] ?? 0) }, ...['D1PAY', 'P2', 'D41PAY', 'P51G', 'D3PAY'].map(k => ({ k, v: e[k]?.[a] ?? 0 }))]
  return [...base, { k: 'OTROS', v: te - base.reduce((x, y) => x + y.v, 0) }].filter(x => x.v > 0)
}

/** Cada 100 € de gasto: cien casillas que se encienden por funciones. */
function Cien({ d, a }: { d: Datos; a: string }) {
  const [sel, setSel] = useState<string | null>(null)
  const tot = d.fun.TOTAL?.[a] ?? 0
  const partes = F10.map(k => ({ k, v: d.fun[k]?.[a] ?? 0 })).sort((x, y) => y.v - x.v)
  // reparto en 100 casillas por el método del mayor resto, para que sumen exactamente 100
  const ex = partes.map(p => (p.v / tot) * 100), ent = ex.map(Math.floor)
  let faltan = 100 - ent.reduce((s, x) => s + x, 0)
  ex.map((x, i) => [x - ent[i], i] as const).sort((p, q) => q[0] - p[0]).forEach(([, i]) => { if (faltan > 0) { ent[i]++; faltan-- } })
  const casillas = partes.flatMap((p, i) => Array.from({ length: ent[i] }, () => p.k))
  const pob = d.pob[a]
  return <div className="cien">
    <div className="cien-grid" role="img" aria-label={`Cada 100 euros de gasto público en ${a}`}>
      {casillas.map((k, i) => <motion.i key={i} style={{ background: FUNCION[k][2], opacity: sel && sel !== k ? 0.15 : 1 }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: sel && sel !== k ? 0.15 : 1 }} viewport={{ once: true }} transition={{ delay: i * 0.012, duration: 0.25 }} />)}
    </div>
    <ul className="cien-ley">
      {partes.map((p, i) => <li key={p.k}><button className={sel === p.k ? 'is-on' : ''} onPointerEnter={() => setSel(p.k)} onPointerLeave={() => setSel(null)} onClick={() => setSel(sel === p.k ? null : p.k)}>
        <i style={{ background: FUNCION[p.k][2] }} /><span>{FUNCION[p.k][0]}</span><b>{ent[i]} €</b>{pob && <small>{eur((p.v * 1e6) / pob)} por habitante</small>}
      </button></li>)}
    </ul>
  </div>
}

function Resumen({ d, go }: { d: Datos; go: (s: Sec) => void }) {
  const a = ult(d.eco.S13?.TE), te = d.eco.S13.TE[a], tr = d.eco.S13.TR?.[a] ?? 0, pib = d.pib[a], pob = d.pob[a] ?? d.pob[ult(d.pob)]
  const b9 = tr - te, aD = ult(d.deuda.S13), deuda = d.deuda.S13?.[aD], aF = ult(d.fun.TOTAL)
  const intereses = d.eco.S13.D41PAY?.[a]
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={parlamento(Math.min(1, te / pib / 0.6))} color={ACC} alto={250} etiqueta="Holograma: el dinero entra y sale de las administraciones" />
        <div className="sala-dato">
          <span className="sala-k">Gasto de todas las administraciones públicas, {a}</span>
          <b><CountUp value={te / 1000} fmt={v => `${nf(v, 0)} mil M€`} /></b>
          <span>es lo que gastaron juntos el Estado, las comunidades, los ayuntamientos y la Seguridad Social: el <b>{pct((te / pib) * 100)}</b> de todo lo que produce el país, unos <b>{eur((te * 1e6) / pob)}</b> por habitante. Ingresaron {mm(tr)}, así que {b9 < 0 ? <>faltaron <b>{mm(-b9)}</b> (un déficit del {pct((-b9 / pib) * 100)} del PIB), que se pagan con deuda.</> : <>sobraron <b>{mm(b9)}</b> (superávit).</>}</span>
        </div>
      </div>
    </section>
    <div className="kpis is-wide">
      <button className="kpi" onClick={() => go('flujo')}><span className="kpi-l">Gasto público</span><span className="kpi-v"><CountUp value={(te / pib) * 100} fmt={v => pct(v)} /></span><span className="kpi-p">del PIB en {a}</span></button>
      <button className="kpi" onClick={() => go('impuestos')}><span className="kpi-l">Ingresos públicos</span><span className="kpi-v"><CountUp value={(tr / pib) * 100} fmt={v => pct(v)} /></span><span className="kpi-p">del PIB · {mm(tr)}</span></button>
      <button className="kpi" onClick={() => go('deuda')}><span className="kpi-l">{b9 < 0 ? 'Déficit' : 'Superávit'}</span><span className="kpi-v"><CountUp value={Math.abs(b9 / pib) * 100} fmt={v => pct(v)} /></span><span className="kpi-p">del PIB en {a}</span></button>
      {deuda && <button className="kpi" onClick={() => go('deuda')}><span className="kpi-l">Deuda pública</span><span className="kpi-v"><CountUp value={(deuda / d.pib[aD]) * 100} fmt={v => pct(v, 0)} /></span><span className="kpi-p">del PIB · {mm(deuda)} en {aD}</span></button>}
      {intereses && <button className="kpi" onClick={() => go('tipo')}><span className="kpi-l">Intereses de la deuda</span><span className="kpi-v"><CountUp value={intereses / 1000} fmt={v => `${nf(v, 1)} mil M€`} /></span><span className="kpi-p">{eur((intereses * 1e6) / pob)} por habitante</span></button>}
    </div>
    {aF && <Card t={`Cada 100 € de gasto público, en ${aF}`} wide lead={<>Así se reparten. Toca una función para verla en el cuadro.</>} fuente={es('gov_10a_exp')}>
      <Cien d={d} a={aF} />
    </Card>}
    <Card t="Gasto e ingresos, desde 1995" wide lead={(() => { const s = años(d.eco.S13.TE).map(y => [y, (d.eco.S13.TE[y] / d.pib[y]) * 100] as const).filter(x => isFinite(x[1])); const m = s.reduce((x, y) => (y[1] > x[1] ? y : x)); return <>En % del PIB. El gasto llegó a su máximo en <b>{m[0]}</b> ({pct(m[1])}); cuando la línea de gasto va por encima de la de ingresos hay déficit.</> })()} fuente={es('gov_10a_main')}>
      <LineChart titulo="Gasto e ingresos públicos en % del PIB" series={[{ id: 'te', nombre: 'Gasto', datos: serie(d.eco.S13.TE, (v, y) => (v / d.pib[y]) * 100), color: '#ff8a95' }, { id: 'tr', nombre: 'Ingresos', datos: serie(d.eco.S13.TR, (v, y) => (v / d.pib[y]) * 100), color: ACC, area: true }]} fx={anio} fy={v => pct(v, 0)} />
    </Card>
  </div>
}

function Flujo({ d }: { d: Datos }) {
  const lista = años(d.eco.S13.TE)
  const [a, setA] = useState(ult(d.fun.TOTAL) || ult(d.eco.S13.TE))
  const [modo, setModo] = useState<'fun' | 'tipo'>(d.fun.TOTAL?.[a] ? 'fun' : 'tipo')
  const [sel, setSel] = useState<string | null>(null)
  const hayFun = !!d.fun.TOTAL?.[a]
  const m = hayFun ? modo : 'tipo'
  const te = d.eco.S13.TE[a], tr = d.eco.S13.TR?.[a] ?? 0
  const izq: NodoSankey[] = ingresos(d, a).map(x => ({ id: x.k, nombre: INGRESO[x.k][0], corto: INGRESO[x.k][1], valor: x.v, color: INGRESO[x.k][2] }))
  if (te > tr) izq.push({ id: 'DEF', nombre: 'Déficit: lo que se pide prestado', corto: 'Déficit (deuda)', valor: te - tr, color: '#ff8a95', rayado: true })
  const der: NodoSankey[] = m === 'fun'
    ? F10.map(k => ({ id: k, nombre: FUNCION[k][0], corto: FUNCION[k][1], valor: d.fun[k]?.[a] ?? 0, color: FUNCION[k][2] })).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor)
    : tipos(d, a).map(x => ({ id: x.k, nombre: GASTO_TIPO[x.k][0], corto: GASTO_TIPO[x.k][1], valor: x.v, color: GASTO_TIPO[x.k][2] }))
  if (tr > te) der.push({ id: 'SUP', nombre: 'Superávit', valor: tr - te, color: '#3df5b0', rayado: true })
  const top = [...der].sort((x, y) => y.valor - x.valor)[0]
  const sub = sel && SUBFUNCION[sel + '01'] ? Object.keys(SUBFUNCION).filter(k => k.startsWith(sel)).map(k => ({ id: k, nombre: SUBFUNCION[k], valor: d.fun[k]?.[a] ?? 0 })).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor) : null
  const impDet = sel === 'D2REC' ? [['D211', 'IVA'], ['D214', 'Impuestos especiales (gasolina, tabaco, alcohol, luz…)'], ['D29', 'Otros impuestos sobre la producción (IBI, IAE…)']] : sel === 'D61REC' ? [['D611', 'Las que pagan las empresas'], ['D613', 'Las que pagan trabajadores y autónomos']] : null
  return <div className="graficos">
    <Card t={`El dinero público en ${a}: de dónde sale y a dónde va`} wide lead={<>Entraron <b>{mm(tr)}</b> y salieron <b>{mm(te)}</b>{te > tr ? <>; la franja rayada es lo que se tuvo que pedir prestado</> : ''}. El mayor destino: <b>{top.nombre.toLowerCase()}</b>, {nf((top.valor / te) * 100, 0)} de cada 100 euros. Toca una franja para ver el detalle.</>}
      fuente={<>{es('gov_10a_main')} · {es('gov_10a_exp', 'por funciones')}{!hayFun && ' · el reparto por funciones de este año aún no está publicado'}</>}>
      <div className="filtros">
        <Años lista={lista} a={a} set={y => { setA(y); setSel(null) }} />
        <div className="modo" role="radiogroup" aria-label="Destino del gasto">
          <button role="radio" aria-checked={m === 'fun'} className={m === 'fun' ? 'is-on' : ''} disabled={!hayFun} onClick={() => { setModo('fun'); setSel(null) }}>Para qué</button>
          <button role="radio" aria-checked={m === 'tipo'} className={m === 'tipo' ? 'is-on' : ''} onClick={() => { setModo('tipo'); setSel(null) }}>En qué tipo de gasto</button>
        </div>
      </div>
      <Sankey izq={izq} der={der} centro="CAJA COMÚN" fmt={mm} titulo={`Ingresos y gastos públicos en ${a}`} sel={sel} onSel={setSel} alto={500} />
      {sub && sub.length > 0 && <div className="detalle"><h3>{FUNCION[sel!][0]}: en qué exactamente</h3><Barras suma titulo="Subfunciones" fmt={mm} limite={10} items={sub.map(x => ({ ...x, color: FUNCION[sel!][2] }))} /></div>}
      {impDet && <div className="detalle"><h3>{INGRESO[sel!][0]}: de qué impuestos</h3><Barras suma titulo="Detalle" fmt={mm} items={impDet.map(([k, n]) => ({ id: k, nombre: n, valor: d.imp[k]?.[a] ?? 0, color: INGRESO[sel!][2] })).filter(x => x.valor > 0)} /></div>}
    </Card>
  </div>
}

function Quien({ d }: { d: Datos }) {
  const a = ult(d.funSec.S1312?.TOTAL)
  const sect = Object.keys(SECTOR)
  const xs = años(d.eco.S1311?.TE).filter(y => sect.every(s => d.eco[s]?.TE?.[y]))
  return <div className="graficos">
    <Card t={`Quién hace qué, en ${a}`} wide lead={(() => { const c = d.funSec.S1312, sc = ((c.GF07?.[a] ?? 0) + (c.GF09?.[a] ?? 0)) / c.TOTAL[a]; const ss = d.funSec.S1314; return <>Las comunidades dedican <b>{nf(sc * 100, 0)} de cada 100 euros</b> a sanidad y educación; la Seguridad Social, {nf(((ss.GF10?.[a] ?? 0) / ss.TOTAL[a]) * 100, 0)} de cada 100 a pensiones y prestaciones. Cada barra es el gasto de una administración repartido por funciones.</> })()} fuente={es('gov_10a_exp')}>
      <div className="quien">
        {sect.map((s, i) => { const t = d.funSec[s]?.TOTAL?.[a] ?? 0; const fs = F10.map(k => ({ k, v: d.funSec[s]?.[k]?.[a] ?? 0 })).filter(x => x.v > 0).sort((x, y) => y.v - x.v); return <div key={s} className="quien-fila">
          <div className="quien-n"><b style={{ color: SECTOR[s][2] }}>{SECTOR[s][0]}</b><span>{mm(t)}</span></div>
          <div className="quien-b" role="img" aria-label={`${SECTOR[s][0]}: ${fs.slice(0, 3).map(x => `${FUNCION[x.k][1]} ${nf((x.v / t) * 100, 0)} %`).join(', ')}`}>
            {fs.map((x, j) => <motion.i key={x.k} title={`${FUNCION[x.k][0]}: ${mm(x.v)} (${nf((x.v / t) * 100, 0)} %)`} style={{ background: FUNCION[x.k][2] }} initial={{ width: 0 }} whileInView={{ width: `${(x.v / t) * 100}%` }} viewport={{ once: true }} transition={{ delay: i * 0.15 + j * 0.04, duration: 0.5 }}>{x.v / t > 0.12 && <span>{FUNCION[x.k][1]} {nf((x.v / t) * 100, 0)} %</span>}</motion.i>)}
          </div>
        </div> })}
      </div>
      <ul className="g-legend">{F10.map(k => <li key={k}><i style={{ background: FUNCION[k][2], height: 8 }} />{FUNCION[k][1]}</li>)}</ul>
      <p className="note">Cada administración cuenta también lo que transfiere a otras (por ejemplo, el Estado a las comunidades), así que la suma de las cuatro es mayor que el total.</p>
    </Card>
    <Card t="Gasto de cada administración, desde 1995" wide fuente={es('gov_10a_main')}>
      <Apiladas xs={xs.map(toT)} capas={sect.map(s => ({ id: s, nombre: SECTOR[s][1], color: SECTOR[s][2], v: xs.map(y => d.eco[s].TE[y]) }))} titulo="Gasto por administración" fx={anio} fy={v => mm(v)} alto={260} />
    </Card>
  </div>
}

function Tipo({ d }: { d: Datos }) {
  const xs = años(d.eco.S13.TE), a = xs.at(-1)!
  const ks = Object.keys(GASTO_TIPO), ts = xs.map(y => Object.fromEntries(tipos(d, y).map(x => [x.k, x.v])))
  const t = tipos(d, a), te = d.eco.S13.TE[a], pob = d.pob[a] ?? d.pob[ult(d.pob)]
  const i0 = xs.indexOf('2015'), int = d.eco.S13.D41PAY
  return <div className="graficos">
    <Card t="En qué tipo de gasto se va el dinero" wide lead={<>En {a}, de cada 100 euros: {t.slice(0, 3).map((x, i) => <span key={x.k}>{i ? (i === 2 ? ' y ' : ', ') : ''}<b>{nf((x.v / te) * 100, 0)}</b> en {GASTO_TIPO[x.k][1].toLowerCase()}</span>)}. Las subvenciones a empresas son {nf(((d.eco.S13.D3PAY?.[a] ?? 0) / te) * 100, 1)} de cada 100 euros: en <a href="../subvenciones/index.html">Subvenciones</a> ves quién las da y a quién.</>} fuente={es('gov_10a_main')}>
      <Apiladas xs={xs.map(toT)} capas={ks.map(k => ({ id: k, nombre: GASTO_TIPO[k][1], color: GASTO_TIPO[k][2], v: ts.map(o => o[k] ?? 0) }))} titulo="Gasto público por tipo" fx={anio} fy={v => mm(v)} alto={280} />
    </Card>
    <Card t={`Por habitante, en ${a}`}>
      <Barras unidad="Euros por habitante al año" titulo="Gasto por habitante y tipo" fmt={eur} items={t.map(x => ({ id: x.k, nombre: GASTO_TIPO[x.k][0], valor: (x.v * 1e6) / pob, color: GASTO_TIPO[x.k][2] })).sort((x, y) => y.valor - x.valor)} />
    </Card>
    {int && <Card t="Los intereses de la deuda" lead={(() => { const m = años(int).reduce((x, y) => (int[y] > int[x] ? y : x)); return <>Llegaron a su máximo en <b>{m}</b> ({mm(int[m])}). En {a}: {mm(int[a])}{i0 >= 0 ? <>, {int[a] > int['2015'] ? 'más' : 'menos'} que en 2015 ({mm(int['2015'])})</> : ''}.</> })()} fuente={es('gov_10a_main')}>
      <Columnas titulo="Intereses pagados cada año" fmt={mm} cadaX={5} items={años(int).map(y => ({ x: y, valor: int[y], color: '#d55181', destacado: y === a }))} />
    </Card>}
  </div>
}

function Impuestos({ d }: { d: Datos }) {
  const xs = años(d.ing.TR), a = xs.at(-1)!, pob = d.pob[a] ?? d.pob[ult(d.pob)]
  const ks = Object.keys(INGRESO), vs = xs.map(y => Object.fromEntries(ingresos(d, y).map(x => [x.k, x.v])))
  const det = [['D211', 'IVA'], ['D5', 'Impuestos sobre la renta y el patrimonio (IRPF, sociedades…)'], ['D611', 'Cotizaciones que pagan las empresas'], ['D613', 'Cotizaciones de trabajadores y autónomos'], ['D214', 'Impuestos especiales (carburantes, luz, tabaco, alcohol…)'], ['D29', 'Otros sobre la producción (IBI, IAE…)'], ['D91', 'Sobre el capital (sucesiones, donaciones)'], ['D59', 'Otros impuestos corrientes']].map(([k, n]) => ({ id: k, nombre: n, valor: d.imp[k]?.[a] ?? 0 })).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor)
  const tot = det.reduce((s, x) => s + x.valor, 0)
  return <div className="graficos">
    <Card t="De dónde sale el dinero público" wide lead={<>En {a} entraron <b>{mm(d.ing.TR[a])}</b>, unos {eur((d.ing.TR[a] * 1e6) / pob)} por habitante. Lo que más aporta: <b>{det[0]?.nombre}</b>, {nf((det[0]?.valor / tot) * 100, 0)} de cada 100 euros de impuestos y cotizaciones.</>} fuente={<>{es('gov_10a_main')} · {es('gov_10a_taxag', 'detalle de impuestos')}</>}>
      <Apiladas xs={xs.map(toT)} capas={ks.map(k => ({ id: k, nombre: INGRESO[k][1], color: INGRESO[k][2], v: vs.map(o => o[k] ?? 0) }))} titulo="Ingresos públicos por tipo" fx={anio} fy={v => mm(v)} alto={280} />
    </Card>
    <Card t={`Impuesto a impuesto, en ${a}`} wide>
      <Barras suma titulo="Recaudación por impuesto" fmt={v => `${mm(v)} · ${eur((v * 1e6) / pob)}/hab.`} items={det.map((x, i) => ({ ...x, color: ['#d95926', '#9085e9', '#3987e5', '#5fa8f0', '#f2b880', '#c6f25e', '#ffd166', '#8a9bb0'][i % 8] }))} />
      <p className="note">Recaudación de todas las administraciones, en contabilidad nacional (Eurostat). La recaudación mensual de la Agencia Tributaria irá en el tema Impuestos.</p>
    </Card>
  </div>
}

function Deuda({ d }: { d: Datos }) {
  const xs = años(d.eco.S13.B9)
  const def = xs.map(y => ({ x: y, valor: (d.eco.S13.B9[y] / d.pib[y]) * 100 }))
  const peor = def.reduce((x, y) => (y.valor < x.valor ? y : x)), aD = ult(d.deuda.S13)
  const deu = serie(d.deuda.S13, (v, y) => (d.pib[y] ? (v / d.pib[y]) * 100 : null))
  const max = deu.reduce((x, y) => (y[1] > x[1] ? y : x))
  const a = xs.at(-1)!
  return <div className="graficos">
    <Card t="Déficit o superávit, cada año" wide lead={<>En % del PIB. El peor año fue <b>{peor.x}</b> ({pct(peor.valor)}){peor.x === '2012' ? ', con las ayudas a la banca' : ''}. En {a}: {pct(def.at(-1)!.valor)}.{(() => { const sup = def.filter(x => x.valor > 0).map(x => x.x); return sup.length ? <> Hubo superávit en {sup.join(', ')}.</> : null })()}</>} fuente={es('gov_10a_main')}>
      <Columnas titulo="Saldo público en % del PIB" fmt={v => pct(v)} cadaX={5} items={def.map(x => ({ ...x, color: x.valor < 0 ? '#ff8a95' : '#3df5b0', destacado: x.x === a || x.x === peor.x }))} />
    </Card>
    <Card t="La deuda pública" lead={<>Está en el <b>{pct(deu.at(-1)![1], 0)}</b> del PIB ({mm(d.deuda.S13[aD])} en {aD}); el máximo fue {pct(max[1], 0)} en {anio(max[0])}.</>} fuente={es('gov_10dd_edpt1')}>
      <LineChart titulo="Deuda pública en % del PIB" series={[{ id: 'd', nombre: 'Deuda', datos: deu, color: ACC, area: true }]} fx={anio} fy={v => pct(v, 0)} />
    </Card>
    <Card t={`De quién es la deuda, en ${aD}`} lead={<>Lo que debe cada administración (sin descontar lo que se deben entre ellas).</>} fuente={es('gov_10dd_edpt1')}>
      <Barras suma titulo="Deuda por administración" fmt={v => `${mm(v)} · ${pct((v / d.pib[aD]) * 100, 0)} PIB`} items={Object.keys(SECTOR).map(s => ({ id: s, nombre: SECTOR[s][0], valor: d.deuda[s]?.[aD] ?? 0, color: SECTOR[s][2] })).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor)} />
      <p className="note">Saldo de cada administración en {a}: {Object.keys(SECTOR).map((s, i) => <span key={s}>{i ? ' · ' : ''}{SECTOR[s][1]} {pct(((d.eco[s]?.B9?.[a] ?? 0) / d.pib[a]) * 100)}</span>)}.</p>
    </Card>
  </div>
}

function Europa({ d }: { d: Datos }) {
  const paises = Object.keys(d.ueFun).filter(g => g !== 'ES').sort((x, y) => (x === 'EU27_2020' ? -1 : y === 'EU27_2020' ? 1 : (PAIS[x] ?? x).localeCompare(PAIS[y] ?? y)))
  const [otro, setOtro] = useState('EU27_2020')
  const a = ult(d.ueFun.ES?.TOTAL)
  const filas = F10.map(k => ({ k, es: d.ueFun.ES?.[k]?.[a] ?? 0, ot: d.ueFun[otro]?.[k]?.[a] ?? 0 })).sort((x, y) => y.es - x.es)
  const max = Math.max(...filas.flatMap(f => [f.es, f.ot]))
  const aT = ult(d.ueTot.ES?.TE)
  const rk = (k: string, aa: string) => Object.entries(d.ueTot).map(([g, o]) => ({ id: g, nombre: PAIS[g] ?? g, valor: o[k]?.[aa] ?? NaN, destacado: g === 'ES', color: g === 'ES' ? ACC : g === 'EU27_2020' ? '#9fc5ff' : '#5b7a86' })).filter(x => isFinite(x.valor)).sort((x, y) => y.valor - x.valor)
  const masQue = filas.filter(f => f.es > f.ot).map(f => FUNCION[f.k][1].toLowerCase())
  return <div className="graficos">
    <Card t="Compáralo con…" wide lead={<>Gasto por funciones en % del PIB, {a}. España gasta más que {PAIS[otro] === 'Media de la UE' ? 'la media de la UE' : PAIS[otro]} en {masQue.length ? masQue.join(', ') : 'ninguna función'}.</>} fuente={es('gov_10a_exp')}>
      <div className="paises" role="radiogroup" aria-label="País para comparar">{paises.map(g => <button key={g} role="radio" aria-checked={otro === g} className={otro === g ? 'is-on' : ''} onClick={() => setOtro(g)}>{PAIS[g] ?? g}</button>)}</div>
      <ul className="vs">
        <li className="vs-ley"><span /><span><i style={{ background: ACC }} />España</span><span><i style={{ background: '#9fc5ff' }} />{PAIS[otro] ?? otro}</span></li>
        {filas.map((f, i) => <li key={f.k}>
          <span className="vs-n">{FUNCION[f.k][1]}</span>
          <span className="vs-b"><motion.i style={{ background: ACC }} initial={{ width: 0 }} animate={{ width: `${(f.es / max) * 78}%` }} transition={{ delay: i * 0.04 }} /><b>{pct(f.es)}</b></span>
          <span className="vs-b"><motion.i key={otro} style={{ background: '#9fc5ff' }} initial={{ width: 0 }} animate={{ width: `${(f.ot / max) * 78}%` }} transition={{ delay: i * 0.04 }} /><b>{pct(f.ot)}</b></span>
        </li>)}
      </ul>
    </Card>
    <Card t={`Cuánto gasta cada país, ${aT}`} fuente={es('gov_10a_main')}>
      <Barras titulo="Gasto público en % del PIB" fmt={v => pct(v)} limite={16} items={rk('TE', aT)} />
    </Card>
    <Card t={`Cuánto ingresa cada país, ${aT}`} fuente={es('gov_10a_main')}>
      <Barras titulo="Ingresos públicos en % del PIB" fmt={v => pct(v)} limite={16} items={rk('TR', aT)} />
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<Datos | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/cuentas.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  const curios = useMemo(() => {
    if (!d) return []
    const a = ult(d.fun.TOTAL), pob = d.pob[a]
    const int = d.fun.GF0107?.[a], def = d.fun.GF02?.[a], edu = d.fun.GF09?.[a], pen = d.fun.GF1002?.[a], uni = d.fun.GF0904?.[a]
    return [
      int && def && <>En {a} los intereses de la deuda ({mm(int)}) fueron {int > def ? <><b>más</b> que todo el gasto en defensa ({mm(def)})</> : <>menos que el gasto en defensa ({mm(def)})</>}.</>,
      pen && edu && <>Solo en pensiones de jubilación se gastan {nf(pen / edu, 1)} veces lo que en toda la educación: {eur((pen * 1e6) / pob)} por habitante al año.</>,
      uni && <>La universidad pública cuesta {eur((uni * 1e6) / pob)} por habitante al año ({mm(uni)}).</>,
      (() => { const s = años(d.eco.S13.TE).filter(y => d.pib[y]); const v = s.map(y => [y, d.eco.S13.TE[y] / d.pib[y]] as const); const n = v.reduce((x, y) => (y[1] < x[1] ? y : x)); return <>El año con menos gasto público respecto al PIB fue {n[0]} ({pct(n[1] * 100)}).</> })(),
    ]
  }, [d])
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><ArrowLeftRight size={28} /><p>Cargando las cuentas públicas…</p></main>
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Cuentas públicas</h1>
          <p>Lo que ingresan y gastan todas las administraciones · Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <Resumen d={d} go={go} />}
        {sec === 'flujo' && <Flujo d={d} />}
        {sec === 'quien' && <Quien d={d} />}
        {sec === 'tipo' && <Tipo d={d} />}
        {sec === 'impuestos' && <Impuestos d={d} />}
        {sec === 'deuda' && <Deuda d={d} />}
        {sec === 'europa' && <Europa d={d} />}
      </motion.div>
      {sec === 'resumen' && <Curiosidades titulo="¿Sabías que…?" items={curios} />}
      <Fuentes ids={[]} extra={[{ n: 'Eurostat · Cuentas de las administraciones públicas', u: eurostatUrl('gov_10a_main') }, { n: 'Eurostat · Gasto por funciones (COFOG)', u: eurostatUrl('gov_10a_exp') }, { n: 'Eurostat · Impuestos', u: eurostatUrl('gov_10a_taxag') }, { n: 'Eurostat · Deuda pública', u: eurostatUrl('gov_10dd_edpt1') }, { n: 'IGAE · Contabilidad nacional del sector público', u: 'https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Paginas/Home.aspx' }]} />
      <p className="src">Datos anuales de Eurostat, en contabilidad nacional (SEC 2010), descargados cada semana. Los suministra a Eurostat la Intervención General del Estado (IGAE). El reparto por funciones se publica un año después que el total.</p>
    </main>
  )
}
