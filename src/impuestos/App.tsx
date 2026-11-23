import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CalendarDays, Coins, Fuel, Gauge, Layers, Map as MapIcon, Receipt, Split } from 'lucide-react'
import { Apiladas, Barras, Columnas, CountUp, nf } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { embudo } from '../holo3d/modelos'
import { MapaProvincias, colorEscala } from '../geo/MapaProvincias'
import { PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'

const ACC = '#f2b880'
type Ser = [string, number | null][]
type Datos = { fecha: string; ultimo: string; series: Record<string, Ser>; deleg: { desde: string; hasta: string; prov: Record<string, Record<string, number>>; centrales: Record<string, number> } | null }
const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'calendario', nombre: 'Calendario fiscal', icon: CalendarDays },
  { id: 'impuestos', nombre: 'Impuesto a impuesto', icon: Layers },
  { id: 'irpf', nombre: 'IRPF y sociedades', icon: Receipt },
  { id: 'consumo', nombre: 'IVA y especiales', icon: Fuel },
  { id: 'reparto', nombre: 'A quién va', icon: Split },
  { id: 'mapa', nombre: 'Por provincias', icon: MapIcon },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/** Los grandes bloques, con su color (orden fijo). */
const GRANDES: { k: string; n: string; c: string }[] = [
  { k: 'irpf', n: 'IRPF', c: '#3987e5' }, { k: 'iva', n: 'IVA', c: '#d95926' }, { k: 'soc', n: 'Sociedades', c: '#9085e9' },
  { k: 'iiee', n: 'Impuestos especiales', c: '#ffd166' }, { k: 'irnr', n: 'No residentes', c: '#5fd3e8' }, { k: 'resto', n: 'Resto', c: '#8a9bb0' },
]
const ESPECIALES: [string, string][] = [['hidro', 'Carburantes (hidrocarburos)'], ['tabaco', 'Tabaco'], ['electricidad', 'Electricidad'], ['alcohol', 'Alcohol y bebidas derivadas'], ['plasticos', 'Envases de plástico'], ['cerveza', 'Cerveza'], ['vapeo', 'Líquidos de vapeo'], ['intermedios', 'Productos intermedios (vermú, jerez…)']]
const OTROS: [string, string][] = [['trafico', 'Aranceles (tráfico exterior)'], ['seguros', 'Primas de seguros'], ['medioambiente', 'Medioambientales'], ['banca', 'Margen de la banca'], ['tasas', 'Tasas'], ['transacciones', 'Transacciones financieras'], ['digitales', 'Servicios digitales'], ['juego', 'Juego']]
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const per = (k: string) => `${MES[+k.slice(5) - 1]} ${k.slice(0, 4)}`
const mm = (v: number) => (Math.abs(v) >= 1000 ? `${nf(v / 1000, 1)} mil M€` : `${nf(v, v < 10 ? 1 : 0)} M€`)
const toT = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5) - 1, 15)
const anio = (t: number) => String(new Date(t).getUTCFullYear())
const FORALES = new Set(['01', '20', '48', '31'])

/** Suma de los últimos 12 meses (desplazada `fin` meses hacia atrás). */
const s12 = (s: Ser | undefined, fin = 0) => (s ?? []).slice(-(12 + fin), fin ? -fin : undefined).reduce((t, x) => t + (x[1] ?? 0), 0)
/** Serie de sumas móviles de 12 meses. */
const movil = (s: Ser) => s.map((_, i) => (i < 11 ? null : s.slice(i - 11, i + 1).reduce((t, x) => t + (x[1] ?? 0), 0)))

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const AEAT = <a href="https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Informe_mensual_de_Recaudacion_Tributaria.shtml" target="_blank" rel="noopener noreferrer">Agencia Tributaria, informe mensual de recaudación</a>

