import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Boxes, Gauge, Globe2, Scale } from 'lucide-react'
import { Barras, Columnas, CountUp, LineChart, nf } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { globo, portacontenedores, type Ruta } from '../holo3d/modelos'
import { MapaMundo, isoDe, nombrePais } from '../mundo/MapaMundo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import resumen from '../resumen.json'
const HAB = (resumen as unknown as { poblacion: { total: number } }).poblacion.total
import { FAMILIAS, hs2, type Familia } from './hs2'

const EXP = '#c6f25e', IMP = '#3987e5'
type Par = { imp: number; exp: number }
type Datos = { fecha: string; socios: Record<string, string>; productos: Record<string, string>; porPais: Record<string, Record<string, Par>>; porProd: Record<string, Record<string, Par>> }
const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'paises', nombre: 'Países', icon: Globe2 },
  { id: 'productos', nombre: 'Productos', icon: Boxes },
  { id: 'balanza', nombre: 'Balanza', icon: Scale },
] as const
type Sec = (typeof SECCIONES)[number]['id']
type Flujo = 'exp' | 'imp'

const meur = (v: number) => Math.abs(v) >= 1e9 ? `${nf(v / 1e9, 1)} mil M€` : `${nf(v / 1e6, 0)} M€`
const COMEXT = 'https://ec.europa.eu/eurostat/databrowser/view/DS-045409/default/table?lang=es'
/** ¿Es un país de verdad (y no un agregado, avituallamiento o «secreto»)? */
const esPais = (c: string) => c.length === 2 && !['QP', 'QQ', 'QR', 'QS', 'QU', 'QV', 'QW', 'QX', 'QY', 'QZ', 'XC', 'XL', 'ES'].includes(c) && nombrePais(c) !== isoDe(c)
/** Posición aproximada de cada país para los arcos del holograma (centroides redondeados). */
const LATLON: Record<string, [number, number]> = { FR: [46, 2], DE: [51, 10], PT: [39.5, -8], IT: [42.5, 12.5], US: [39, -98], UK: [54, -2], NL: [52, 5.5], BE: [50.5, 4.5], CN: [35, 103], MA: [32, -6], MX: [23, -102], TR: [39, 35], PL: [52, 19], CH: [47, 8], JP: [36, 138], BR: [-10, -55], DZ: [28, 3], IE: [53, -8], KR: [36, 128], IN: [21, 78], SA: [24, 45], NG: [9, 8], RU: [60, 90], AR: [-34, -64], CL: [-30, -71], CA: [56, -106], AU: [-25, 134], VN: [16, 107], BD: [24, 90], AE: [24, 54], SE: [62, 15], AT: [47.5, 14], CZ: [49.8, 15.5], RO: [46, 25], GR: [39, 22], EL: [39, 22], LY: [27, 17], IQ: [33, 44], KZ: [48, 67], EG: [26, 30], TN: [34, 9], ZA: [-29, 24], CO: [4, -73], PE: [-10, -76], TW: [23.7, 121], TH: [15, 101], ID: [-2, 118], HU: [47, 19.5], DK: [56, 10], NO: [62, 10], FI: [64, 26], SK: [48.7, 19.5] }

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
function Toggle<T extends string>({ v, set, op, label }: { v: T; set: (x: T) => void; op: [T, string][]; label: string }) {
  return <div className="modo" role="radiogroup" aria-label={label}>{op.map(([k, n]) => <button key={k} role="radio" aria-checked={v === k} className={v === k ? 'is-on' : ''} onClick={() => set(k)}>{n}</button>)}</div>
}

