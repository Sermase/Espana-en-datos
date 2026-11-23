import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Columnas, LineChart, nf } from '../graficos'
import { A } from '../Fuentes'
import { dia, fDia, fMes, ree, tLocal, type Grupo, type Historia, type Hoy } from './datos'

type Tarifa = 'pvpc' | 'mercado'
type Horas = { h: number; v: number }[]
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const largo = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${dd} de ${MES[m - 1]} de ${y}` }
const sumaDias = (d: string, n: number) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }

/** Precio de cada hora de un día (€/kWh). El mercado va por cuartos de hora desde oct-2025: se promedia por hora. */
function horasDe(g: Grupo | null, d: string, t: Tarifa): Horas {
  const s = t === 'pvpc' ? g?.['PVPC'] : g?.['Precio mercado spot'] ?? Object.entries(g ?? {}).find(([k]) => /spot|mercado/i.test(k))?.[1]
  const m = new Map<number, number[]>()
  for (const [f, v] of s?.v ?? []) if (f.startsWith(d)) { const h = Number(f.slice(11, 13)); m.set(h, [...(m.get(h) ?? []), v]) }
  return [...m].sort((a, b) => a[0] - b[0]).map(([h, vs]) => ({ h, v: vs.reduce((a, b) => a + b, 0) / vs.length / 1000 }))
}
/** Verde (barato) → ámbar → rojo (caro), dentro del rango del propio día. */
function tono(v: number, lo: number, hi: number) {
  const f = hi > lo ? (v - lo) / (hi - lo) : 0.5
  const stops = [[47, 198, 179], [245, 197, 24], [255, 77, 94]]
  const i = f < 0.5 ? 0 : 1, k = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5
  const c = stops[i].map((a, j) => Math.round(a + (stops[i + 1][j] - a) * k))
  return `rgb(${c.join(',')})`
}

/** Las 24 horas en fichas de color, como las webs de «precio de la luz por horas». */
function Rejilla({ horas, ahora }: { horas: Horas; ahora?: number }) {
  if (!horas.length) return <p className="note">Todavía no hay precios para este día.</p>
  const vs = horas.map(x => x.v), lo = Math.min(...vs), hi = Math.max(...vs)
  const orden = [...horas].sort((a, b) => a.v - b.v), baratas = new Set(orden.slice(0, 3).map(x => x.h)), caras = new Set(orden.slice(-3).map(x => x.h))
  return (
    <ol className="horas" aria-label="Precio de cada hora">
      {horas.map((x, i) => (
        <motion.li key={x.h} className={`${x.h === ahora ? 'is-ahora' : ''}`} style={{ ['--t' as string]: tono(x.v, lo, hi) }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.018 }}>
          <span className="h-h">{String(x.h).padStart(2, '0')}–{String(x.h + 1).padStart(2, '0')} h</span>
          <b>{nf(x.v, 3)}</b>
          <span className="h-u">€/kWh{baratas.has(x.h) ? ' · barata' : caras.has(x.h) ? ' · cara' : ''}</span>
          <i style={{ width: `${hi > lo ? 18 + ((x.v - lo) / (hi - lo)) * 82 : 50}%` }} />
        </motion.li>
      ))}
    </ol>
  )
}
const media = (h: Horas) => h.length ? h.reduce((a, b) => a + b.v, 0) / h.length : null
const franja = (h: Horas, cmp: (a: number, b: number) => boolean) => h.reduce<{ h: number; v: number } | null>((m, x) => (!m || cmp(x.v, m.v) ? x : m), null)
const hh = (h: number) => `${String(h).padStart(2, '0')} a ${String(h + 1).padStart(2, '0')} h`

function Resumen({ titulo, horas, nota }: { titulo: string; horas: Horas; nota?: string }) {
  const m = media(horas), b = franja(horas, (a, c) => a < c), c = franja(horas, (a, d) => a > d)
  return <div className="pdia">
    <span className="pdia-t">{titulo}</span>
    {m == null ? <><b className="pdia-v">—</b><span className="pdia-n">{nota ?? 'Sin publicar todavía'}</span></> : <>
      <b className="pdia-v">{nf(m, 3)}<small> €/kWh de media</small></b>
      {b && c && <span className="pdia-n">Más barata de {hh(b.h)} ({nf(b.v, 3)}) · más cara de {hh(c.h)} ({nf(c.v, 3)})</span>}
    </>}
  </div>
}

export function Precios({ hoy, hist }: { hoy: Hoy; hist: Historia | null }) {
  const [tarifa, setTarifa] = useState<Tarifa>('pvpc')
  const dHoy = dia(new Date()), dMañana = sumaDias(dHoy, 1)
  const ahora = Number(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  const hHoy = useMemo(() => horasDe(hoy.precios, dHoy, tarifa), [hoy.precios, dHoy, tarifa])
  const hMañana = useMemo(() => horasDe(hoy.precios, dMañana, tarifa), [hoy.precios, dMañana, tarifa])

  // Cualquier día desde 2014: se pide en el momento a Red Eléctrica.
  const [fecha, setFecha] = useState(sumaDias(dHoy, -1))
  const [otro, setOtro] = useState<{ d: string; g: Grupo | null; err?: boolean } | null>(null)
  useEffect(() => {
    if (fecha === dHoy || fecha === dMañana) return
    let ok = true
    setOtro({ d: fecha, g: null })
    ree('mercados/precios-mercados-tiempo-real', `${fecha}T00:00`, `${fecha}T23:59`, 'hour').then(g => ok && setOtro({ d: fecha, g }), () => ok && setOtro({ d: fecha, g: null, err: true }))
    return () => { ok = false }
  }, [fecha, dHoy, dMañana])
  const gDia = fecha === dHoy || fecha === dMañana ? hoy.precios : otro?.d === fecha ? otro.g : null
  const hDia = useMemo(() => horasDe(gDia, fecha, tarifa), [gDia, fecha, tarifa])
  const cargando = fecha !== dHoy && fecha !== dMañana && !otro?.g && !otro?.err

  // Medias mensuales a partir de la media diaria que guarda el robot
  const pd = hist?.precio_dia
  const mensual = useMemo(() => {
    const s = tarifa === 'pvpc' ? pd?.['PVPC'] : pd?.['Precio mercado spot']
    const m = new Map<string, number[]>(); for (const p of s?.v ?? []) { const k = p[0].slice(0, 7); m.set(k, [...(m.get(k) ?? []), p[1]]) }
    return [...m].map(([k, xs]) => ({ k, v: xs.reduce((a, b) => a + b, 0) / xs.length / 1000 }))
  }, [pd, tarifa])
  const caro = mensual.reduce<{ k: string; v: number } | null>((m, x) => (!m || x.v > m.v ? x : m), null)
  const diaria = (tarifa === 'pvpc' ? pd?.['PVPC'] : pd?.['Precio mercado spot'])?.v.map(p => [tLocal(p[0]), p[1] / 1000] as [number, number]) ?? []

  return <div className="graficos">
    <section className="gcard is-wide">
      <div className="ptop">
        <h2>El precio de la luz</h2>
        <div className="modo" role="radiogroup" aria-label="Tarifa">
          {(['pvpc', 'mercado'] as const).map(t => <button key={t} role="radio" aria-checked={tarifa === t} className={tarifa === t ? 'is-on' : ''} onClick={() => setTarifa(t)}>{t === 'pvpc' ? 'Tarifa regulada (PVPC)' : 'Mercado mayorista'}</button>)}
        </div>
      </div>
      <p className="lead">{tarifa === 'pvpc' ? 'Lo que paga por la energía quien tiene la tarifa regulada, con peajes y cargos incluidos y sin impuestos.' : 'El precio al que se compra la electricidad en el mercado diario, antes de peajes, cargos e impuestos.'}</p>
      <div className="pdias">
        <Resumen titulo={`Hoy · ${largo(dHoy)}`} horas={hHoy} />
        <Resumen titulo={`Mañana · ${largo(dMañana)}`} horas={hMañana} nota={tarifa === 'pvpc' ? 'El PVPC de mañana se publica hacia las 20:15' : 'El mercado casa los precios de mañana hacia las 13:00'} />
      </div>
      <h3 className="sub">Hoy, hora a hora</h3>
      <Rejilla horas={hHoy} ahora={ahora} />
      {hMañana.length > 0 && <><h3 className="sub">Mañana, hora a hora</h3><Rejilla horas={hMañana} /></>}
      <p className="fuente"><A id="ree_mercados">REE, precios de los mercados</A> · se actualiza solo cada 5 minutos</p>
    </section>

    <section className="gcard is-wide">
      <div className="ptop">
        <h2>Cualquier día desde 2014</h2>
        <div className="cal">
          <button aria-label="Día anterior" onClick={() => setFecha(sumaDias(fecha, -1))}><ChevronLeft size={18} /></button>
          <input type="date" value={fecha} min="2014-04-01" max={dMañana} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Elige el día" />
          <button aria-label="Día siguiente" onClick={() => setFecha(sumaDias(fecha, 1))} disabled={fecha >= dMañana}><ChevronRight size={18} /></button>
        </div>
      </div>
      {cargando ? <p className="note">Pidiendo los precios del {largo(fecha)} a Red Eléctrica…</p>
        : otro?.err && fecha === otro.d ? <p className="note">Red Eléctrica no ha respondido. Prueba otra vez en un momento.</p>
        : <><p className="lead">{largo(fecha)}{media(hDia) != null && <>: media de <b>{nf(media(hDia)!, 3)} €/kWh</b>.</>}</p><Rejilla horas={hDia} ahora={fecha === dHoy ? ahora : undefined} /></>}
    </section>

    {mensual.length > 1 && <section className="gcard is-wide">
      <h2>Mes a mes</h2>
      <p className="lead">Media de cada mes{caro && <>; el más caro de lo descargado fue {fMes(Date.parse(caro.k + '-15'))}, con <b>{nf(caro.v, 3)} €/kWh</b></>}. {pd && (pd['PVPC']?.v[0]?.[0] ?? '') > '2015' && 'El histórico se completa hacia atrás cada día, hasta 2014.'}</p>
      <Columnas titulo="Precio medio mensual de la luz" items={mensual.map(x => ({ x: fMes(Date.parse(x.k + '-15')), valor: x.v, color: tono(x.v, Math.min(...mensual.map(y => y.v)), Math.max(...mensual.map(y => y.v))), destacado: x === caro }))} fmt={v => `${nf(v, 3)} €`} etiqueta={c => nf(c.valor, 3)} cadaX={Math.max(1, Math.ceil(mensual.length / 8))} />
      {diaria.length > 1 && <LineChart titulo="Precio medio diario de la luz" series={[{ id: 'd', nombre: tarifa === 'pvpc' ? 'PVPC' : 'Mercado', datos: diaria, color: '#ffb02e' }]} fx={fDia} fxEje={t => fMes(t)} fy={v => `${nf(v, 2)} €`} yMin={0} alto={180} />}
      <p className="fuente"><A id="ree_mercados">REE, precios de los mercados</A></p>
    </section>}
  </div>
}