/** El ticket de España: los impuestos de 12 meses impresos línea a línea, como en la caja del súper. */
function Ticket({ d, pob }: { d: Datos; pob: number | null }) {
  const lineas = GRANDES.map(g => ({ ...g, v: s12(d.series[g.k]) })).filter(x => x.v > 0)
  const tot = s12(d.series.total), desde = d.series.total.at(-12)![0]
  return <div className="ticket" role="img" aria-label={`Ticket de impuestos de ${per(desde)} a ${per(d.ultimo)}: ${lineas.map(l => `${l.n} ${mm(l.v)}`).join(', ')}; total ${mm(tot)}`}>
    <motion.div className="tk-papel" initial={{ clipPath: 'inset(0 0 100% 0)' }} whileInView={{ clipPath: 'inset(0 0 0% 0)' }} viewport={{ once: true }} transition={{ duration: 1.8, ease: 'linear' }}>
      <p className="tk-cab">HACIENDA · ESPAÑA<br /><small>{per(desde)} – {per(d.ultimo)}</small></p>
      <p className="tk-raya" />
      {lineas.map(l => <p key={l.k} className="tk-l"><span><i style={{ background: l.c }} />{l.n}</span><b>{nf(l.v, 0)}</b></p>)}
      <p className="tk-raya" />
      <p className="tk-l tk-tot"><span>TOTAL M€</span><b>{nf(tot, 0)}</b></p>
      {pob && <p className="tk-l"><span>Por habitante</span><b>{nf((tot * 1e6) / pob, 0)} €</b></p>}
      <p className="tk-raya" />
      <p className="tk-pie">Ingresos netos de caja · no incluye<br />cotizaciones sociales ni haciendas forales</p>
      <p className="tk-barras" aria-hidden>{Array.from({ length: 38 }, (_, i) => <i key={i} style={{ width: 1 + ((i * 7) % 4) }} />)}</p>
    </motion.div>
  </div>
}

function Resumen({ d, pob, go }: { d: Datos; pob: number | null; go: (s: Sec) => void }) {
  const tot = s12(d.series.total), ant = s12(d.series.total, 12), cambio = (tot / ant - 1) * 100
  const est = s12(d.series.estado), cca = s12(d.series.ccaa), cll = s12(d.series.ccll)
  const ult = d.series.total.at(-1)!, ultA = d.series.total.at(-13)
  const xs = d.series.total.map(x => x[0]), mv = movil(d.series.total)
  const grande = GRANDES.map(g => ({ ...g, v: s12(d.series[g.k]) })).sort((a, b) => b.v - a.v)[0]
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={embudo([est, cca, cll].map(v => v / Math.max(est, cca, cll)))} color={ACC} alto={250} etiqueta="Holograma: el embudo de la recaudación reparte entre Estado, comunidades y ayuntamientos" />
        <div className="sala-dato">
          <span className="sala-k">Recaudación de la Agencia Tributaria, últimos 12 meses</span>
          <b><CountUp value={tot / 1000} fmt={v => `${nf(v, 1)} mil M€`} /></b>
          <span>hasta {MESL[+d.ultimo.slice(5) - 1]} de {d.ultimo.slice(0, 4)}, un <b>{nf(Math.abs(cambio), 1)} % {cambio >= 0 ? 'más' : 'menos'}</b> que un año antes. El que más aporta es el <b>{grande.n}</b> ({nf((grande.v / tot) * 100, 0)} de cada 100 euros). De lo recaudado, {nf((cca / tot) * 100, 0)} de cada 100 euros van a las comunidades.</span>
        </div>
      </div>
      <Ticket d={d} pob={pob} />
    </section>
    <div className="kpis is-wide">
      {GRANDES.slice(0, 4).map(g => { const v = s12(d.series[g.k]), a = s12(d.series[g.k], 12); return <button key={g.k} className="kpi" onClick={() => go(g.k === 'irpf' || g.k === 'soc' ? 'irpf' : 'consumo')}><span className="kpi-l"><i className="pto" style={{ background: g.c }} />{g.n}</span><span className="kpi-v"><CountUp value={v / 1000} fmt={x => `${nf(x, 1)} mil M€`} /></span><span className={`kpi-d ${v >= a ? 'is-good' : 'is-bad'}`}>{v >= a ? '+' : '−'}{nf(Math.abs((v / a - 1) * 100), 1)} % en un año</span></button> })}
    </div>
    <Card t="Lo recaudado en 12 meses, desde 1996" wide lead={(() => { const ok = mv.map((v, i) => [xs[i], v] as const).filter(x => x[1] != null) as [string, number][]; const crisis = ok.filter(x => x[0] < '2011').reduce((a, b) => (b[1] > a[1] ? b : a)); const suelo = ok.filter(x => x[0] > crisis[0] && x[0] < '2014').reduce((a, b) => (b[1] < a[1] ? b : a)); return <>Suma de los 12 meses anteriores a cada mes. Tras el máximo de {per(crisis[0])} ({mm(crisis[1])}), la crisis la hundió hasta {mm(suelo[1])} en {per(suelo[0])}: un {nf((1 - suelo[1] / crisis[1]) * 100, 0)} % menos. En {per(ult[0])} el mes dejó {mm(ult[1] ?? 0)}{ultA?.[1] ? <>, frente a {mm(ultA[1])} un año antes</> : null}.</> })()} fuente={AEAT}>
      <Apiladas xs={xs.slice(11).map(toT)} capas={GRANDES.map(g => ({ id: g.k, nombre: g.n, color: g.c, v: movil(d.series[g.k]).slice(11).map(v => Math.max(0, v ?? 0)) }))} titulo="Recaudación acumulada en 12 meses por impuesto" fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={mm} alto={260} />
    </Card>
  </div>
}

