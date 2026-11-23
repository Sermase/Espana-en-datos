import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Activity, ArrowLeftRight, ChevronLeft, ChevronRight, CloudFog, Euro, Factory, Flame, Gauge, Zap } from 'lucide-react'
import { Fronteras, GasPetroleo, Ire, Sectores, useExtra } from './Extra'
import { Apiladas, Barras, Columnas, CountUp, LineChart, nf } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { eolica, hidraulica, nuclear, red, solar, termica } from '../holo3d/modelos'
import { A, Fuentes } from '../Fuentes'
import { Precios as PreciosV2 } from './Precios'
import { TEC, agrupar, agruparTR, dia as diaEs, tiempoReal, type FilaTR, fDia, fHora, fMes, tLocal, useEnergia, useVivo, type Grupo, type Hoy, type Historia, type Tec } from './datos'

const ACC = '#ffb02e'
const SECCIONES = [
  { id: 'ahora', nombre: 'Ahora', icon: Gauge },
  { id: 'generacion', nombre: 'Generación', icon: Factory },
  { id: 'demanda', nombre: 'Demanda', icon: Activity },
  { id: 'precios', nombre: 'Precios', icon: Euro },
  { id: 'fronteras', nombre: 'Fronteras', icon: ArrowLeftRight },
  { id: 'gas', nombre: 'Gas y petróleo', icon: Flame },
  { id: 'emisiones', nombre: 'Emisiones', icon: CloudFog },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/** Marcas del eje en horas en punto, cada `cada` horas, a partir del día de `t`. */
const horas = (t: number, cada: number) => { const d0 = Math.floor(t / 864e5) * 864e5; return Array.from({ length: Math.floor(24 / cada) }, (_, i) => d0 + (i + 1) * cada * 3600e3).filter(x => x < d0 + 864e5) }
const gwh = (mwh: number) => Math.abs(mwh) >= 1e6 ? `${nf(mwh / 1e6, 1)} TWh` : `${nf(mwh / 1e3, 0)} GWh`
const pct = (f: number, d = 0) => `${nf(f * 100, d)} %`
const sv = (g: Grupo | null | undefined, k: string) => g?.[k]?.v ?? []

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}

/** Hora del día en España (0–24) para colocar el sol del holograma. */
const horaEs = () => { const p = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()); return Number(p.find(x => x.type === 'hour')?.value) + Number(p.find(x => x.type === 'minute')?.value) / 60 }

function modelo(t: Tec, uso: number) {
  switch (t) {
    case 'eolica': return eolica(uso)
    case 'solar': return solar(Math.max(0, Math.sin(((horaEs() - 7) / 12) * Math.PI)))
    case 'hidraulica': return hidraulica(uso)
    case 'nuclear': return nuclear()
    case 'ciclo': return termica(1, uso)
    case 'cogeneracion': return termica(1, uso * 0.6)
    case 'carbon': return termica(2, uso)
    default: return red(uso)
  }
}