function Resumen({ d, go }: { d: Datos; go: (s: Sec) => void }) {
  const [holo, setHolo] = useState<'globo' | 'barco'>('globo')
  const años = Object.keys(d.porPais).sort(), a = años.at(-1)!, a0 = años.at(-2)!
  const w = d.porPais[a].WORLD, w0 = d.porPais[a0].WORLD
  const ue = d.porPais[a].INT_EU27_2020
  const socios = Object.entries(d.porPais[a]).filter(([k]) => esPais(k)).map(([k, v]) => ({ k, v })).sort((x, y) => y.v.exp - x.v.exp)
  // En el globo, los vecinos europeos quedarían pegados a España: se mezclan los 4 primeros de Europa con los 8 primeros de fuera
  const EUR = new Set(['FR', 'DE', 'PT', 'IT', 'UK', 'NL', 'BE', 'PL', 'CH', 'IE', 'SE', 'AT', 'CZ', 'RO', 'EL', 'HU', 'DK', 'NO', 'FI', 'SK'])
  const rutas: Ruta[] = useMemo(() => { const c = socios.filter(s => LATLON[s.k]); return [...c.filter(s => EUR.has(s.k)).slice(0, 4), ...c.filter(s => !EUR.has(s.k)).slice(0, 8)].map(s => ({ lat: LATLON[s.k][0], lon: LATLON[s.k][1], peso: Math.sqrt(s.v.exp / socios[0].v.exp), sale: true })) }, [a]) // eslint-disable-line react-hooks/exhaustive-deps
  const serie = (f: Flujo) => años.map(y => [Date.UTC(Number(y), 6, 1), d.porPais[y].WORLD[f] / 1e9] as [number, number])
  const fam = Object.entries(d.porProd[Object.keys(d.porProd).sort().at(-1)!] ?? {}).reduce<Record<string, number>>((m, [c, v]) => { const f = hs2(c).f; m[f] = (m[f] ?? 0) + v.exp; return m }, {})
  const famTop = Object.entries(fam).sort((x, y) => y[1] - x[1])
  const prodTop = Object.entries(d.porProd[Object.keys(d.porProd).sort().at(-1)!] ?? {}).sort((x, y) => y[1].exp - x[1].exp)[0]
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D key={holo} modelo={holo === 'globo' ? globo(rutas) : portacontenedores()} color={EXP} alto={260} giro={holo === 'globo' ? 0.18 : 0.25} etiqueta="Holograma del comercio de España" />
        <div className="sala-dato">
          <Toggle v={holo} set={setHolo} label="Holograma" op={[['globo', 'Rutas'], ['barco', 'Portacontenedores']]} />
          <span className="sala-k">España vendió al mundo en {a}</span>
          <b><CountUp value={w.exp / 1e9} fmt={v => `${nf(v, 1)} mil M€`} /></b>
          <span>{w.exp > w0.exp ? 'Un' : 'Un'} {nf(Math.abs(w.exp / w0.exp - 1) * 100, 1)} % {w.exp > w0.exp ? 'más' : 'menos'} que en {a0}. Compró por {meur(w.imp)}: cubre con lo que vende el <b>{nf((w.exp / w.imp) * 100, 0)} %</b> de lo que compra. El {nf((ue.exp / w.exp) * 100, 0)} % de las ventas va a la Unión Europea, y el primer cliente es <b>{nombrePais(socios[0].k)}</b>.</span>
        </div>
      </div>
    </section>
    <div className="kpis is-wide">
      <button className="kpi" onClick={() => go('paises')}><span className="kpi-l">Exportaciones {a}</span><span className="kpi-v"><CountUp value={w.exp / 1e9} fmt={v => `${nf(v, 0)} mil M€`} /></span><span className="kpi-p">bienes, sin servicios ni turismo</span></button>
      <button className="kpi" onClick={() => go('paises')}><span className="kpi-l">Importaciones {a}</span><span className="kpi-v"><CountUp value={w.imp / 1e9} fmt={v => `${nf(v, 0)} mil M€`} /></span><span className="kpi-p">bienes</span></button>
      <button className="kpi" onClick={() => go('balanza')}><span className="kpi-l">Saldo comercial</span><span className="kpi-v"><CountUp value={(w.exp - w.imp) / 1e9} fmt={v => `${nf(v, 1)} mil M€`} /></span><span className="kpi-p">{w.exp < w.imp ? 'déficit: compramos más de lo que vendemos' : 'superávit'}</span></button>
      {prodTop && <button className="kpi" onClick={() => go('productos')}><span className="kpi-l">Lo que más vendemos</span><span className="kpi-v kpi-txt">{hs2(prodTop[0]).n}</span><span className="kpi-p">{meur(prodTop[1].exp)}</span></button>}
    </div>
    <Card t="Diez años de comercio" wide lead="Ventas y compras de bienes al resto del mundo cada año. La caída de 2020 es la pandemia; el salto de 2022, la subida de la energía, que encareció lo que compramos." fuente={<>Eurostat, <a href={COMEXT} target="_blank" rel="noopener noreferrer">Comext DS-045409</a></>}>
      <LineChart titulo="Exportaciones e importaciones de bienes" series={[{ id: 'e', nombre: 'Exportaciones', datos: serie('exp'), color: EXP, area: true }, { id: 'i', nombre: 'Importaciones', datos: serie('imp'), color: IMP }]} fx={t => String(new Date(t).getUTCFullYear())} ticksX={años.map(y => Date.UTC(+y, 6, 1)).filter((_, i, l) => l.length < 8 || i % 2 === (l.length - 1) % 2)} fy={v => `${nf(v, 0)} mil M€`} yMin={0} />
    </Card>
    <Card t="Qué vende España" lead="Exportaciones por grandes familias de productos.">
      <Barras suma titulo="Exportaciones por familia" fmt={meur} items={famTop.map(([f, v]) => ({ id: f, nombre: FAMILIAS[f as Familia].nombre, valor: v, color: FAMILIAS[f as Familia].color, sub: `${nf((v / w.exp) * 100, 0)} %` }))} />
    </Card>
    <Card t="A quién vende" lead="Primeros diez clientes.">
      <Barras suma titulo="Principales destinos" fmt={meur} items={socios.slice(0, 10).map(s => ({ id: s.k, nombre: nombrePais(s.k), valor: s.v.exp, color: EXP, sub: `${nf((s.v.exp / w.exp) * 100, 1)} %` }))} />
    </Card>
  </div>
}