/** Mapa de calor años × meses: se ven las estaciones fiscales (declaraciones trimestrales, campaña de la renta…). */
function Calendario({ d }: { d: Datos }) {
  const [imp, setImp] = useState('total')
  const [hov, setHov] = useState<[string, number] | null>(null)
  const s = d.series[imp] ?? []
  const años = [...new Set(s.map(x => x[0].slice(0, 4)))].filter(y => +y >= 2008)
  const val = new Map(s.map(x => [x[0], x[1]]))
  const vals = s.filter(x => +x[0].slice(0, 4) >= 2008 && x[1] != null).map(x => x[1]!)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  // peso medio de cada mes en su año (últimos 5 años completos)
  const completos = años.filter(y => s.filter(x => x[0].startsWith(y) && x[1] != null).length === 12).slice(-5)
  const peso = MES.map((_, m) => completos.reduce((t, y) => { const tot = s.filter(x => x[0].startsWith(y)).reduce((a, x) => a + (x[1] ?? 0), 0); return t + (val.get(`${y}-${String(m + 1).padStart(2, '0')}`) ?? 0) / tot }, 0) / Math.max(1, completos.length))
  const top = peso.map((p, m) => [p, m] as const).sort((a, b) => b[0] - a[0]), bajo = top.at(-1)!
  const ESC = ['#14262f', '#5a3b2a', '#a8653a', '#f2b880', '#fff1e0']
  const neg = lo < 0
  return <div className="graficos">
    <Card t="El calendario fiscal" wide lead={<>Cada casilla es un mes: cuanto más clara, más se recaudó. {completos.length > 0 && <>Los meses fuertes son <b>{top.slice(0, 4).map(x => MESL[x[1]]).join(', ')}</b>: solo {MESL[top[0][1]]} reúne el {nf(top[0][0] * 100, 0)} % del año. El más flojo es {MESL[bajo[1]]} ({nf(bajo[0] * 100, 0)} %).</>}{neg && ' En rojo, meses en que se devolvió más de lo que entró.'}</>} fuente={AEAT}>
      <div className="modo" role="radiogroup" aria-label="Impuesto">{[['total', 'Todos'], ...GRANDES.slice(0, 4).map(g => [g.k, g.n])].map(([k, n]) => <button key={k} role="radio" aria-checked={imp === k} className={imp === k ? 'is-on' : ''} onClick={() => setImp(k)}>{n}</button>)}</div>
      <div className="cal-grid" style={{ gridTemplateColumns: `44px repeat(12, minmax(0, 1fr))` }} onPointerLeave={() => setHov(null)}>
        <span />{MES.map(m => <span key={m} className="cal-m">{m}</span>)}
        {años.map((y, yi) => <div key={y} className="cal-fila">
          <span className="cal-y">{y}</span>
          {MES.map((_, m) => { const k = `${y}-${String(m + 1).padStart(2, '0')}`, v = val.get(k); return <motion.i key={k + imp} className="cal-c" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: v == null ? 0.12 : 1, scale: 1 }} transition={{ delay: yi * 0.025 + m * 0.01, duration: 0.25 }}
            style={{ background: v == null ? 'transparent' : v < 0 ? '#ff4d5e' : colorEscala(ESC, (v - Math.max(0, lo)) / (hi - Math.max(0, lo) || 1)) }} onPointerEnter={() => v != null && setHov([k, v])} title={v != null ? `${per(k)}: ${mm(v)}` : ''} /> })}
        </div>)}
      </div>
      <p className="cal-tip">{hov ? <><b>{per(hov[0])}</b>: {mm(hov[1])}</> : 'Pasa por una casilla para ver su cifra.'}</p>
    </Card>
  </div>
}