/** La sala: holograma de la tecnología elegida y lo que aportó en los últimos 30 días. */
/** La sala: holograma de la tecnología elegida. Con la generación cada 10 minutos si REE la da; si no, la del último día. */
function Sala({ hoy, tec, setTec }: { hoy: Hoy; tec: Tec | null; setTec: (t: Tec) => void }) {
  const tr = useMemo(() => agruparTR(hoy.tr), [hoy.tr])
  const dia = useMemo(() => agrupar(hoy.mix30), [hoy.mix30])
  const ag = tr ?? dia
  if (!ag) return null
  const n = ag.xs.length, tot = ag.capas.reduce((s, c) => s + c.v[n - 1], 0)
  const ranking = ag.capas.filter(x => x.v[n - 1] > 0 || x.id === tec).sort((a, b) => b.v[n - 1] - a.v[n - 1])
  const c = ag.capas.find(x => x.id === tec) ?? ranking[0] // sin elegir: la que más aporta ahora
  const ult = c.v[n - 1] ?? 0, max = Math.max(...c.v), uso = max ? ult / max : 0.5
  const pos = ranking.findIndex(x => x.id === c.id) + 1
  const pico = c.v.indexOf(max)
  return (
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D key={c.id} modelo={modelo(c.id, uso)} color={c.color} alto={250} etiqueta={`Holograma: ${c.nombre}`} />
        <div className="sala-dato">
          <span className="sala-k">{c.nombre} · {tr ? `ahora, ${fHora(ag.xs[n - 1])}` : fDia(ag.xs[n - 1])}</span>
          <b>{tr ? <CountUp value={ult} fmt={v => `${nf(v)} MW`} /> : <CountUp value={ult / 1e3} fmt={v => `${nf(v)} GWh`} />}</b>
          <span>{pct(tot ? ult / tot : 0, 1)} de lo que se genera{tr ? ' en este momento' : ' ese día'}, {pos === 1 ? 'la primera fuente' : `la ${pos}.ª fuente`}.{tr && max > 0 && pico !== n - 1 && <> Hoy llegó a {nf(max)} MW a las {fHora(ag.xs[pico])}.</>}</span>
        </div>
      </div>
      <div className="sala-tecs" role="radiogroup" aria-label="Tecnología del holograma">
        {ranking.map(x => <button key={x.id} role="radio" aria-checked={x.id === c.id} className={x.id === c.id ? 'is-on' : ''} onClick={() => setTec(x.id)} style={{ ['--c' as string]: x.color }}>
          <i />{x.nombre}<small>{pct(tot ? x.v[n - 1] / tot : 0)}</small>
        </button>)}
      </div>
    </section>
  )
}

function Kpis({ hoy }: { hoy: Hoy }) {
  const real = sv(hoy.demanda, 'Real').at(-1)
  const ahora = horaEs(), dHoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
  const pv = sv(hoy.precios, 'PVPC').find(p => p[0].startsWith(dHoy) && Number(p[0].slice(11, 13)) === Math.floor(ahora)) ?? sv(hoy.precios, 'PVPC').at(-1)
  const ren = sv(hoy.balance, 'Generación renovable')[0], tot = (ren?.[1] ?? 0) + (sv(hoy.balance, 'Generación no renovable')[0]?.[1] ?? 0)
  const co2 = sv(hoy.co2, 'tCO2 eq./MWh').at(-1)
  return <div className="kpis">
    {real && <div className="kpi"><span className="kpi-l"><Zap size={14} /> Consumo ahora</span><span className="kpi-v"><CountUp value={real[1]} fmt={v => `${nf(v)} MW`} /></span><span className="kpi-p">a las {real[0].slice(11, 16)}, península</span></div>}
    {pv && <div className="kpi"><span className="kpi-l"><Euro size={14} /> Luz esta hora (PVPC)</span><span className="kpi-v"><CountUp value={pv[1] / 1000} fmt={v => `${nf(v, 3)} €/kWh`} /></span><span className="kpi-p">tarifa regulada, de {pv[0].slice(11, 13)} a {String(Number(pv[0].slice(11, 13)) + 1).padStart(2, '0')} h</span></div>}
    {ren && tot > 0 && <div className="kpi"><span className="kpi-l"><Factory size={14} /> Renovable ayer</span><span className="kpi-v"><CountUp value={(ren[1] / tot) * 100} fmt={v => `${nf(v)} %`} /></span><span className="kpi-p">de lo que se generó</span></div>}
    {co2 && <div className="kpi"><span className="kpi-l"><CloudFog size={14} /> CO₂ por kWh</span><span className="kpi-v"><CountUp value={co2[1] * 1000} fmt={v => `${nf(v)} g`} /></span><span className="kpi-p">{fDia(tLocal(co2[0]))}</span></div>}
  </div>
}