function Paises({ d }: { d: Datos }) {
  const años = Object.keys(d.porPais).sort()
  const [a, setA] = useState(años.at(-1)!)
  const [f, setF] = useState<Flujo>('exp')
  const [sel, setSel] = useState<string | null>(null)
  const datos = Object.entries(d.porPais[a]).filter(([k]) => esPais(k)).map(([k, v]) => ({ pais: k, valor: v[f] })).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor)
  const tot = d.porPais[a].WORLD[f]
  const color = f === 'exp' ? EXP : IMP
  const s = sel ? d.porPais[a][sel] ?? d.porPais[a][sel === 'GR' ? 'EL' : sel === 'GB' ? 'UK' : sel] : null
  const clave = sel ? (d.porPais[a][sel] ? sel : sel === 'GR' ? 'EL' : sel === 'GB' ? 'UK' : sel) : null
  return <div className="graficos">
    <Card t={f === 'exp' ? '¿A quién vende España?' : '¿A quién compra España?'} wide lead={<>{a}: el primero es <b>{nombrePais(datos[0].pais)}</b> ({nf((datos[0].valor / tot) * 100, 1)} %), seguido de {nombrePais(datos[1].pais)} y {nombrePais(datos[2].pais)}. España {f === 'exp' ? 'vende' : 'compra'} a {datos.length} países. Toca uno para ver su historia.</>}
      fuente={<>Eurostat, <a href={COMEXT} target="_blank" rel="noopener noreferrer">Comext DS-045409</a> · valor en euros</>}>
      <div className="filtros">
        <Toggle v={f} set={x => setF(x)} label="Sentido" op={[['exp', 'Exportaciones'], ['imp', 'Importaciones']]} />
        <Toggle v={a} set={setA} label="Año" op={años.slice(-5).map(y => [y, y] as [string, string])} />
      </div>
      <MapaMundo datos={datos} color={color} fmt={meur} titulo={`${f === 'exp' ? 'Exportaciones' : 'Importaciones'} de España por país, ${a}`} sentido={f === 'exp' ? 'sale' : 'entra'} sel={sel} onSel={setSel} rutas={12} />
    </Card>
    {clave && s && <Card t={nombrePais(clave)} lead={<>En {a} España le vendió {meur(s.exp)} y le compró {meur(s.imp)}: un {s.exp >= s.imp ? <b>superávit</b> : <b>déficit</b>} de {meur(Math.abs(s.exp - s.imp))}.</>}>
      <LineChart titulo={`Comercio con ${nombrePais(clave)}`} series={[{ id: 'e', nombre: 'Le vendemos', datos: años.map(y => [Date.UTC(+y, 6, 1), (d.porPais[y][clave]?.exp ?? 0) / 1e9] as [number, number]), color: EXP, area: true }, { id: 'i', nombre: 'Le compramos', datos: años.map(y => [Date.UTC(+y, 6, 1), (d.porPais[y][clave]?.imp ?? 0) / 1e9] as [number, number]), color: IMP }]} fx={t => String(new Date(t).getUTCFullYear())} ticksX={años.map(y => Date.UTC(+y, 6, 1)).filter((_, i, l) => i % 2 === (l.length - 1) % 2)} fy={v => `${nf(v, 1)} mil M€`} yMin={0} alto={200} />
      {(() => {
        const y0 = años.find(y => d.porPais[y][clave]) ?? años[0], v0 = d.porPais[y0][clave]
        const rkE = Object.entries(d.porPais[a]).filter(([k]) => esPais(k)).sort((x, y) => y[1].exp - x[1].exp).findIndex(([k]) => k === clave) + 1
        const rkI = Object.entries(d.porPais[a]).filter(([k]) => esPais(k)).sort((x, y) => y[1].imp - x[1].imp).findIndex(([k]) => k === clave) + 1
        return <Curiosidades items={[
          <>Es el <b>{rkE}.º cliente</b> de España y su <b>{rkI}.º proveedor</b>.</>,
          v0 && v0.exp > 0 && y0 !== a && <>Desde {y0}, lo que le vendemos ha {s.exp >= v0.exp ? 'crecido' : 'caído'} un <b>{nf(Math.abs(s.exp / v0.exp - 1) * 100, 0)} %</b>.</>,
          <>Cada español le vendió de media {(s.exp / HAB).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} en {a}, y le compró {(s.imp / HAB).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}.</>,
        ]} />
      })()}
      <button className="cerrar" onClick={() => setSel(null)}>Quitar selección</button>
    </Card>}
    <Card t="Ranking" lead={`${f === 'exp' ? 'Clientes' : 'Proveedores'} de ${a}, de más a menos.`}>
      <Barras suma titulo="Ranking de países" fmt={meur} limite={15} items={datos.map(x => ({ id: x.pais, nombre: nombrePais(x.pais), valor: x.valor, color, sub: `${nf((x.valor / tot) * 100, 1)} %`, destacado: x.pais === clave, onClick: () => setSel(x.pais) }))} />
    </Card>
  </div>
}