function PorImpuesto({ d, pob }: { d: Datos; pob: number | null }) {
  const items = [...GRANDES.map(g => [g.k, g.n, g.c] as const), ...ESPECIALES.map(([k, n]) => [k, n, '#ffd166'] as const), ...OTROS.map(([k, n]) => [k, n, '#8a9bb0'] as const)]
  const cambios = items.map(([k, n, c]) => { const v = s12(d.series[k]), a = s12(d.series[k], 12); return { id: k, nombre: n, valor: a > 50 ? (v / a - 1) * 100 : NaN, sub: mm(v), color: c } }).filter(x => isFinite(x.valor)).sort((a, b) => b.valor - a.valor)
  const tot = s12(d.series.total)
  return <div className="graficos">
    <Card t="Cuánto deja cada impuesto" lead={<>Últimos 12 meses{pob ? ', y lo que supone por habitante' : ''}.</>} fuente={AEAT}>
      <Barras titulo="Recaudación por impuesto" fmt={v => `${mm(v)}${pob ? ` · ${nf((v * 1e6) / pob, 0)} €/hab.` : ''}`} limite={6} items={[...GRANDES.map(g => ({ id: g.k, nombre: g.n, valor: s12(d.series[g.k]), color: g.c }))].sort((a, b) => b.valor - a.valor)} />
      <p className="note">IRPF, IVA y Sociedades suman {nf(((s12(d.series.irpf) + s12(d.series.iva) + s12(d.series.soc)) / tot) * 100, 0)} de cada 100 euros.</p>
    </Card>
    <Card t="Qué sube y qué baja" lead={<>Cambio de los últimos 12 meses frente a los 12 anteriores. Más sube: <b>{cambios[0]?.nombre.toLowerCase()}</b> ({nf(cambios[0]?.valor ?? 0, 0)} %).</>} fuente={AEAT}>
      <Barras titulo="Variación anual por impuesto" fmt={v => `${v > 0 ? '+' : ''}${nf(v, 1)} %`} limite={10} items={cambios} />
    </Card>
  </div>
}

function Irpf({ d }: { d: Datos }) {
  const ret = s12(d.series.irpf_ret), irpf = s12(d.series.irpf)
  const quien = [['irpf_aapp', 'Administraciones públicas', '#7fd4c8'], ['irpf_ge', 'Grandes empresas', '#3987e5'], ['irpf_pyme', 'Pymes', '#9fc5ff']].map(([k, n, c]) => ({ id: k, nombre: n, valor: s12(d.series[k]), color: c }))
  const partes = [['irpf_ret', 'Retenciones de nóminas y actividades'], ['irpf_cap', 'Retenciones del ahorro'], ['irpf_alq', 'Retenciones de alquileres'], ['irpf_frac', 'Pagos fraccionados de autónomos'], ['irpf_decl', 'Declaración de la renta']].map(([k, n]) => ({ id: k, nombre: n, valor: s12(d.series[k]), color: '#3987e5' }))
  const ult24 = d.series.irpf.slice(-36)
  const soc = [['soc_grupos', 'Grupos consolidados', '#9085e9'], ['soc_ge', 'Grandes empresas', '#b9b0ff'], ['soc_pyme', 'Pymes', '#d7d1ff']].map(([k, n, c]) => ({ id: k, nombre: n, valor: s12(d.series[k]), color: c }))
  const socT = s12(d.series.soc)
  return <div className="graficos">
    <Card t="El IRPF se paga sobre todo en la nómina" lead={<>De cada 100 euros del IRPF, <b>{nf((ret / irpf) * 100, 0)}</b> llegan por las retenciones mes a mes. La declaración de la renta deja {mm(s12(d.series.irpf_decl))} netos: lo que se paga menos lo que se devuelve.</>} fuente={AEAT}>
      <Barras titulo="Partes del IRPF, últimos 12 meses" fmt={mm} items={partes.sort((a, b) => b.valor - a.valor)} />
    </Card>
    <Card t="Quién retiene" lead={<>Las retenciones de trabajo según quién paga la nómina.</>} fuente={AEAT}>
      <Barras titulo="Retenciones del trabajo por pagador" fmt={mm} items={quien.sort((a, b) => b.valor - a.valor)} />
    </Card>
    <Card t="Mes a mes" wide lead={(() => { const m = ult24.reduce((a, b) => ((b[1] ?? 0) > (a[1] ?? 0) ? b : a)); return <>IRPF neto de cada mes. Destaca {per(m[0])} ({mm(m[1] ?? 0)}): los meses de pago de trimestres y de la declaración suben; los de devoluciones de la campaña, bajan.</> })()} fuente={AEAT}>
      <Columnas titulo="IRPF neto mensual" fmt={mm} cadaX={3} items={ult24.map(x => ({ x: per(x[0]), valor: x[1] ?? 0, color: (x[1] ?? 0) < 0 ? '#ff8a95' : '#3987e5' }))} />
    </Card>
    <Card t="Sociedades: lo pagan los grandes" lead={<>De los pagos a cuenta del impuesto sobre sociedades, los grupos consolidados aportan {nf((soc[0].valor / Math.max(1, soc.reduce((t, x) => t + x.valor, 0))) * 100, 0)} de cada 100 euros. En total, el impuesto dejó {mm(socT)} en 12 meses.</>} fuente={AEAT}>
      <Barras titulo="Pagos fraccionados de sociedades" fmt={mm} items={soc} />
    </Card>
  </div>
}