function Ahora({ hoy, tec, setTec, vivo }: { hoy: Hoy; tec: Tec | null; setTec: (t: Tec) => void; vivo: Date | null }) {
  const dHoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
  const ser = (k: string, extra: object) => { const v = sv(hoy.demanda, k).map(p => [tLocal(p[0]), p[1]] as [number, number]); return v.length > 1 ? { id: k, nombre: k === 'Real' ? 'Real' : k === 'Prevista' ? 'Prevista' : 'Programada', datos: v, ...extra } : null }
  const dem = [ser('Real', { color: ACC, area: true }), ser('Prevista', { color: '#9fb6bf', fondo: true }), ser('Programada', { color: '#3987e5', fondo: true })].filter(Boolean) as Parameters<typeof LineChart>[0]['series']
  const real = sv(hoy.demanda, 'Real'), pico = real.reduce((m, p) => (p[1] > (m?.[1] ?? -1) ? p : m), real[0])
  const pv = sv(hoy.precios, 'PVPC')
  const pvHoy = pv.filter(p => p[0].startsWith(dHoy)), dias = [...new Set(pv.map(p => p[0].slice(0, 10)))]
  const barata = pvHoy.reduce((m, p) => (p[1] < (m?.[1] ?? Infinity) ? p : m), pvHoy[0]), cara = pvHoy.reduce((m, p) => (p[1] > (m?.[1] ?? -1) ? p : m), pvHoy[0])
  const spot = sv(hoy.precios, 'Precio mercado spot')
  const mañana = spot.some(p => p[0] > dHoy + 'T23:59')
  const ag = useMemo(() => agrupar(hoy.mix30), [hoy.mix30])
  const trAg = useMemo(() => agruparTR(hoy.tr), [hoy.tr])
  const solMax = trAg?.capas.find(c => c.id === 'solar')?.v.reduce((a, b) => Math.max(a, b), 0)
  const bal = TEC.map(t => ({ t, v: t.de.reduce((s, n) => s + Math.max(0, sv(hoy.balance, n)[0]?.[1] ?? 0), 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)
  const btot = bal.reduce((s, x) => s + x.v, 0)
  return <>
    <Kpis hoy={hoy} />
    <div className="graficos">
      <Sala hoy={hoy} tec={tec} setTec={setTec} />
      {trAg && <Card t="La generación de hoy, cada 10 minutos" wide lead={<>Cómo se cubre el consumo a lo largo del día{solMax && <>: la solar llegó a <b>{nf(solMax)} MW</b></>}. Toca una tecnología para verla en el holograma.</>} fuente={<><A id="ree_tr">REE, seguimiento de la demanda</A> (península)</>}>
        <Apiladas xs={trAg.xs} capas={trAg.capas} titulo="Generación de hoy por tecnología" fx={fHora} ticksX={horas(trAg.xs[0], innerWidth < 640 ? 6 : 3)} fy={v => `${nf(v)} MW`} alto={240} sel={tec} onSel={id => setTec(id as Tec)} />
      </Card>}
      {dem.length > 0 && <Card t="El consumo de hoy" wide lead={<>{pico && <>El pico de hoy, por ahora, fue de <b>{nf(pico[1])} MW</b> a las {pico[0].slice(11, 16)}. </>}La línea gris es lo que Red Eléctrica preveía; la azul, lo que se programó en el mercado.</>}
        fuente={<>{vivo ? `En directo · actualizado a las ${vivo.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Copia del robot'} · <A id="ree_demanda">REE, demanda en tiempo real</A> (península)</>}>
        <LineChart titulo="Demanda eléctrica de hoy" series={dem} fx={fHora} ticksX={horas(dem[0].datos[0][0], innerWidth < 640 ? 6 : 3)} fy={v => `${nf(v)} MW`} alto={230} />
      </Card>}
      {pv.length > 1 && <Card t="El precio de la luz, hora a hora" lead={barata && cara && <>Hoy la hora más barata es de <b>{barata[0].slice(11, 13)} a {String(Number(barata[0].slice(11, 13)) + 1).padStart(2, '0')} h</b> ({nf(barata[1] / 1000, 3)} €/kWh) y la más cara, de {cara[0].slice(11, 13)} a {String(Number(cara[0].slice(11, 13)) + 1).padStart(2, '0')} h ({nf(cara[1] / 1000, 3)} €/kWh).{mañana ? ' El mercado ya ha casado los precios de mañana.' : ''}</>}
        fuente={<>PVPC: tarifa regulada con peajes e impuestos aparte. Mercado: precio mayorista. <A id="ree_mercados">REE, mercados</A></>}>
        <LineChart titulo="Precio de la luz" series={[
          { id: 'pvpc', nombre: 'PVPC (€/kWh)', datos: pv.map(p => [tLocal(p[0]), p[1] / 1000] as [number, number]), color: ACC, area: true },
          ...(spot.length > 1 ? [{ id: 'spot', nombre: 'Mercado (€/kWh)', datos: spot.map(p => [tLocal(p[0]), p[1] / 1000] as [number, number]), color: '#3987e5', fondo: true }] : []),
        ]} fx={t => `${fDia(t)} ${fHora(t)}`} fxEje={t => dias.length > 1 && fHora(t) === '00:00' ? fDia(t) : fHora(t)} fy={v => `${nf(v, 2)} €`} alto={220} ahora={tLocal(new Date(Date.now()).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).replace(' ', 'T'))} />
      </Card>}
      {bal.length > 0 && <Card t="De dónde salió la luz ayer" lead={<>Ayer la primera fuente fue la <b>{bal[0].t.nombre.toLowerCase()}</b>, con el {pct(bal[0].v / btot)} de la generación.</>} fuente={<A id="ree_balance">REE, balance eléctrico</A>}>
        <Barras titulo="Generación de ayer por tecnología" fmt={v => gwh(v)} items={bal.map(x => ({ id: x.t.id, nombre: x.t.nombre, sub: pct(x.v / btot, 1), valor: x.v, color: x.t.color, destacado: x.t.id === tec, onClick: () => setTec(x.t.id) }))} />
      </Card>}
      {ag && <Card t="Los últimos 30 días" wide lead="Toca una tecnología para verla en el holograma." fuente={<A id="ree_generacion">REE, estructura de la generación</A>}>
        <Apiladas xs={ag.xs} capas={ag.capas} titulo="Generación diaria por tecnología" fx={fDia} fy={v => gwh(v)} alto={230} sel={tec} onSel={id => setTec(id as Tec)} />
      </Card>}
    </div>
  </>
}

const sumaDias = (d: string, n: number) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
/** Un día cualquiera, cada 10 minutos (península), pedido en el momento a Red Eléctrica. */
function DiaGeneracion({ hoy }: { hoy: Hoy }) {
  const dHoy = diaEs(new Date())
  const [fecha, setFecha] = useState(sumaDias(dHoy, -1))
  const [filas, setFilas] = useState<{ d: string; f: FilaTR[] | null; err?: boolean } | null>(null)
  const [sel, setSel] = useState<Tec | null>(null)
  useEffect(() => {
    if (fecha === dHoy && hoy.tr?.length) { setFilas({ d: fecha, f: hoy.tr }); return }
    let ok = true; setFilas({ d: fecha, f: null })
    tiempoReal(fecha).then(f => ok && setFilas({ d: fecha, f }), () => ok && setFilas({ d: fecha, f: null, err: true }))
    return () => { ok = false }
  }, [fecha, dHoy, hoy.tr])
  const ag = useMemo(() => filas?.d === fecha ? agruparTR(filas.f) : null, [filas, fecha])
  const tot = ag?.capas.map(c => ({ c, e: c.v.reduce((a, b) => a + b, 0) / 6 })).sort((a, b) => b.e - a.e) // MW cada 10 min → MWh
  const suma = tot?.reduce((a, b) => a + b.e, 0) ?? 0
  const ren = tot?.filter(x => x.c.ren).reduce((a, b) => a + b.e, 0) ?? 0
  return <Card t="Un día concreto" wide lead={ag && tot ? <>El {fDia(ag.xs[0])} {new Date(ag.xs[0]).getUTCFullYear()} la primera fuente fue la <b>{tot[0].c.nombre.toLowerCase()}</b> ({pct(tot[0].e / suma)}) y el <b>{pct(ren / suma)}</b> fue renovable. Elige otro día en el calendario.</> : 'Elige un día en el calendario para ver cómo se generó la electricidad, cada 10 minutos.'}
    fuente={<><A id="ree_tr">REE, seguimiento de la demanda</A> (península)</>}>
    <div className="cal">
      <button aria-label="Día anterior" onClick={() => setFecha(sumaDias(fecha, -1))}><ChevronLeft size={18} /></button>
      <input type="date" value={fecha} min="2015-01-01" max={dHoy} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Elige el día" />
      <button aria-label="Día siguiente" onClick={() => setFecha(sumaDias(fecha, 1))} disabled={fecha >= dHoy}><ChevronRight size={18} /></button>
    </div>
    {ag ? <Apiladas xs={ag.xs} capas={ag.capas} titulo={`Generación del ${fecha}`} fx={fHora} ticksX={horas(ag.xs[0], innerWidth < 640 ? 6 : 3)} fy={v => `${nf(v)} MW`} alto={240} sel={sel} onSel={id => setSel(sel === id ? null : id as Tec)} />
      : <p className="note">{filas?.err ? 'Red Eléctrica no ha respondido. Prueba otro día o vuelve en un momento.' : 'Pidiendo los datos a Red Eléctrica…'}</p>}
  </Card>
}

function Generacion({ hist, desde, hoy }: { hist: Historia; desde: number; hoy: Hoy }) {
  const [modo, setModo] = useState<'pct' | 'abs'>('pct')
  const ag = useMemo(() => agrupar(hist.mix_mes), [hist.mix_mes])
  if (!ag) return <p className="note">Sin datos todavía.</p>
  const i0 = Math.max(0, ag.xs.findIndex(t => t >= desde))
  const xs = ag.xs.slice(i0), capas = ag.capas.map(c => ({ ...c, v: c.v.slice(i0) }))
  const ren = sv(hist.renovable_mes, 'Renovable').map(p => [tLocal(p[0]), p[2]! * 100] as [number, number])
  const rmax = ren.reduce((m, p) => (p[1] > m[1] ? p : m), ren[0])
  // años completos: comparación de cada tecnología entre el primero y el último
  const años = [...new Set(ag.fechas.map(f => f.slice(0, 4)))].filter(y => ag.fechas.filter(f => f.startsWith(y)).length === 12)
  const a0 = años[0], a1 = años.at(-1)!
  const suma = (c: typeof ag.capas[number], y: string) => c.v.reduce((s, v, i) => s + (ag.fechas[i].startsWith(y) ? v : 0), 0)
  const cambio = ag.capas.map(c => ({ c, x: suma(c, a1) - suma(c, a0) })).sort((a, b) => b.x - a.x)
  return <div className="graficos">
    <DiaGeneracion hoy={hoy} />
    <Card t="Cómo ha cambiado la mezcla" wide lead={<>Cada mes, qué parte de la electricidad salió de cada tecnología.{rmax && <> El récord renovable fue en {fMes(rmax[0])}: <b>{nf(rmax[1])} %</b>.</>}</>} fuente={<A id="ree_generacion">REE, estructura de la generación</A>}>
      <div className="modo" role="radiogroup" aria-label="Unidades">{(['pct', 'abs'] as const).map(m => <button key={m} role="radio" aria-checked={modo === m} className={modo === m ? 'is-on' : ''} onClick={() => setModo(m)}>{m === 'pct' ? 'En %' : 'En GWh'}</button>)}</div>
      <Apiladas xs={xs} capas={capas} titulo="Generación mensual por tecnología" fx={fMes} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => gwh(v)} alto={280} pct={modo === 'pct'} />
    </Card>
    <Card t="La parte renovable" lead="Porcentaje de la generación de cada mes que fue renovable. Sube en primavera, con lluvia, viento y sol a la vez." fuente={<A id="ree_generacion">REE</A>}>
      <LineChart titulo="Generación renovable" series={[{ id: 'r', nombre: 'Renovable', datos: ren.filter(p => p[0] >= desde), color: '#2fc6b3', area: true }]} fx={fMes} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => `${nf(v)} %`} yMin={0} />
    </Card>
    {a0 !== a1 && <Card t={`Quién ha ganado y quién ha perdido (${a0}–${a1})`} lead={<>Lo que más ha crecido es la <b>{cambio[0].c.nombre.toLowerCase()}</b>; lo que más ha caído, {cambio.at(-1)!.c.nombre.toLowerCase()}.</>}>
      <Barras titulo="Cambio de generación anual por tecnología" fmt={v => `${v > 0 ? '+' : ''}${gwh(v)}`} items={cambio.map(x => ({ id: x.c.id, nombre: x.c.nombre, valor: x.x, color: x.c.color }))} />
    </Card>}
  </div>
}

function Demanda({ hist, desde, extra }: { hist: Historia; desde: number; extra: ReturnType<typeof useExtra> }) {
  const d = sv(hist.demanda_mes, 'Demanda')
  const años = [...new Set(d.map(p => p[0].slice(0, 4)))].filter(y => d.filter(p => p[0].startsWith(y)).length === 12)
  const anual = años.map(y => ({ y, v: d.filter(p => p[0].startsWith(y)).reduce((s, p) => s + p[1], 0) }))
  const max = anual.reduce((m, x) => (x.v > m.v ? x : m), anual[0]), ult = anual.at(-1)
  return <div className="graficos">
    {ult && <Card t="Cuánta electricidad gastamos" wide lead={<>En {ult.y} España consumió <b>{gwh(ult.v)}</b>, un {pct(Math.abs(ult.v / max.v - 1))} {ult.v < max.v ? 'menos' : 'más'} que en {max.y}, el año de más consumo de la serie.</>} fuente={<A id="ree_demanda">REE, evolución de la demanda</A>}>
      <Columnas titulo="Demanda eléctrica anual" items={anual.map(x => ({ x: x.y, valor: x.v / 1e6, destacado: x.y === ult.y || x.y === max.y }))} fmt={v => `${nf(v, 0)} TWh`} etiqueta={c => `${nf(c.valor, 0)}`} cadaX={3} />
    </Card>}
    <Card t="Mes a mes" wide lead="El consumo sube en invierno y en verano: calefacción y aire acondicionado.">
      <LineChart titulo="Demanda mensual" series={[{ id: 'd', nombre: 'Demanda', datos: d.map(p => [tLocal(p[0]), p[1] / 1e3] as [number, number]).filter(p => p[0] >= desde), color: ACC, area: true }]} fx={fMes} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => `${nf(v)} GWh`} />
    </Card>
    <Sectores e={extra} />
    <Ire e={extra} desde={desde} />
  </div>
}

function Emisiones({ hist, desde }: { hist: Historia; desde: number }) {
  const f = sv(hist.co2_mes, 'tCO2 eq./MWh').map(p => [tLocal(p[0]), p[1] * 1000] as [number, number])
  const t = sv(hist.co2_mes, 'Total tCO2 eq.')
  const años = [...new Set(t.map(p => p[0].slice(0, 4)))].filter(y => t.filter(p => p[0].startsWith(y)).length === 12)
  const anual = años.map(y => ({ y, v: t.filter(p => p[0].startsWith(y)).reduce((s, p) => s + p[1], 0) }))
  const a0 = anual[0], a1 = anual.at(-1)
  return <div className="graficos">
    {a0 && a1 && <Card t="Lo que emite la electricidad" wide lead={<>En {a1.y} generar electricidad emitió <b>{nf(a1.v / 1e6, 1)} millones de toneladas de CO₂</b>, un {pct(1 - a1.v / a0.v)} menos que en {a0.y}. El carbón casi ha desaparecido; queda sobre todo el gas.</>} fuente={<A id="ree_generacion">REE, emisiones de la generación</A>}>
      <Columnas titulo="Emisiones anuales de CO₂" items={anual.map(x => ({ x: x.y, valor: x.v / 1e6, color: '#8b939c', destacado: x === a1 }))} fmt={v => `${nf(v, 1)} Mt`} cadaX={3} />
    </Card>}
    <Card t="CO₂ por cada kWh" wide lead="Gramos de CO₂ por kilovatio hora generado: baja cuando hay viento, agua y sol.">
      <LineChart titulo="Intensidad de emisiones" series={[{ id: 'f', nombre: 'g CO₂/kWh', datos: f.filter(p => p[0] >= desde), color: '#9fb6bf', area: true }]} fx={fMes} fxEje={x => String(new Date(x).getUTCFullYear())} fy={v => `${nf(v)} g`} yMin={0} />
    </Card>
  </div>
}

export default function App() {
  const { hoy, hist, err, setHoy } = useEnergia()
  const extra = useExtra()
  const vivo = useVivo(setHoy)
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'ahora')
  const [tec, setTec] = useState<Tec | null>(null)
  const [rango, setRango] = useState<0 | 10 | 5>(0)
  const desde = rango ? Date.now() - rango * 365.25 * 864e5 : -Infinity
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!hoy) return <main className="eco boot"><Zap size={28} /><p>Conectando con la red…</p></main>
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Energía</h1>
          <p>{vivo ? <><i className="vivo" /> En directo desde Red Eléctrica</> : 'Datos de Red Eléctrica'}</p>
        </div>
        {['generacion', 'demanda', 'emisiones'].includes(sec) && <div className="rango" role="radiogroup" aria-label="Periodo de los gráficos">
          {([5, 10, 0] as const).map(r => <button key={r} role="radio" aria-checked={rango === r} className={rango === r ? 'is-on' : ''} onClick={() => setRango(r)}>{r ? `${r} años` : 'Desde 2007'}</button>)}
        </div>}
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'ahora' && <Ahora hoy={hoy} tec={tec} setTec={setTec} vivo={vivo} />}
        {['generacion', 'demanda', 'emisiones'].includes(sec) && !hist && <p className="note">Cargando el histórico…</p>}
        {sec === 'generacion' && hist && <Generacion hist={hist} desde={desde} hoy={hoy} />}
        {sec === 'demanda' && hist && <Demanda hist={hist} desde={desde} extra={extra} />}
        {sec === 'fronteras' && <Fronteras e={extra} hoy={hoy} />}
        {sec === 'gas' && <GasPetroleo e={extra} />}
        {sec === 'precios' && <PreciosV2 hoy={hoy} hist={hist} extra={extra} />}
        {sec === 'emisiones' && hist && <Emisiones hist={hist} desde={desde} />}
      </motion.div>
      <Fuentes ids={['ree', 'ree_generacion', 'ree_demanda', 'ree_mercados', 'ree_balance']} />
      <p className="src">Lo de hoy se pide en directo a Red Eléctrica cada 5 minutos; el histórico (desde 2007) lo descarga un robot cada día. Datos nacionales salvo el consumo en tiempo real, que es peninsular.</p>
    </main>
  )
}