function Productos({ d }: { d: Datos }) {
  const años = Object.keys(d.porProd).sort()
  const [a, setA] = useState(años.at(-1)!)
  const [f, setF] = useState<Flujo>('exp')
  const [fam, setFam] = useState<Familia | null>(null)
  const p = d.porProd[a], p0 = d.porProd[años[años.indexOf(a) - 1]]
  const items = Object.entries(p).map(([c, v]) => ({ c, v: v[f], antes: p0?.[c]?.[f] })).filter(x => x.v > 0 && (!fam || hs2(x.c).f === fam)).sort((x, y) => y.v - x.v)
  const tot = Object.values(p).reduce((s, v) => s + v[f], 0)
  const porFam = Object.entries(Object.entries(p).reduce<Record<string, number>>((m, [c, v]) => { const k = hs2(c).f; m[k] = (m[k] ?? 0) + v[f]; return m }, {})).sort((x, y) => y[1] - x[1])
  const crece = p0 ? Object.entries(p).filter(([c, v]) => (p0[c]?.[f] ?? 0) > 5e8 && v[f] > 5e8).map(([c, v]) => ({ c, r: v[f] / p0[c][f] - 1 })).sort((x, y) => y.r - x.r) : []
  const oliva = p['15']
  return <div className="graficos">
    <Card t={f === 'exp' ? 'Qué vende España' : 'Qué compra España'} wide lead={<>{a}: lo primero es <b>{hs2(items[0]?.c ?? '87').n.toLowerCase()}</b> ({nf(((items[0]?.v ?? 0) / tot) * 100, 1)} %).{crece[0] && <> Lo que más ha crecido sobre el año anterior: {hs2(crece[0].c).n.toLowerCase()} ({crece[0].r > 0 ? '+' : ''}{nf(crece[0].r * 100, 0)} %).</>}{f === 'exp' && oliva && <> Curiosidad: los aceites, sobre todo de oliva, suman {meur(oliva.exp)} en ventas.</>}</>}
      fuente={<>Eurostat, <a href={COMEXT} target="_blank" rel="noopener noreferrer">Comext DS-045409</a> · capítulos del Sistema Armonizado</>}>
      <div className="filtros">
        <Toggle v={f} set={x => setF(x)} label="Sentido" op={[['exp', 'Exportaciones'], ['imp', 'Importaciones']]} />
        <Toggle v={a} set={setA} label="Año" op={años.map(y => [y, y] as [string, string])} />
      </div>
      <div className="familias">{porFam.map(([k, v]) => <button key={k} className={fam === k ? 'is-on' : ''} style={{ ['--c' as string]: FAMILIAS[k as Familia].color }} onClick={() => setFam(fam === k ? null : k as Familia)}>
        <i style={{ width: `${(v / porFam[0][1]) * 100}%` }} /><span>{FAMILIAS[k as Familia].nombre}</span><b>{nf((v / tot) * 100, 0)} %</b>
      </button>)}</div>
    </Card>
    <Card t={fam ? FAMILIAS[fam].nombre : 'Los productos, uno a uno'} wide lead={fam ? 'Toca otra vez la familia para quitar el filtro.' : 'Capítulos del arancel, de más a menos. Entre paréntesis, el cambio frente al año anterior.'}>
      <Barras suma titulo="Productos" fmt={meur} limite={20} items={items.map(x => ({ id: x.c, nombre: hs2(x.c).n, valor: x.v, color: FAMILIAS[hs2(x.c).f].color, sub: x.antes ? `${x.v >= x.antes ? '+' : '−'}${nf(Math.abs(x.v / x.antes - 1) * 100, 0)} % sobre ${años[años.indexOf(a) - 1]}` : undefined }))} />
    </Card>
  </div>
}