function Consumo({ d, pob }: { d: Datos; pob: number | null }) {
  const br = s12(d.series.iva_bruto), dv = -s12(d.series.iva_devol), neto = s12(d.series.iva), imp = s12(d.series.iva_imp)
  const esp = ESPECIALES.map(([k, n]) => ({ id: k, nombre: n, valor: s12(d.series[k]) })).filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor)
  const tab = s12(d.series.tabaco), hid = s12(d.series.hidro)
  return <div className="graficos">
    <Card t="El IVA: lo que entra y lo que se devuelve" wide lead={<>Las empresas cobran el IVA y luego recuperan el que pagaron: de {mm(br)} ingresados, Hacienda devolvió {mm(dv)} ({nf((dv / br) * 100, 0)} %). Quedan <b>{mm(neto)}</b>. {nf((imp / br) * 100, 0)} de cada 100 euros brutos se pagan en la aduana, al importar.</>} fuente={AEAT}>
      <div className="flujo-iva" role="img" aria-label={`IVA bruto ${mm(br)}, devoluciones ${mm(dv)}, neto ${mm(neto)}`}>
        <div className="fi-fila"><span>Ingresado</span><div className="fi-b"><motion.i style={{ background: '#d95926' }} initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true }} transition={{ duration: 0.8 }} /></div><b>{mm(br)}</b></div>
        <div className="fi-fila"><span>Devuelto</span><div className="fi-b"><motion.i style={{ background: '#ff8a95', marginLeft: `${(neto / br) * 100}%` }} initial={{ width: 0 }} whileInView={{ width: `${(dv / br) * 100}%` }} viewport={{ once: true }} transition={{ delay: 0.6, duration: 0.8 }} /></div><b>−{mm(dv)}</b></div>
        <div className="fi-fila is-neto"><span>Se queda</span><div className="fi-b"><motion.i style={{ background: ACC }} initial={{ width: 0 }} whileInView={{ width: `${(neto / br) * 100}%` }} viewport={{ once: true }} transition={{ delay: 1.2, duration: 0.8 }} /></div><b>{mm(neto)}</b></div>
      </div>
    </Card>
    <Card t="Impuestos especiales" lead={<>Gravan productos concretos. Los carburantes dejan {mm(hid)}{pob ? <>: unos {nf((hid * 1e6) / pob, 0)} € por habitante al año</> : null}; el tabaco, {mm(tab)}{pob ? <> ({nf((tab * 1e6) / pob / 365, 2)} € por habitante y día)</> : null}.</>} fuente={AEAT}>
      <Barras titulo="Impuestos especiales, últimos 12 meses" fmt={mm} items={esp.map(x => ({ ...x, color: '#ffd166' }))} />
    </Card>
    <Card t="Los impuestos pequeños" lead={<>Aranceles, seguros, banca, medio ambiente, tasas… Juntos dejan {mm(s12(d.series.resto))}.</>} fuente={AEAT}>
      <Barras titulo="Resto de impuestos" fmt={mm} items={OTROS.map(([k, n]) => ({ id: k, nombre: n, valor: s12(d.series[k]), color: '#8a9bb0' })).filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor)} />
    </Card>
  </div>
}

