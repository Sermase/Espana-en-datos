import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { PiggyBank, ShoppingBasket, Users, Wallet } from 'lucide-react'
import { Apiladas, Barras, Columnas, CountUp, LineChart, Sankey, nf, type Capa } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { casa, monedas } from '../holo3d/modelos'
import { MapaProvincias } from '../geo/MapaProvincias'
import { CCAA_DE_PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'

const ACC = '#ff9b85'
type S = (number | null)[]
type Corte = { año: number; gmh?: Record<string, number>; gmp?: Record<string, number>; dist?: Record<string, number> }
type D = {
  fecha: string; grupos: Record<string, string>
  epf: { años: number[]; reg: Record<string, { gmh: Record<string, S>; gmp: Record<string, S>; dist: Record<string, S> }> }
  edad: Record<string, Corte>; quintil: Record<string, Corte>; ingresos: Record<string, Corte>; tamano: Record<string, Corte>
  carencias: Record<string, Record<string, [number, number][]>>; finDeMes: Record<string, Record<string, [number, number][]>>
  ahorro: { años: number[]; geo: Record<string, S> }; ahorroTrim: { t: string[]; es: S; ue: S }
  riqueza: { años: number[]; geo: Record<string, { a: Record<string, S>; deuda: S; neta: S }> }; pob: Record<string, S>
}
const SECCIONES = [
  { id: 'gasto', nombre: 'En qué se gasta', icon: ShoppingBasket },
  { id: 'quien', nombre: 'Por edad y renta', icon: Users },
  { id: 'ahorro', nombre: 'Ahorro', icon: PiggyBank },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/** Ocho bloques del presupuesto (paleta categórica validada para el fondo oscuro); los grupos pequeños van a «Resto». */
const MACRO = [
  { id: 'vivienda', n: 'Vivienda y suministros', c: '#3987e5', g: ['vivienda'] },
  { id: 'comida', n: 'Comida, bebida y tabaco', c: '#d95926', g: ['alimentos', 'alcohol'] },
  { id: 'transporte', n: 'Transporte', c: '#199e70', g: ['transporte'] },
  { id: 'restaurantes', n: 'Bares, restaurantes y hoteles', c: '#c98500', g: ['restaurantes'] },
  { id: 'ocio', n: 'Ocio y cultura', c: '#d55181', g: ['ocio'] },
  { id: 'salud', n: 'Salud', c: '#0ca30c', g: ['sanidad'] },
  { id: 'ropa', n: 'Ropa y calzado', c: '#9085e9', g: ['ropa'] },
  { id: 'resto', n: 'Resto', c: '#6b7d86', g: ['muebles', 'comunicaciones', 'educacion', 'seguros', 'otros'] },
]
const macroDe = (g: string) => MACRO.find(m => m.g.includes(g)) ?? MACRO[7]
const eur = (v: number) => `${nf(v, 0)} €`
const pct = (a: number, b: number) => ((a - b) / b) * 100
const masMenos = (v: number, d = 0) => `${nf(Math.abs(v), d)} % ${v >= 0 ? 'más' : 'menos'}`
const signo = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)} %`
const ult = (s: S) => { for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return i; return -1 }
const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const EPF = <a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176806&menu=ultiDatos&idp=1254735976608" target="_blank" rel="noopener noreferrer">INE, Encuesta de Presupuestos Familiares</a>
const ECV = <a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176807&menu=ultiDatos&idp=1254735976608" target="_blank" rel="noopener noreferrer">INE, Encuesta de Condiciones de Vida</a>
const EUROSTAT = <a href="https://ec.europa.eu/eurostat/databrowser/view/nasq_10_ki/default/table" target="_blank" rel="noopener noreferrer">Eurostat, cuentas de los sectores</a>

/** Barras al 100 %: una fila por grupo de hogares, un tramo por parte del presupuesto. */
function Reparto({ filas, capas, titulo, etiqueta }: { filas: { id: string; nombre: string; sub?: string; v: Record<string, number> }[]; capas: { id: string; n: string; c: string }[]; titulo: string; etiqueta?: (id: string) => boolean }) {
  const [hover, setHover] = useState<string | null>(null)
  return <figure className="reparto-f" aria-label={titulo}>
    <ul className="rp-ley">{capas.map(c => <li key={c.id} className={hover && hover !== c.id ? 'is-off' : ''} onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover(null)}><i style={{ background: c.c }} />{c.n}</li>)}</ul>
    {filas.map(f => {
      const tot = capas.reduce((t, c) => t + (f.v[c.id] ?? 0), 0) || 1
      return <div key={f.id} className="rp-fila">
        <span className="rp-n">{f.nombre}{f.sub && <small>{f.sub}</small>}</span>
        <div className="rp-barra" role="img" aria-label={`${f.nombre}: ${capas.map(c => `${c.n} ${nf(((f.v[c.id] ?? 0) / tot) * 100, 0)} %`).join(', ')}`}>
          {capas.map(c => { const p = ((f.v[c.id] ?? 0) / tot) * 100; return p > 0 ? <i key={c.id} className={hover && hover !== c.id ? 'is-off' : ''} style={{ flexGrow: p, background: c.c }} title={`${c.n}: ${nf(p, 1)} %`} onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover(null)}>{(etiqueta ? etiqueta(c.id) : true) && p >= 9 ? <b>{nf(p, 0)}</b> : null}</i> : null })}
        </div>
      </div>
    })}
    <details className="rp-tabla"><summary>Ver los datos</summary>
      <table><thead><tr><th />{capas.map(c => <th key={c.id}>{c.n}</th>)}</tr></thead>
        <tbody>{filas.map(f => { const tot = capas.reduce((t, c) => t + (f.v[c.id] ?? 0), 0) || 1; return <tr key={f.id}><th>{f.nombre}</th>{capas.map(c => <td key={c.id}>{nf(((f.v[c.id] ?? 0) / tot) * 100, 1)} %</td>)}</tr> })}</tbody></table>
    </details>
  </figure>
}
const enMacro = (g?: Record<string, number>) => Object.fromEntries(MACRO.map(m => [m.id, m.g.reduce((t, k) => t + (g?.[k] ?? 0), 0)]))

function Gasto({ d }: { d: D }) {
  const E = d.epf, N = E.reg.España, i = E.años.length - 1, A = E.años[i], A0 = E.años[0]
  const tot = N.gmh.total, gr = Object.keys(d.grupos).filter(g => N.gmh[g])
  const lista = gr.map(g => ({ g, v: N.gmh[g][i] ?? 0 })).sort((a, b) => b.v - a.v)
  const macroUlt = MACRO.map(m => ({ ...m, v: m.g.reduce((t, k) => t + (N.gmh[k]?.[i] ?? 0), 0) }))
  const modelo = useMemo(() => casa([...macroUlt].sort((a, b) => b.v - a.v).map(m => m.v), Math.min(1, (d.ahorro.geo.ES.at(-1) ?? 10) / 25)), [d])
  const capas: Capa[] = MACRO.map(m => ({ id: m.id, nombre: m.n, color: m.c, v: E.años.map((_, k) => m.g.reduce((t, g) => t + (N.gmh[g]?.[k] ?? 0), 0)) }))
  const cambios = gr.map(g => ({ g, v: pct(N.gmh[g][i] ?? 0, N.gmh[g][0] ?? 1) })).sort((a, b) => b.v - a.v)
  const vivPct = ((N.gmh.vivienda[i] ?? 0) / (tot[i] ?? 1)) * 100
  // por comunidad
  const [g, setG] = useState('total'), [sel, setSel] = useState<string | null>(null)
  const regs = Object.entries(E.reg).filter(([k]) => k !== 'España')
  const val = (r: string) => E.reg[r]?.gmh[g]?.[i] ?? null
  const orden = regs.map(([k]) => ({ k, v: val(k) ?? 0 })).sort((a, b) => b.v - a.v)
  const CH = [['total', 'Todo'], ['vivienda', 'Vivienda'], ['alimentos', 'Comida'], ['transporte', 'Transporte'], ['restaurantes', 'Bares y restaurantes'], ['ocio', 'Ocio']] as const
  const nombreG = g === 'total' ? 'en total' : `en ${minus(d.grupos[g])}`
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={modelo} color={ACC} alto={270} giro={0.16} etiqueta={`Casa del gasto de ${A}: cada piso es una parte del presupuesto de un hogar, de más a menos`} />
        <div className="sala-dato">
          <span className="sala-k">Gasto medio por hogar en {A}</span>
          <b><CountUp value={tot[i] ?? 0} fmt={eur} /></b>
          <span>Un {masMenos(pct(tot[i]!, tot[i - 1]!), 1)} que en {E.años[i - 1]} y un {masMenos(pct(tot[i]!, tot[0]!))} que en {A0}, sin descontar la subida de precios. Por persona, {eur(N.gmp.total[i] ?? 0)}.</span>
          <span>De cada 100 €, <b>{nf(vivPct, 0)}</b> se van en la vivienda.</span>
        </div>
      </div>
      <ul className="sala-lista sala-lista-13" aria-label={`Gasto medio por hogar en ${A}, por grupo`}>{lista.map(({ g, v }) => <li key={g} style={{ '--c': macroDe(g).c } as CSSProperties}><i /><span>{d.grupos[g]}</span><b>{eur(v)}</b><em style={{ width: `${(v / lista[0].v) * 100}%` }} /></li>)}</ul>
    </section>
    {(() => {
      const ka = d.ahorro.geo.ES.findLastIndex(v => v != null), tasa = d.ahorro.geo.ES[ka] ?? 0, gastoTot = macroUlt.reduce((t, m) => t + m.v, 0) || 1
      const der = [...macroUlt].sort((a, b) => b.v - a.v).map(m => ({ id: m.id, nombre: m.n, corto: m.n.split(/[ ,]/)[0], valor: (m.v / gastoTot) * (100 - tasa), color: m.c }))
      der.push({ id: 'ahorro', nombre: 'Ahorro', corto: 'Ahorro', valor: tasa, color: ACC })
      return <Card wide t="A dónde va cada 100 € que entran en casa" lead={<>De cada 100 € de renta disponible, los hogares ahorran unos <b>{nf(tasa, 0)}</b> y gastan el resto: {nf(der[0].valor, 0)} € en {minus(der[0].nombre)}, {nf(der[1].valor, 0)} € en {minus(der[1].nombre)}… Toca una cinta para resaltarla.</>} fuente={<>{EPF} y Eurostat (tasa de ahorro de {d.ahorro.años[ka]})</>}>
        <Sankey izq={[{ id: 'renta', nombre: 'Renta disponible', corto: 'Renta', valor: 100, color: ACC }]} der={der} centro="EL HOGAR" fmt={v => `${nf(v, 1)} €`} titulo="Reparto de 100 € de renta disponible de un hogar" alto={420} />
        <p className="note">Aproximado: el ahorro es la tasa de ahorro de Eurostat y el gasto se reparte según la Encuesta de Presupuestos Familiares de {A} (con el alquiler imputado dentro de vivienda).</p>
      </Card>
    })()}
    <Card wide t="La cesta, año a año" lead={<>El gasto que más ha crecido desde {A0} es {minus(d.grupos[cambios[0].g])} ({signo(cambios[0].v, 0)}); el que menos, {minus(d.grupos[cambios.at(-1)!.g])} ({signo(cambios.at(-1)!.v, 0)}). {E.años.includes(2020) ? <>En 2020, con el confinamiento, el gasto cayó un {nf(Math.abs(pct(tot[E.años.indexOf(2020)]!, tot[E.años.indexOf(2019)]!)), 0)} %.</> : null}</>} fuente={EPF}>
      <Apiladas xs={E.años} capas={capas} titulo="Gasto medio por hogar por grupo" fx={a => String(a)} fy={v => eur(v)} alto={300} />
      <p className="note">Euros corrientes por hogar y año. «Vivienda» incluye el alquiler imputado: lo que pagarían de alquiler quienes viven en una casa propia o cedida, que el INE cuenta como gasto aunque no salga de la cuenta.</p>
    </Card>
    <Card t={`Cambio desde ${A0}`} lead="Por grupo de gasto, en euros corrientes.">
      <Barras titulo={`Cambio del gasto por grupo desde ${A0}`} limite={13} fmt={v => signo(v, 0)} items={cambios.map(x => ({ id: x.g, nombre: d.grupos[x.g], valor: x.v, color: macroDe(x.g).c }))} />
    </Card>
    <Card t="Por comunidad" lead={<>{orden[0] && orden.at(-1) ? <>Un hogar de {orden[0].k} gasta {nombreG} {eur(orden[0].v)} al año; uno de {orden.at(-1)!.k}, {eur(orden.at(-1)!.v)}: un {nf(pct(orden[0].v, orden.at(-1)!.v), 0)} % más.</> : null}</>}>
      <div className="chips" role="radiogroup" aria-label="Grupo de gasto">{CH.map(([k, n]) => <button key={k} role="radio" aria-checked={g === k} className={g === k ? 'is-on' : ''} style={{ '--c': k === 'total' ? ACC : macroDe(k).c } as CSSProperties} onClick={() => setG(k)}><i />{n}</button>)}</div>
      <MapaProvincias grupo={c => CCAA_DE_PROV[c] ?? null} claveGrupo="ccaa" valor={val} fmt={eur} titulo={`Gasto medio por hogar ${nombreG}, ${A}`} color={g === 'total' ? ACC : macroDe(g).c} sel={sel} onSel={setSel}
        nota={sel ? `${sel}: ${eur(val(sel) ?? 0)} por hogar; ${eur(E.reg[sel]?.gmp.total?.[i] ?? 0)} por persona en total` : 'Cuanto más intenso, más gasto por hogar. Toca una comunidad para ver su dato.'} />
    </Card>
  </div>
}

function Quien({ d }: { d: D }) {
  const edades = Object.entries(d.edad).filter(([k]) => k !== 'Todas las edades')
  const quint = Object.entries(d.quintil).filter(([k]) => /quintil/i.test(k))
  const fila = ([k, c]: [string, Corte], sub?: string) => ({ id: k, nombre: k.replace(/^De /, '').replace(' años', ''), sub, v: enMacro(c.gmh) })
  const share = (c: Corte | undefined, m: string) => { const v = enMacro(c?.gmh); const t = Object.values(v).reduce((a, b) => a + b, 0) || 1; return (v[m] / t) * 100 }
  const joven = edades[0]?.[1], mayor = edades.at(-1)?.[1], q1 = quint[0]?.[1], q5 = quint.at(-1)?.[1]
  const ingr = Object.entries(d.ingresos).filter(([k]) => k !== 'Total')
  const tam = Object.entries(d.tamano).filter(([k]) => k !== 'Total')
  const A = d.edad['Todas las edades']?.año
  return <div className="graficos">
    <Card wide t="Por edad de quien sostiene la casa" lead={joven && mayor ? <>Los hogares de mayores de 65 dedican el <b>{nf(share(mayor, 'vivienda'), 0)} %</b> de su gasto a la vivienda y el {nf(share(mayor, 'comida'), 0)} % a la comida; los de menores de 30, el {nf(share(joven, 'vivienda'), 0)} % y el {nf(share(joven, 'comida'), 0)} %. {share(joven, 'restaurantes') > share(mayor, 'restaurantes') ? `Los jóvenes gastan más en bares y restaurantes (${nf(share(joven, 'restaurantes'), 0)} % frente a ${nf(share(mayor, 'restaurantes'), 0)} %).` : ''}</> : null} fuente={EPF}>
      <Reparto titulo={`Reparto del gasto por edad del sustentador principal, ${A}`} capas={MACRO} filas={edades.map(e => fila(e, `${eur(e[1].gmh?.total ?? 0)} por hogar`))} />
      <p className="note">El sustentador principal es quien más aporta al presupuesto del hogar. Porcentaje del gasto de cada grupo de hogares.</p>
    </Card>
    <Card wide t="Lo básico pesa más cuanto menos se gasta" lead={q1 && q5 ? <>El 20 % de hogares que menos gasta dedica el <b>{nf(share(q1, 'vivienda') + share(q1, 'comida'), 0)} %</b> a vivienda y comida; el 20 % que más gasta, el {nf(share(q5, 'vivienda') + share(q5, 'comida'), 0)} %. Un hogar del grupo de arriba gasta {nf((q5.gmh?.total ?? 0) / (q1.gmh?.total ?? 1), 1)} veces lo que uno del de abajo.</> : null} fuente={EPF}>
      <Reparto titulo={`Reparto del gasto por quintil de gasto, ${A}`} capas={MACRO} filas={quint.map(q => fila(q, `${eur(q[1].gmh?.total ?? 0)} por hogar`))} />
      <p className="note">Quintiles: los hogares ordenados de menos a más gasto por persona y partidos en cinco grupos del mismo tamaño.</p>
    </Card>
    <Card t="Por ingresos del hogar" lead={ingr.length ? <>Un hogar que ingresa {minus(ingr.at(-1)![0])} al mes gasta {eur(ingr.at(-1)![1].gmh?.total ?? 0)} al año; uno de {minus(ingr[0][0])}, {eur(ingr[0][1].gmh?.total ?? 0)}.</> : null}>
      <Columnas titulo="Gasto medio por hogar según sus ingresos netos al mes (€)" fmt={eur} alto={200} items={ingr.map(([k, c]) => ({ x: k.replace(/^De /, '').replace(/ euros/, '').replace(' a ', '–').replace('Hasta ', '≤').replace(' o más', '+'), valor: c.gmh?.total ?? 0, color: ACC }))} />
    </Card>
    <Card t="Por tamaño del hogar" lead={tam.length ? <>Vivir juntos abarata: por persona, un hogar de {tam.at(-1)![0].replace('miembros', 'personas')} gasta {eur(tam.at(-1)![1].gmp?.total ?? 0)}, un {nf(Math.abs(pct(tam.at(-1)![1].gmp?.total ?? 0, tam[0][1].gmp?.total ?? 1)), 0)} % menos que quien vive solo.</> : null}>
      <Columnas titulo="Gasto medio por persona según el tamaño del hogar" fmt={eur} alto={200} items={tam.map(([k, c]) => ({ x: k.replace(' miembros', '').replace(' miembro', '').replace(' o más', '+'), valor: c.gmp?.total ?? 0, color: ACC }))} />
      <p className="note">Personas que viven en el hogar.</p>
    </Card>
  </div>
}

const DINERO = [
  { id: 'dep', n: 'Depósitos y efectivo', c: '#3987e5', k: ['F2'] },
  { id: 'seg', n: 'Seguros y planes de pensiones', c: '#199e70', k: ['F6'] },
  { id: 'fon', n: 'Fondos de inversión', c: '#d55181', k: ['F52'] },
  { id: 'acc', n: 'Acciones y participaciones en empresas', c: '#c98500', k: ['F511', 'F512', 'F519'] },
  { id: 'rf', n: 'Bonos y letras', c: '#9085e9', k: ['F3'] },
]
/** Lo que mide la Encuesta de Condiciones de Vida, en corto y como frase en pasado. */
const ITEM: [RegExp, string, string][] = [
  [/imprevist/i, 'No puede afrontar un gasto imprevisto', 'no podía afrontar un gasto imprevisto'],
  [/vacaciones/i, 'No puede irse una semana de vacaciones', 'no podía irse ni una semana de vacaciones'],
  [/carne/i, 'No puede comer carne o pescado cada dos días', 'no podía comer carne o pescado cada dos días'],
  [/retrasos/i, 'Retrasos en los pagos de la vivienda', 'se retrasó en algún pago de la vivienda (hipoteca, alquiler o recibos)'],
]
const PAIS: Record<string, string> = { ES: 'España', EU27_2020: 'UE', DE: 'Alemania', FR: 'Francia', IT: 'Italia', PT: 'Portugal' }
const DIF = [
  { id: 'Con mucha dificultad', n: 'Con mucha dificultad', c: '#e66767' }, { id: 'Con dificultad', n: 'Con dificultad', c: '#c97a5d' }, { id: 'Con cierta dificultad', n: 'Con cierta dificultad', c: '#8c7a6e' },
  { id: 'Con cierta facilidad', n: 'Con cierta facilidad', c: '#5f7f8c' }, { id: 'Con facilidad', n: 'Con facilidad', c: '#3f86ad' }, { id: 'Con mucha facilidad', n: 'Con mucha facilidad', c: '#3987e5' },
]

function Ahorro({ d }: { d: D }) {
  const T = d.ahorroTrim, k = ult(T.es), A = d.ahorro, ka = ult(A.geo.ES)
  const pts = (s: S) => T.t.flatMap((t, j) => (s[j] == null ? [] : [[+t.slice(0, 4) + (+t.slice(-1) - 1) / 4, s[j]!]])) as [number, number][]
  const max = T.es.reduce<number>((b, v, j) => (v ?? -1) > (T.es[b] ?? -1) ? j : b, 0)
  const R = d.riqueza, kr = ult(R.geo.ES.a.F), ar = R.años[kr]
  const comp = (g: string) => Object.fromEntries(DINERO.map(x => [x.id, x.k.reduce((t, n) => t + (R.geo[g]?.a[n]?.[kr] ?? 0), 0)]))
  const pc = (g: string, id: string) => { const c = comp(g), t = Object.values(c).reduce((a, b) => a + b, 0) || 1; return (c[id] / t) * 100 }
  const hab = (v: number | null | undefined, g = 'ES') => (v != null && d.pob[g]?.[kr] ? (v * 1e6) / d.pob[g]![kr]! : null)
  const capasRiq: Capa[] = DINERO.map(x => ({ id: x.id, nombre: x.n, color: x.c, v: R.años.map((_, j) => x.k.reduce((t, n) => t + (R.geo.ES.a[n]?.[j] ?? 0), 0) / 1000) }))
  const inicio = R.geo.ES.a.F.findIndex(v => v != null)
  // Encuesta de Condiciones de Vida
  const ITEMS = Object.keys(d.carencias)
  const [it, setIt] = useState(ITEMS.find(x => /imprevist/i.test(x)) ?? ITEMS[0])
  const EDADES = ['Total', 'De 16 a 29 años', 'De 30 a 44 años', 'De 45 a 64 años', '65 y más años']
  const ser = d.carencias[it] ?? {}, totS = ser.Total ?? [], uA = totS.at(-1)
  const fin = d.finDeMes, finA = fin['Con mucha dificultad']?.Total?.at(-1)?.[0]
  const finEdad = (e: string) => Object.fromEntries(DIF.map(x => [x.id, fin[x.id]?.[e]?.find(p => p[0] === finA)?.[1] ?? 0]))
  const dificil = (e: string) => { const f = finEdad(e); return f['Con mucha dificultad'] + f['Con dificultad'] }
  const corto = (s: string) => ITEM.find(([re]) => re.test(s))?.[1] ?? s
  const frase = (s: string) => ITEM.find(([re]) => re.test(s))?.[2] ?? minus(s)
  const pilas = useMemo(() => { const v = A.geo.ES.slice(Math.max(0, ka - 7), ka + 1).map(x => x ?? 0), m = Math.max(...v) || 1; return monedas(v.map(x => x / m)) }, [A, ka])
  const ordenUE = Object.keys(A.geo).map(g => ({ g, v: A.geo[g][ka] })).filter(x => x.v != null).sort((a, b) => b.v! - a.v!)
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={pilas} color={ACC} alto={250} giro={0.16} etiqueta={`Pilas de monedas: la tasa de ahorro de cada año desde ${A.años[ka - 7]}`} />
      <div className="sala-dato">
        <span className="sala-k">Tasa de ahorro de los hogares, {T.t[k].replace('-Q', ', trimestre ')}</span>
        <b><CountUp value={T.es[k] ?? 0} fmt={v => `${nf(v, 1)} %`} /></b>
        <span>De cada 100 € que entran en casa (después de impuestos y cotizaciones), los hogares ahorran {nf(T.es[k] ?? 0, 0)}. En la UE, {nf(T.ue[k] ?? 0, 0)}.</span>
        <span>El récord fue en {T.t[max].replace('-Q', ', trimestre ')}, con el confinamiento: {nf(T.es[max] ?? 0, 1)} %.</span>
      </div>
      </div>
      <div className="kpis3">
        <div><small>Ahorro guardado en productos financieros</small><b>{eur(hab(R.geo.ES.a.F[kr]) ?? 0)}</b><span>por habitante en {ar}</span></div>
        <div><small>Deudas (hipotecas y préstamos)</small><b>{eur(hab(R.geo.ES.deuda[kr]) ?? 0)}</b><span>por habitante</span></div>
        <div><small>Ahorro neto (activos financieros menos deudas)</small><b>{eur(hab(R.geo.ES.neta[kr]) ?? 0)}</b><span>por habitante; en la UE, {eur(hab(R.geo.EU27_2020?.neta[kr], 'EU27_2020') ?? 0)}</span></div>
      </div>
    </section>
    <Card wide t="Cuánto se ahorra" lead={<>Tasa de ahorro trimestral, sin el efecto de las estaciones. España {(T.es[k] ?? 0) >= (T.ue[k] ?? 0) ? 'ahorra ya más que la media europea' : 'ahorra menos que la media europea'}: {nf(T.es[k] ?? 0, 1)} % frente a {nf(T.ue[k] ?? 0, 1)} %.</>} fuente={EUROSTAT}>
      <LineChart titulo="Tasa de ahorro de los hogares" alto={250} fx={x => `${Math.floor(x)}`} fy={v => `${nf(v, 0)} %`} series={[{ id: 'ue', nombre: 'UE', fondo: true, datos: pts(T.ue) }, { id: 'es', nombre: 'España', color: ACC, datos: pts(T.es) }]} />
      <p className="note">Ahorro bruto sobre la renta disponible de los hogares (y las instituciones sin fines de lucro a su servicio).</p>
    </Card>
    <Card t={`Frente a los vecinos, ${A.años[ka]}`} lead={`Tasa de ahorro anual. ${ordenUE[0] ? `${PAIS[ordenUE[0].g]} es quien más ahorra (${nf(ordenUE[0].v!, 1)} %).` : ''}`}>
      <Barras titulo="Tasa de ahorro de los hogares por país" fmt={v => `${nf(v, 1)} %`} items={ordenUE.map(x => ({ id: x.g, nombre: PAIS[x.g] ?? x.g, valor: x.v!, color: x.g === 'ES' ? ACC : '#5f7480', destacado: x.g === 'ES' }))} />
    </Card>
    <Card t="Dónde está el dinero" lead={<>Los hogares españoles guardan el <b>{nf(pc('ES', 'dep'), 0)} %</b> de sus activos financieros en depósitos y efectivo; en la UE, el {nf(pc('EU27_2020', 'dep'), 0)} %. {pc('ES', 'fon') > pc('EU27_2020', 'fon') ? 'En fondos de inversión, España está por encima de la media.' : 'En fondos de inversión, por debajo de la media.'}</>} fuente={<a href="https://ec.europa.eu/eurostat/databrowser/view/nasa_10_f_bs/default/table" target="_blank" rel="noopener noreferrer">Eurostat, balance financiero de los hogares</a>}>
      <Reparto titulo={`Reparto de los activos financieros de los hogares, ${ar}`} capas={DINERO} filas={['ES', 'EU27_2020', 'DE', 'FR', 'IT'].filter(g => R.geo[g]).map(g => ({ id: g, nombre: PAIS[g], v: comp(g) }))} />
      <p className="note">No incluye la vivienda: solo el dinero y los productos financieros. Las participaciones incluyen las de empresas que no cotizan, como los negocios familiares.</p>
    </Card>
    <Card wide t={`Del colchón al fondo, ${R.años[inicio]}–${ar}`} lead={<>Activos financieros de los hogares españoles, en miles de millones de euros. Los fondos de inversión valen hoy {nf(((R.geo.ES.a.F52[kr] ?? 0) / (R.geo.ES.a.F52[inicio] || 1)), 1)} veces lo que en {R.años[inicio]}; los depósitos, {nf((R.geo.ES.a.F2[kr] ?? 0) / (R.geo.ES.a.F2[inicio] || 1), 1)} veces.</>}>
      <Apiladas xs={R.años.slice(inicio, kr + 1)} capas={capasRiq.map(c => ({ ...c, v: c.v.slice(inicio, kr + 1) }))} titulo="Activos financieros de los hogares" fx={a => String(a)} fy={v => `${nf(v, 0)} mil M€`} alto={280} />
    </Card>
    <Card wide t="Cuando no llega" lead={uA ? <>En {uA[0]}, el <b>{nf(uA[1], 1)} %</b> de la población {frase(it)}{totS.length > 1 ? <> ({(uA[1] - totS[0][1]) < 0 ? `${nf(totS[0][1] - uA[1], 1)} puntos menos` : `${nf(uA[1] - totS[0][1], 1)} puntos más`} que en {totS[0][0]})</> : null}.</> : null} fuente={ECV}>
      <div className="chips" role="radiogroup" aria-label="Qué mirar">{ITEMS.filter(x => !/plazos/.test(x)).map(x => <button key={x} role="radio" aria-checked={it === x} className={it === x ? 'is-on' : ''} style={{ '--c': ACC } as CSSProperties} onClick={() => setIt(x)}><i />{corto(x)}</button>)}</div>
      <LineChart titulo={corto(it)} alto={240} fx={a => String(a)} fy={v => `${nf(v, 0)} %`} series={EDADES.filter(e => ser[e]).map((e, j) => ({ id: e, nombre: e === 'Total' ? 'Toda la población' : e.replace('De ', '').replace(' años', ''), color: e === 'Total' ? ACC : ['#3987e5', '#199e70', '#c98500', '#9085e9'][j - 1], datos: ser[e].map(([a, v]) => [a, v] as [number, number]) })).sort((a, b) => (a.id === 'Total' ? 1 : 0) - (b.id === 'Total' ? 1 : 0))} />
      <p className="note">Porcentaje de personas que viven en un hogar en esa situación.</p>
    </Card>
    {finA && <Card wide t={`Llegar a fin de mes, ${finA}`} lead={<>El {nf(dificil('Total'), 0)} % de la población llega a fin de mes con dificultad o mucha dificultad. Por edad, quien más lo nota es el grupo de {EDADES.slice(1).sort((a, b) => dificil(b) - dificil(a))[0].replace('De ', '').replace(' años', ' años')} ({nf(Math.max(...EDADES.slice(1).map(dificil)), 0)} %).</>} fuente={ECV}>
      <Reparto titulo={`Cómo llegan a fin de mes, por edad, ${finA}`} capas={DIF} filas={EDADES.map(e => ({ id: e, nombre: e === 'Total' ? 'Todos' : e.replace('De ', '').replace(' años', ''), v: finEdad(e) }))} />
    </Card>}
  </div>
}

export default function App() {
  const [d, setD] = useState<D | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/hogares.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'gasto')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Wallet size={28} /><p>Cargando las cuentas de casa…</p></main>
  const E = d.epf, N = E.reg.España, i = E.años.length - 1
  const t = d.tamano, uno = t['1 miembro']?.gmp?.total, cinco = t['5 o más miembros']?.gmp?.total
  const R = d.riqueza, kr = ult(R.geo.ES.a.F)
  const rest = N.gmh.restaurantes?.[i], alim = N.gmh.alimentos?.[i]
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Hogares</h1>
          <p>En qué gastan y cuánto ahorran las familias · INE y Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'gasto' && <Gasto d={d} />}
        {sec === 'quien' && <Quien d={d} />}
        {sec === 'ahorro' && <Ahorro d={d} />}
      </motion.div>
      <Curiosidades titulo="¿Sabías que…?" items={[
        rest && alim ? <>Por cada 100 € que un hogar gasta en comida y bebida para casa, gasta <b>{nf((rest / alim) * 100, 0)} €</b> en bares, restaurantes y hoteles.</> : null,
        uno && cinco ? <>Quien vive solo gasta {nf(uno, 0)} € al año; en un hogar de cinco o más, cada persona gasta {nf(cinco, 0)} €: <b>un {nf((1 - cinco / uno) * 100, 0)} % menos</b> por cabeza.</> : null,
        R.geo.ES.a.F2[kr] ? <>Los hogares españoles tienen <b>{nf((R.geo.ES.a.F2[kr] ?? 0) / 1e6, 2)} billones de euros</b> en depósitos y efectivo: unos {nf(((R.geo.ES.a.F2[kr] ?? 0) * 1e6) / (d.pob.ES[kr] ?? 1), 0)} € por habitante.</> : null,
      ]} />
      <Fuentes ids={[]} extra={[{ n: 'INE · Encuesta de Presupuestos Familiares', u: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176806&menu=ultiDatos&idp=1254735976608' }, { n: 'INE · Encuesta de Condiciones de Vida', u: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176807&menu=ultiDatos&idp=1254735976608' }, { n: 'Eurostat · Tasa de ahorro de los hogares (nasq_10_ki)', u: 'https://ec.europa.eu/eurostat/databrowser/view/nasq_10_ki/default/table' }, { n: 'Eurostat · Balance financiero de los hogares (nasa_10_f_bs)', u: 'https://ec.europa.eu/eurostat/databrowser/view/nasa_10_f_bs/default/table' }]} />
      <p className="src">Gasto: Encuesta de Presupuestos Familiares, base 2016, gasto en euros corrientes. Datos de {d.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
