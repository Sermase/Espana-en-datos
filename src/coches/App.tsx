import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { BatteryCharging, Car, Gauge, Map as MapIcon, Trophy } from 'lucide-react'
import { Apiladas, Barras, ColApiladas, CountUp, LineChart, nf, type Capa } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { coche } from '../holo3d/modelos'
import { MapaProvincias } from '../geo/MapaProvincias'
import { PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'

const ACC = '#5df0d0'
type Mes = { n: number; u: number; comb: Record<string, number>; combU: Record<string, number>; marcas: Record<string, number>; prov: Record<string, Record<string, number>>; co2: number | null; kw: number | null; renting: number; empresa: number; edadU: number | null }
type M = { fecha: string; meses: Record<string, Mes> }
type Geo = Record<string, Record<string, Record<string, number>>>
type P = { fecha: string; combustible?: Geo; edad?: Geo; nuevosUE?: Geo; porHabitante?: Geo }
const SECCIONES = [
  { id: 'ventas', nombre: 'Matriculaciones', icon: Car },
  { id: 'marcas', nombre: 'Marcas', icon: Trophy },
  { id: 'mapa', nombre: 'Por provincia', icon: MapIcon },
  { id: 'parque', nombre: 'El parque', icon: Gauge },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/** Combustibles en el orden del apilado, con la paleta categórica validada para el fondo oscuro. */
const COMB = [
  { id: 'electrico', n: 'Eléctrico', c: '#3987e5' },
  { id: 'enchufable', n: 'Híbrido enchufable', c: '#c98500' },
  { id: 'hibrido', n: 'Híbrido', c: '#199e70' },
  { id: 'gasolina', n: 'Gasolina', c: '#d95926' },
  { id: 'diesel', n: 'Diésel', c: '#9085e9' },
  { id: 'glp', n: 'GLP', c: '#d55181' },
  { id: 'otros', n: 'Gas, hidrógeno y otros', c: '#6b7d86' },
]
const grupo = (k: string) => (['gas', 'hidrogeno', 'otros'].includes(k) ? 'otros' : k)
const combDe = (m: Record<string, number> = {}) => { const o: Record<string, number> = {}; for (const [k, v] of Object.entries(m)) o[grupo(k)] = (o[grupo(k)] ?? 0) + v; return o }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const nombreMes = (k: string) => `${MESES[+k.slice(5) - 1]} de ${k.slice(0, 4)}`
const pct = (a: number, b: number) => ((a - b) / b) * 100
const masMenos = (v: number, d = 0) => `${nf(Math.abs(v), d)} % ${v >= 0 ? 'más' : 'menos'}`
const signo = (v: number, d = Math.abs(v) < 1 ? 1 : 0) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${nf(Math.abs(v), d)} %`
/** «VOLKSWAGEN» → «Volkswagen», «MERCEDES-BENZ» → «Mercedes-Benz»; las siglas cortas se quedan como están. */
const marca = (s: string) => s === '(otras)' ? 'Otras marcas' : s.split(/([ -])/).map(p => (p.length <= 3 && /^[A-Z]+$/.test(p) && !['KIA', 'SEAT'].includes(p) ? p : p.charAt(0) + p.slice(1).toLowerCase())).join('')

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const DGT = <a href="https://www.dgt.es/menusecundario/dgt-en-cifras/matraba-listados/" target="_blank" rel="noopener noreferrer">DGT, microdatos de matriculaciones</a>
const EUROSTAT = <a href="https://ec.europa.eu/eurostat/databrowser/view/road_eqs_carpda/default/table" target="_blank" rel="noopener noreferrer">Eurostat, parque de turismos</a>

/** Suma de los meses de cada año (solo años completos, salvo el último, que se marca). */
function porAño(m: M) {
  const años: Record<string, { n: number; comb: Record<string, number>; marcas: Record<string, number>; prov: Record<string, Record<string, number>>; meses: number; u: number; co2: [number, number] }> = {}
  for (const [k, v] of Object.entries(m.meses)) {
    const a = (años[k.slice(0, 4)] ??= { n: 0, comb: {}, marcas: {}, prov: {}, meses: 0, u: 0, co2: [0, 0] })
    a.n += v.n; a.u += v.u; a.meses++
    for (const [c, x] of Object.entries(combDe(v.comb))) a.comb[c] = (a.comb[c] ?? 0) + x
    for (const [c, x] of Object.entries(v.marcas)) a.marcas[c] = (a.marcas[c] ?? 0) + x
    for (const [p, cs] of Object.entries(v.prov)) for (const [c, x] of Object.entries(combDe(cs))) { const o = (a.prov[p] ??= {}); o[c] = (o[c] ?? 0) + x }
    if (v.co2) { a.co2[0] += v.co2 * v.n; a.co2[1] += v.n }
  }
  return años
}
/** Últimos 12 meses frente a los 12 anteriores. */
function ventana(m: M, desde: number, n = 12) {
  const ks = Object.keys(m.meses).sort().slice(desde - n, desde || undefined)
  const o = { n: 0, comb: {} as Record<string, number>, marcas: {} as Record<string, number>, prov: {} as Record<string, Record<string, number>>, ks }
  for (const k of ks) { const v = m.meses[k]; o.n += v.n; for (const [c, x] of Object.entries(combDe(v.comb))) o.comb[c] = (o.comb[c] ?? 0) + x; for (const [c, x] of Object.entries(v.marcas)) o.marcas[c] = (o.marcas[c] ?? 0) + x; for (const [p, cs] of Object.entries(v.prov)) for (const [c, x] of Object.entries(combDe(cs))) { const q = (o.prov[p] ??= {}); q[c] = (q[c] ?? 0) + x } }
  return o
}

function Ventas({ m }: { m: M }) {
  const ks = Object.keys(m.meses).sort(), K = ks.at(-1)!
  const a12 = ventana(m, 0), p12 = ventana(m, -12)
  const ench = (o: { comb: Record<string, number>; n: number }) => (((o.comb.electrico ?? 0) + (o.comb.enchufable ?? 0)) / (o.n || 1)) * 100
  const modelo = useMemo(() => coche(Math.min(1, ench(a12) / 40)), [K])
  const lista = COMB.map(c => ({ ...c, v: a12.comb[c.id] ?? 0 })).filter(c => c.v > 0).sort((a, b) => b.v - a.v)
  // reparto mensual (en porcentaje) y matriculaciones por año
  const capas: Capa[] = COMB.map(c => ({ id: c.id, nombre: c.n, color: c.c, v: ks.map(k => combDe(m.meses[k].comb)[c.id] ?? 0) }))
  const xs = ks.map(k => +k.slice(0, 4) + (+k.slice(5) - 1) / 12)
  const A = porAño(m), años = Object.keys(A).sort().filter(a => A[a].meses === 12 || a === K.slice(0, 4))
  const dieselMax = años.reduce((b, a) => ((A[a].comb.diesel ?? 0) / A[a].n > (A[b].comb.diesel ?? 0) / A[b].n ? a : b), años[0])
  const ultC = años.at(-1)!, ultCompleto = años.filter(a => A[a].meses === 12).at(-1)!
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={modelo} color={ACC} alto={250} giro={0.16} etiqueta={`Coche de alambre: más chispas en el cable de carga cuanto más se venden eléctricos y enchufables`} />
        <div className="sala-dato">
          <span className="sala-k">Turismos nuevos, últimos 12 meses (hasta {nombreMes(K)})</span>
          <b><CountUp value={a12.n} fmt={v => nf(v, 0)} /></b>
          <span>Un {masMenos(pct(a12.n, p12.n), 1)} que en los 12 meses anteriores.</span>
          <span><b>{nf(ench(a12), 1)} %</b> son eléctricos o híbridos enchufables (hace un año, {nf(ench(p12), 1)} %).</span>
        </div>
      </div>
      <ul className="sala-lista" aria-label="Turismos nuevos por combustible, últimos 12 meses">{lista.map(c => <li key={c.id} style={{ '--c': c.c } as CSSProperties}><i /><span>{c.n}</span><b>{nf((c.v / a12.n) * 100, 1)} %</b><em style={{ width: `${(c.v / lista[0].v) * 100}%` }} /></li>)}</ul>
    </section>
    <Card wide t="Del diésel al enchufe" lead={<>En {dieselMax}, el diésel se llevó el <b>{nf(((A[dieselMax].comb.diesel ?? 0) / A[dieselMax].n) * 100, 0)} %</b> de los turismos nuevos; en {ultCompleto}, el {nf(((A[ultCompleto].comb.diesel ?? 0) / A[ultCompleto].n) * 100, 0)} %. Hoy el más vendido es el {minus(lista[0].n)} ({nf((lista[0].v / a12.n) * 100, 0)} % en los últimos 12 meses).{(A[ultCompleto].comb.electrico ?? 0) > (A[ultCompleto].comb.diesel ?? 0) ? ` En ${ultCompleto} ya se vendieron más eléctricos que diésel.` : ''}</>} fuente={DGT}>
      <Apiladas xs={xs} capas={capas} pct titulo="Turismos nuevos por combustible, cada mes" fx={x => nombreMes(`${Math.floor(x)}-${String(Math.round((x % 1) * 12) + 1).padStart(2, '0')}`)} fxEje={x => String(Math.floor(x))} ticksX={años.map(Number)} fy={v => `${nf(v, 0)} %`} alto={300} />
    </Card>
    <Card wide t="Cuántos se venden" lead={<>En {ultCompleto} se matricularon {nf(A[ultCompleto].n, 0)} turismos nuevos{A['2019'] ? <>, un {masMenos(pct(A[ultCompleto].n, A['2019'].n))} que en 2019, antes de la pandemia</> : null}.{A[ultC].meses < 12 ? ` ${ultC}: hasta ${MESES[A[ultC].meses - 1]}.` : ''}</>}>
      <ColApiladas xs={años.map(a => (A[a].meses < 12 ? `${a}*` : a))} tramos={COMB.map(c => ({ id: c.id, nombre: c.n, color: c.c, v: años.map(a => A[a].comb[c.id] ?? 0) }))} titulo="Turismos nuevos por año y combustible" fy={v => nf(v, 0)} alto={240} />
      <p className="note">Turismos (categoría M1) matriculados nuevos en España. No incluye los usados importados{años.length ? `: en ${ultCompleto}, otros ${nf(A[ultCompleto].u, 0)}` : ''}.</p>
    </Card>
  </div>
}

type Mods = Record<string, Record<string, [number, number]>>
/** Modelos de un año (o de varios meses): «MARCA|MODELO» → [turismos, de ellos eléctricos o enchufables]. */
function modelosDe(mods: Mods, filtro: (k: string) => boolean) {
  const o: Record<string, [number, number]> = {}
  for (const [k, mm] of Object.entries(mods)) if (filtro(k)) for (const [x, [n, e]] of Object.entries(mm)) { const t = (o[x] ??= [0, 0]); t[0] += n; t[1] += e }
  return Object.entries(o).sort((x, y) => y[1][0] - x[1][0])
}
const nombreModelo = (k: string) => { const [ma, mo] = k.split('|'); return { marca: marca(ma), modelo: mo.split(' ').map(w => (/\d/.test(w) || w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ') } }
const COL6 = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9']

function Marcas({ m }: { m: M }) {
  const A = porAño(m), años = Object.keys(A).sort().filter(a => A[a].meses === 12)
  const [a, setA] = useState(años.at(-1)!), [sel, setSel] = useState<string | null>(null), [mods, setMods] = useState<Mods | null>(null), [q, setQ] = useState('')
  useEffect(() => { fetch('./data/modelos.json').then(r => (r.ok ? r.json() : null)).then(j => setMods(j?.meses ?? {}), () => setMods({})) }, [])
  const ant = String(+a - 1), tot = A[a].n
  const todas = Object.entries(A[a].marcas).filter(([k]) => k !== '(otras)').sort((x, y) => y[1] - x[1])
  const top = todas
  const sube = todas.filter(([k, v]) => v >= 1000 && A[ant]?.marcas[k]).map(([k, v]) => ({ k, v: pct(v, A[ant].marcas[k]) })).sort((x, y) => y.v - x.v)
  // cuota año a año: las seis primeras del último año, más la marca elegida
  const ultimo = años.at(-1)!
  const seis = Object.entries(A[ultimo].marcas).filter(([k]) => k !== '(otras)').sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k]) => k)
  const enLinea = sel && !seis.includes(sel) ? [...seis, sel] : seis
  const modsAño = mods ? modelosDe(mods, k => k.startsWith(a)) : []
  const deMarca = sel ? modsAño.filter(([k]) => k.startsWith(sel + '|')) : []
  const buscadas = q.length >= 2 ? Object.keys(A[ultimo].marcas).concat(Object.keys(A[a].marcas)).filter((k, i, arr) => arr.indexOf(k) === i && k !== '(otras)' && marca(k).toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
  const eligeMarca = (k: string) => { setSel(sel === k ? null : k); setQ('') }
  return <div className="graficos">
    <Card wide t={`Las marcas más vendidas en ${a}`} lead={top[0] ? <><b>{marca(top[0][0])}</b> fue la marca más matriculada, con {nf(top[0][1], 0)} turismos nuevos ({nf((top[0][1] / tot) * 100, 1)} %). Las diez primeras se llevan el {nf((top.slice(0, 10).reduce((t, x) => t + x[1], 0) / tot) * 100, 0)} % del mercado; en total se vendieron {todas.length} marcas. Toca una para ver sus modelos.</> : null} fuente={DGT}>
      <div className="modo" role="radiogroup" aria-label="Año">{años.map(y => <button key={y} role="radio" aria-checked={a === y} className={a === y ? 'is-on' : ''} onClick={() => setA(y)}>{y}</button>)}</div>
      <div className="buscar-marca"><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar una marca…" aria-label="Buscar una marca" />
        {buscadas.length > 0 && <ul>{buscadas.map(k => <li key={k}><button onClick={() => eligeMarca(k)}>{marca(k)}</button></li>)}</ul>}</div>
      <Barras titulo={`Turismos nuevos por marca, ${a}`} limite={15} fmt={v => nf(v, 0)} items={top.map(([k, v]) => ({ id: k, nombre: marca(k), sub: A[ant]?.marcas[k] ? signo(pct(v, A[ant].marcas[k])) + ` que en ${ant}` : 'nueva', valor: v, color: ACC, destacado: k === sel, onClick: () => eligeMarca(k) }))} />
    </Card>
    {sel && <Card wide t={`${marca(sel)}`} lead={<>{A[a].marcas[sel] ? <>En {a} vendió {nf(A[a].marcas[sel], 0)} turismos nuevos, el {nf((A[a].marcas[sel] / tot) * 100, 1)} % del mercado (puesto {todas.findIndex(([k]) => k === sel) + 1}).</> : <>En {a} no vendió turismos nuevos.</>}{deMarca.length ? <> El {nf((deMarca.reduce((t, [, v]) => t + v[1], 0) / Math.max(1, deMarca.reduce((t, [, v]) => t + v[0], 0))) * 100, 0)} % de sus ventas fueron eléctricos o enchufables.</> : null}</>}>
      <button className="cerrar-marca" onClick={() => setSel(null)}>Cerrar</button>
      <div className="mapa-dos">
        <LineChart titulo={`Turismos nuevos de ${marca(sel)} por año`} alto={220} fx={x => String(x)} fy={v => nf(v, 0)} series={[{ id: sel, nombre: marca(sel), color: ACC, area: true, datos: años.map(y => [+y, A[y].marcas[sel] ?? 0] as [number, number]) }]} />
        {mods == null ? <p className="note">Cargando modelos…</p> : deMarca.length ? <Barras titulo={`Modelos de ${marca(sel)} en ${a}`} limite={10} fmt={v => nf(v, 0)} items={deMarca.map(([k, [n, e]]) => ({ id: k, nombre: nombreModelo(k).modelo, sub: e ? `${nf((e / n) * 100, 0)} % eléctrico o enchufable` : undefined, valor: n, color: e / n > 0.5 ? '#3987e5' : ACC }))} /> : <p className="note">Sin modelos con ventas ese año.</p>}
      </div>
    </Card>}
    <Card wide t={`Los modelos más vendidos en ${a}`} lead={modsAño[0] ? <>El <b>{nombreModelo(modsAño[0][0]).marca} {nombreModelo(modsAño[0][0]).modelo}</b> fue el turismo más vendido, con {nf(modsAño[0][1][0], 0)} unidades. En azul, los que venden más de la mitad en versión eléctrica o enchufable.</> : mods == null ? 'Cargando modelos…' : 'Aún no hay modelos para este año.'} fuente={DGT}>
      {modsAño.length > 0 && <Barras titulo={`Modelos más vendidos, ${a}`} limite={20} fmt={v => nf(v, 0)} items={modsAño.slice(0, 100).map(([k, [n, e]]) => { const x = nombreModelo(k); return { id: k, nombre: `${x.marca} ${x.modelo}`, sub: e ? `${nf((e / n) * 100, 0)} % enchufable` : undefined, valor: n, color: e / n > 0.5 ? '#3987e5' : ACC, onClick: () => eligeMarca(k.split('|')[0]) } })} />}
      <p className="note">Modelo según el nombre de la ficha técnica que registra la DGT; algunas variantes pueden salir aparte.</p>
    </Card>
    {sube.length > 3 && <Card t={`Las que más crecen en ${a}`} lead={`Marcas con más de 1.000 turismos vendidos, frente a ${ant}.`}>
      <Barras titulo={`Cambio de ventas por marca, ${a} frente a ${ant}`} limite={8} fmt={v => signo(v)} items={sube.map(x => ({ id: x.k, nombre: marca(x.k), valor: x.v, color: x.v >= 0 ? '#3df5b0' : '#ff8a95', onClick: () => eligeMarca(x.k) }))} />
    </Card>}
    {sube.length > 3 && <Card t={`Las que más caen en ${a}`} lead="Mismas marcas, las de peor año.">
      <Barras titulo={`Caída de ventas por marca, ${a} frente a ${ant}`} limite={8} fmt={v => signo(v)} items={[...sube].reverse().map(x => ({ id: x.k, nombre: marca(x.k), valor: x.v, color: x.v >= 0 ? '#3df5b0' : '#ff8a95', onClick: () => eligeMarca(x.k) }))} />
    </Card>}
    <Card wide t="Cuota de mercado, año a año" lead={<>Las seis marcas que más vendieron en {ultimo}{sel && !seis.includes(sel) ? <> y {marca(sel)}</> : null}. Toca una etiqueta para ocultarla; doble toque para ver solo esa.</>}>
      <LineChart titulo="Cuota de mercado por marca" alto={260} fx={x => String(x)} fy={v => `${nf(v, 1)} %`} series={enLinea.map((k, i) => ({ id: k, nombre: marca(k), color: i < 6 ? COL6[i] : ACC, datos: años.map(y => [+y, ((A[y].marcas[k] ?? 0) / A[y].n) * 100] as [number, number]) }))} />
    </Card>
  </div>
}

function Mapa({ m }: { m: M }) {
  const a12 = ventana(m, 0), K = a12.ks.at(-1)!
  const [c, setC] = useState('enchufe'), [sel, setSel] = useState<string | null>(null)
  const val = (p: string) => { const o = a12.prov[p]; if (!o) return null; const t = Object.values(o).reduce((x, y) => x + y, 0); if (t < 200) return null; const v = c === 'enchufe' ? (o.electrico ?? 0) + (o.enchufable ?? 0) : o[c] ?? 0; return (v / t) * 100 }
  const orden = Object.keys(PROV).map(p => ({ p, v: val(p) })).filter((x): x is { p: string; v: number } => x.v != null).sort((x, y) => y.v - x.v)
  const CH = [['enchufe', 'Eléctricos y enchufables', '#3987e5'], ['electrico', 'Eléctricos', '#3987e5'], ['hibrido', 'Híbridos', '#199e70'], ['gasolina', 'Gasolina', '#d95926'], ['diesel', 'Diésel', '#9085e9']] as const
  const info = CH.find(x => x[0] === c)!
  return <div className="graficos">
    <Card wide t="Qué se compra en cada provincia" lead={orden.length ? <>En los últimos 12 meses, {PROV[orden[0].p]} es donde más pesan los {minus(info[1])} entre los turismos nuevos ({nf(orden[0].v, 1)} %); {PROV[orden.at(-1)!.p]}, donde menos ({nf(orden.at(-1)!.v, 1)} %).</> : null} fuente={DGT}>
      <div className="chips" role="radiogroup" aria-label="Combustible">{CH.map(([k, n, col]) => <button key={k} role="radio" aria-checked={c === k} className={c === k ? 'is-on' : ''} style={{ '--c': col } as CSSProperties} onClick={() => setC(k)}><i />{n}</button>)}</div>
      <div className="mapa-dos">
        <MapaProvincias valor={val} fmt={v => `${nf(v, 1)} %`} titulo={`${info[1]}: porcentaje de los turismos nuevos, hasta ${nombreMes(K)}`} color={info[2]} sel={sel} onSel={setSel}
          nota={sel ? `${PROV[sel]}: ${nf(val(sel) ?? 0, 1)} % de ${nf(Object.values(a12.prov[sel] ?? {}).reduce((x, y) => x + y, 0), 0)} turismos nuevos` : 'Provincia del domicilio del vehículo. Las empresas de alquiler y renting matriculan muchos coches en su sede, lo que sube a Madrid y a otras provincias con flotas.'} />
        <Barras titulo={`Provincias con más ${minus(info[1])}`} limite={10} fmt={v => `${nf(v, 1)} %`} items={orden.slice(0, 10).map(x => ({ id: x.p, nombre: PROV[x.p], valor: x.v, color: info[2], destacado: x.p === sel, onClick: () => setSel(x.p) }))} />
      </div>
    </Card>
  </div>
}
const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function Parque({ p, m }: { p: P; m: M }) {
  const C = p.combustible?.ES ?? {}, años = Object.keys(C.TOTAL ?? {}).sort().filter(a => C.PET?.[a] != null && C.DIE?.[a] != null), A = años.at(-1)
  const s = (k: string, a: string) => C[k]?.[a] ?? 0
  const capasC = (a: string) => ({
    electrico: s('ELC', a), enchufable: s('ELC_PET_PI', a) + s('ELC_DIE_PI', a), hibrido: s('ELC_PET_HYB', a) + s('ELC_DIE_HYB', a),
    gasolina: C.PET_X_HYB ? s('PET_X_HYB', a) : s('PET', a) - s('ELC_PET_HYB', a) - s('ELC_PET_PI', a), diesel: C.DIE_X_HYB ? s('DIE_X_HYB', a) : s('DIE', a) - s('ELC_DIE_HYB', a) - s('ELC_DIE_PI', a), glp: s('LPG', a),
  })
  const otros = (a: string) => Math.max(0, s('TOTAL', a) - Object.values(capasC(a)).reduce((x, y) => x + y, 0))
  const E = p.edad?.ES ?? {}, añosE = Object.keys(E.TOTAL ?? {}).sort().filter(a => ['Y_LT2', 'Y2-5', 'Y5-10', 'Y10-20', 'Y_GT20'].every(k => E[k]?.[a] != null)), AE = añosE.at(-1)
  const EDADES = [['Y_LT2', 'Menos de 2 años', 1], ['Y2-5', 'De 2 a 5', 3.5], ['Y5-10', 'De 5 a 10', 7.5], ['Y10-20', 'De 10 a 20', 15], ['Y_GT20', 'Más de 20', 25]] as const
  const media = (geo: Geo[string] | undefined, a: string) => { if (!geo) return null; const t = EDADES.reduce((x, [k]) => x + (geo[k]?.[a] ?? 0), 0); return t ? EDADES.reduce((x, [k, , mid]) => x + (geo[k]?.[a] ?? 0) * mid, 0) / t : null }
  const viejos = (geo: Geo[string] | undefined, a: string) => geo?.Y_GT20?.[a] && geo.TOTAL?.[a] ? (geo.Y_GT20[a] / geo.TOTAL[a]) * 100 : null
  const PAIS: Record<string, string> = { ES: 'España', EU27_2020: 'UE', DE: 'Alemania', FR: 'Francia', IT: 'Italia', PT: 'Portugal' }
  const H = p.porHabitante ?? {}
  const ks = Object.keys(m.meses).sort(), edadU = ks.slice(-12).map(k => m.meses[k].edadU).filter((x): x is number => x != null)
  const usados = ks.slice(-12).reduce((t, k) => t + m.meses[k].u, 0)
  return <div className="graficos">
    {A && <Card wide t={`Los ${nf(s('TOTAL', A) / 1e6, 1)} millones de turismos, ${A}`} lead={<>Todos los turismos en circulación. Eléctricos y enchufables son el {nf(((capasC(A).electrico + capasC(A).enchufable) / s('TOTAL', A)) * 100, 1)} % del parque; el diésel, el {nf((capasC(A).diesel / s('TOTAL', A)) * 100, 0)} %.</>} fuente={EUROSTAT}>
      <Apiladas xs={años.map(Number)} capas={[...COMB.slice(0, 6).map(c => ({ id: c.id, nombre: c.n, color: c.c, v: años.map(a => (capasC(a) as Record<string, number>)[c.id] / 1e6) })), { id: 'otros', nombre: COMB[6].n, color: COMB[6].c, v: años.map(a => otros(a) / 1e6) }]} titulo="Parque de turismos por combustible" fx={a => String(a)} fy={v => `${nf(v, 1)} M`} alto={260} />
      <p className="note">Eurostat no separa los híbridos en todos los años; cuando no lo hace, van con su combustible.</p>
    </Card>}
    {AE && <Card wide t="Cada vez más viejos" lead={<>En {AE}, el <b>{nf(viejos(E, AE) ?? 0, 0)} %</b> de los turismos españoles tiene más de 20 años (en {añosE[0]}, el {nf(viejos(E, añosE[0]) ?? 0, 0)} %). La edad media ronda los {nf(media(E, AE) ?? 0, 0)} años.</>} fuente={<a href="https://ec.europa.eu/eurostat/databrowser/view/road_eqs_carage/default/table" target="_blank" rel="noopener noreferrer">Eurostat, turismos por edad</a>}>
      <Apiladas xs={añosE.map(Number)} capas={EDADES.map(([k, n], i) => ({ id: k, nombre: n, color: ['#3987e5', '#199e70', '#c98500', '#d95926', '#d55181'][i], v: añosE.map(a => E[k]?.[a] ?? 0) }))} pct titulo="Turismos por antigüedad" fx={a => String(a)} fy={v => `${nf(v, 0)} %`} alto={240} />
      <p className="note">Edad media aproximada, calculada con el punto medio de cada tramo (25 años para los de más de 20).</p>
    </Card>}
    {AE && <Card t="Frente a Europa" lead="Porcentaje de turismos con más de 20 años.">
      <Barras titulo={`Turismos con más de 20 años, ${AE}`} fmt={v => `${nf(v, 0)} %`} items={Object.keys(PAIS).map(g => ({ id: g, nombre: PAIS[g], valor: viejos(p.edad?.[g], AE) ?? 0, color: g === 'ES' ? ACC : '#5f7480', destacado: g === 'ES' })).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor)} />
    </Card>}
    {Object.keys(H).length > 0 && <Card t="Coches por cada 1.000 habitantes" lead="Turismos en circulación por cada mil personas.">
      <Barras titulo="Turismos por cada 1.000 habitantes" fmt={v => nf(v, 0)} items={Object.keys(PAIS).map(g => { const o = H[g]?.total ?? {}, y = Object.keys(o).sort().at(-1); return { id: g, nombre: `${PAIS[g]}${y ? ` (${y})` : ''}`, valor: y ? o[y] : 0, color: g === 'ES' ? ACC : '#5f7480', destacado: g === 'ES' } }).filter(x => x.valor > 0).sort((x, y) => y.valor - x.valor)} />
    </Card>}
    {usados > 0 && <Card wide t="Los usados que llegan de fuera" lead={<>En los últimos 12 meses se matricularon {nf(usados, 0)} turismos usados importados{edadU.length ? <>, con una edad media de <b>{nf(edadU.reduce((x, y) => x + y, 0) / edadU.length, 1)} años</b></> : null}.</>} fuente={DGT}>
      <p className="note">Coches que ya habían circulado en otro país y se matriculan por primera vez en España.</p>
    </Card>}
  </div>
}

export default function App() {
  const [m, setM] = useState<M | null>(null), [p, setP] = useState<P | null>(null), [err, setErr] = useState(false)
  useEffect(() => {
    fetch('./data/matriculaciones.json').then(r => r.json()).then(setM, () => setErr(true))
    fetch('./data/parque.json').then(r => (r.ok ? r.json() : { fecha: '' })).then((x: P) => setP(x), () => setP({ fecha: '' }))
  }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'ventas')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!m || !p) return <main className="eco boot"><BatteryCharging size={28} /><p>Arrancando…</p></main>
  const ks = Object.keys(m.meses).sort(), A = porAño(m), años = Object.keys(A).sort().filter(a => A[a].meses === 12), ua = años.at(-1)!
  const top = Object.entries(A[ua]?.marcas ?? {}).filter(([k]) => k !== '(otras)').sort((x, y) => y[1] - x[1])[0]
  const co2 = años.map(a => (A[a].co2[1] ? A[a].co2[0] / A[a].co2[1] : null))
  const k12 = ks.slice(-12), rent = k12.reduce((t, k) => t + m.meses[k].renting, 0), emp = k12.reduce((t, k) => t + m.meses[k].empresa, 0), n12 = k12.reduce((t, k) => t + m.meses[k].n, 0)
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Coches</h1>
          <p>Matriculaciones, marcas, combustibles y el parque de turismos · DGT y Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'ventas' && <Ventas m={m} />}
        {sec === 'marcas' && <Marcas m={m} />}
        {sec === 'mapa' && <Mapa m={m} />}
        {sec === 'parque' && <Parque p={p} m={m} />}
      </motion.div>
      <Curiosidades titulo="¿Sabías que…?" items={[
        top ? <>En {ua}, la marca más vendida fue <b>{marca(top[0])}</b>: {nf(top[1], 0)} turismos, uno de cada {nf(A[ua].n / top[1], 0)}.</> : null,
        co2[0] && co2.at(-1) ? <>Un turismo nuevo de {ua} emite de media <b>{nf(co2.at(-1)!, 0)} g de CO₂/km</b> según su homologación; en {años[0]}, {nf(co2[0], 0)} g. Ojo: en 2018 cambió la prueba de homologación (WLTP), más exigente.</> : null,
        n12 ? <>El {nf((emp / n12) * 100, 0)} % de los turismos nuevos de los últimos 12 meses lo matriculó una empresa, y el {nf((rent / n12) * 100, 0)} % va a renting.</> : null,
      ]} />
      <Fuentes ids={[]} extra={[{ n: 'DGT · Microdatos de matriculaciones', u: 'https://www.dgt.es/menusecundario/dgt-en-cifras/matraba-listados/' }, { n: 'Eurostat · Turismos por combustible (road_eqs_carpda)', u: 'https://ec.europa.eu/eurostat/databrowser/view/road_eqs_carpda/default/table' }, { n: 'Eurostat · Turismos por edad (road_eqs_carage)', u: 'https://ec.europa.eu/eurostat/databrowser/view/road_eqs_carage/default/table' }]} />
      <p className="src">Matriculaciones: turismos (categoría M1) nuevos, según el registro de la DGT; cada mes se suma cuando la DGT publica su fichero. Datos de {m.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