function Reparto({ d }: { d: Datos }) {
  const xs = d.series.total.map(x => x[0]).slice(11)
  const est = movil(d.series.estado).slice(11), cca = movil(d.series.ccaa).slice(11), cll = movil(d.series.ccll).slice(11)
  const t = s12(d.series.total), c = s12(d.series.ccaa)
  const desde = xs.find((_, i) => (cca[i] ?? 0) > 0)
  return <div className="graficos">
    <Card t="Quién se queda lo recaudado" wide lead={<>La Agencia Tributaria cobra, pero parte del IRPF, el IVA y los especiales es de las comunidades y los ayuntamientos. Hoy, <b>{nf((c / t) * 100, 0)} de cada 100 euros</b> van a las comunidades{desde ? <>; la serie las separa desde {per(desde)}</> : null}. IRPF: {nf((s12(d.series.irpf_ccaa) / s12(d.series.irpf)) * 100, 0)} % para ellas; IVA: {nf((s12(d.series.iva_ccaa) / s12(d.series.iva)) * 100, 0)} %.</>} fuente={AEAT}>
      <Apiladas xs={xs.map(toT)} capas={[{ id: 'e', nombre: 'Estado', color: '#9fc5ff', v: est.map(v => Math.max(0, v ?? 0)) }, { id: 'a', nombre: 'Comunidades', color: '#ffd166', v: cca.map(v => Math.max(0, v ?? 0)) }, { id: 'l', nombre: 'Ayuntamientos', color: '#c6f25e', v: cll.map(v => Math.max(0, v ?? 0)) }]} titulo="Reparto de la recaudación, 12 meses" fx={t => per(new Date(t).toISOString().slice(0, 7))} fxEje={anio} fy={mm} alto={260} pct />
      <p className="note">País Vasco y Navarra recaudan casi todos sus impuestos con sus haciendas forales: no están aquí.</p>
    </Card>
  </div>
}