function Balanza({ d }: { d: Datos }) {
  const años = Object.keys(d.porPais).sort(), a = años.at(-1)!
  const saldo = años.map(y => ({ y, v: (d.porPais[y].WORLD.exp - d.porPais[y].WORLD.imp) / 1e9 }))
  const paises = Object.entries(d.porPais[a]).filter(([k]) => esPais(k)).map(([k, v]) => ({ k, s: v.exp - v.imp })).sort((x, y) => y.s - x.s)
  const sup = paises.slice(0, 8), def = paises.slice(-8).reverse()
  const ue = d.porPais[a].INT_EU27_2020, fue = d.porPais[a].EXT_EU27_2020
  return <div className="graficos">
    <Card t="Compramos más de lo que vendemos" wide lead={<>España tiene déficit comercial de bienes casi todos los años: en {a}, <b>{nf(Math.abs(saldo.at(-1)!.v), 1)} mil millones de euros</b>. Con la Unión Europea el saldo es de {meur(ue.exp - ue.imp)}; con el resto del mundo, de {meur(fue.exp - fue.imp)}. Lo compensa el turismo y los servicios, que no entran aquí.</>}
      fuente={<>Eurostat, <a href={COMEXT} target="_blank" rel="noopener noreferrer">Comext DS-045409</a></>}>
      <Columnas titulo="Saldo comercial de bienes" items={saldo.map(x => ({ x: x.y, valor: x.v, color: x.v < 0 ? '#ff4d5e' : EXP }))} fmt={v => `${nf(v, 1)} mil M€`} etiqueta={c => nf(c.valor, 0)} />
    </Card>
    <Card t="Con quién ganamos" lead={`Países a los que España vende más de lo que les compra (${a}).`}>
      <Barras titulo="Mayores superávits" fmt={meur} items={sup.map(x => ({ id: x.k, nombre: nombrePais(x.k), valor: x.s, color: EXP }))} />
    </Card>
    <Card t="Con quién perdemos" lead={`Países a los que España compra más de lo que les vende (${a}). Suelen ser proveedores de energía o fábricas de Asia.`}>
      <Barras titulo="Mayores déficits" fmt={meur} items={def.map(x => ({ id: x.k, nombre: nombrePais(x.k), valor: Math.abs(x.s), color: '#ff4d5e' }))} />
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<Datos | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/comercio.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Globe2 size={28} /><p>Cargando las rutas…</p></main>
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Comercio</h1>
          <p>Lo que España vende y compra al mundo · {Object.keys(d.porPais).sort()[0]}–{Object.keys(d.porPais).sort().at(-1)}</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <Resumen d={d} go={go} />}
        {sec === 'paises' && <Paises d={d} />}
        {sec === 'productos' && <Productos d={d} />}
        {sec === 'balanza' && <Balanza d={d} />}
      </motion.div>
      <Fuentes ids={['eurostat']} extra={[{ n: 'Comext (comercio exterior de la UE)', u: COMEXT }, { n: 'DataComex (Ministerio de Economía)', u: 'https://comercio.serviciosmin.gob.es/Datacomex/' }]} />
      <p className="src">Comercio de bienes: no incluye servicios ni turismo. Datos anuales en euros corrientes; el robot los actualiza cada semana. Mapa: Natural Earth.</p>
    </main>
  )
}