function Mapa({ d, pobProv }: { d: Datos; pobProv: Map<string, number> | null }) {
  const [sel, setSel] = useState<string | null>(null)
  const [k, setK] = useState<'total' | 'irpf'>('irpf')
  if (!d.deleg) return null
  const val = (c: string) => { if (FORALES.has(c)) return null; const v = d.deleg!.prov[c]?.[k], p = pobProv?.get(c); return v != null && p ? (v * 1e6) / p : null }
  const rk = Object.keys(PROV).map(c => ({ c, v: val(c) })).filter(x => x.v != null).sort((a, b) => b.v! - a.v!) as { c: string; v: number }[]
  const lo = rk.at(-1)?.v ?? 0, hi = rk[0]?.v ?? 1
  return <div className="graficos">
    <Card t="Lo que se ingresa en cada provincia" lead={<>{k === 'irpf' ? 'IRPF' : 'Todos los impuestos'} ingresado en cada delegación de Hacienda, en euros por habitante, de {per(d.deleg.desde)} a {per(d.deleg.hasta)}. Más: <b>{PROV[rk[0]?.c]}</b> ({nf(rk[0]?.v ?? 0)} €/hab.); menos: {PROV[rk.at(-1)?.c ?? '']} ({nf(lo)} €).</>} fuente={AEAT}>
      <div className="modo" role="radiogroup" aria-label="Impuesto">{(['irpf', 'total'] as const).map(m => <button key={m} role="radio" aria-checked={k === m} className={k === m ? 'is-on' : ''} onClick={() => setK(m)}>{m === 'irpf' ? 'IRPF' : 'Todos'}</button>)}</div>
      {pobProv ? <MapaProvincias valor={val} fmt={v => `${nf(v)} €/hab.`} titulo="Recaudación por habitante en cada provincia" color={ACC} escala={['#24343b', '#5a3b2a', '#a8653a', '#f2b880', '#fff1e0']} sel={sel} onSel={setSel} nota="Se cuenta donde tiene el domicilio fiscal quien paga: las grandes empresas con sede en Madrid ingresan allí lo de toda España. País Vasco y Navarra, en gris: tienen hacienda propia." /> : <p className="note">Cargando población…</p>}
    </Card>
    <Card t="Ranking">
      <Barras titulo="Recaudación por habitante" fmt={v => `${nf(v)} €`} limite={12} items={rk.map(x => ({ id: x.c, nombre: PROV[x.c], valor: x.v, destacado: sel === x.c, onClick: () => setSel(x.c), color: colorEscala(['#5a3b2a', '#a8653a', '#f2b880', '#fff1e0'], (x.v - lo) / ((hi - lo) || 1)) }))} />
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<Datos | null>(null), [err, setErr] = useState(false)
  const [pobProv, setPobProv] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    fetch('./data/impuestos.json').then(r => r.json()).then(setD, () => setErr(true))
    fetch('../poblacion/data/municipios.json').then(r => r.json()).then((j: { m: Record<string, [string, number[]]> }) => { const m = new Map<string, number>(); for (const [c, v] of Object.entries(j.m)) { const p = c.padStart(5, '0').slice(0, 2); m.set(p, (m.get(p) ?? 0) + (v[1].at(-1) ?? 0)) } setPobProv(m) }, () => {})
  }, [])
  const pob = useMemo(() => (pobProv ? [...pobProv.values()].reduce((a, b) => a + b, 0) : null), [pobProv])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Coins size={28} /><p>Cargando la recaudación…</p></main>
  const S = d.series
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Impuestos</h1>
          <p>Lo que recauda Hacienda cada mes · Agencia Tributaria</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <Resumen d={d} pob={pob} go={go} />}
        {sec === 'calendario' && <Calendario d={d} />}
        {sec === 'impuestos' && <PorImpuesto d={d} pob={pob} />}
        {sec === 'irpf' && <Irpf d={d} />}
        {sec === 'consumo' && <Consumo d={d} pob={pob} />}
        {sec === 'reparto' && <Reparto d={d} />}
        {sec === 'mapa' && <Mapa d={d} pobProv={pobProv} />}
      </motion.div>
      {sec === 'resumen' && <Curiosidades titulo="¿Sabías que…?" items={[
        pob && <>Cada día, Hacienda ingresa de media <b>{mm(s12(S.total) / 365)}</b>: unos {nf((s12(S.total) * 1e6) / 365 / 86400, 0)} € por segundo.</>,
        (() => { const m = S.total.filter(x => x[1] != null).reduce((a, b) => ((b[1] ?? 0) > (a[1] ?? 0) ? b : a)); return <>El mes récord fue <b>{per(m[0])}</b>, con {mm(m[1] ?? 0)}.</> })(),
        (() => { const v = s12(S.plasticos), t = s12(S.carbon); return v > 0 ? <>El impuesto a los envases de plástico, que empezó en 2023, ya deja {mm(v)} al año{t < 0 ? '; el del carbón, en cambio, sale negativo por las devoluciones' : ''}.</> : null })(),
        (() => { const a = s12(S.devol); return <>Hacienda devolvió {mm(-a)} en 12 meses: {nf((-a / s12(S.bruto)) * 100, 0)} de cada 100 euros que entraron.</> })(),
      ]} />}
      <Fuentes ids={[]} extra={[{ n: 'Agencia Tributaria · Informe mensual de recaudación tributaria', u: 'https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Informe_mensual_de_Recaudacion_Tributaria.shtml' }, { n: 'Series mensuales (Excel)', u: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/Cuadros_estadisticos_series_es_es.xlsx' }, { n: 'Ingresos por delegaciones (Excel)', u: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/Ingresos_por_Delegaciones.xlsx' }]} />
      <p className="src">Ingresos tributarios netos en términos de caja (lo que entra menos lo que se devuelve), descargados cada semana. No incluye cotizaciones sociales, impuestos locales propios (IBI, plusvalía…) ni las haciendas forales de País Vasco y Navarra. El total de todos los ingresos públicos está en <a href="../cuentas/index.html#impuestos">Cuentas públicas</a>.</p>
    </main>
  )
}
