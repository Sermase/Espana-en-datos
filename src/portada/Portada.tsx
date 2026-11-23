import { motion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import resumen from '../resumen.json'
import { useState, type PointerEvent } from 'react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import { CountUp } from '../graficos/CountUp'
import { AREAS, TEMAS, type AreaId, type Tema } from '../temas'
import { A } from '../Fuentes'
import { Hero, type Lectura } from './Hero'

const fecha = new Date(resumen.agua.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const reserva = (resumen.agua.a / resumen.agua.c) * 100

/** Miniatura de la vista de cada tema: anticipa cómo se va a explorar. */
function Mini({ t }: { t: Tema }) {
  const c = t.color
  if (t.id === 'agua') {
    const r = 46, L = 2 * Math.PI * r
    return (
      <svg viewBox="0 0 120 120" className="mini mini-ring" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke={c} strokeOpacity=".15" strokeWidth="8" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" transform="rotate(-90 60 60)"
          strokeDasharray={L} initial={{ strokeDashoffset: L }} animate={{ strokeDashoffset: L * (1 - reserva / 100) }} transition={{ duration: 1.6, delay: .5, ease: [.2, .8, .2, 1] }} />
        <text x="60" y="66" textAnchor="middle" className="mini-big">{Math.round(reserva)}<tspan className="mini-unit"> %</tspan></text>
      </svg>
    )
  }
  if (t.id === 'gasolineras') {
    const g = (resumen as { gasolineras?: { g95: number; dsl: number } }).gasolineras
    return (
      <svg viewBox="0 0 120 80" className="mini" aria-hidden>
        {Array.from({ length: 28 }, (_, i) => <circle key={i} cx={8 + (i % 7) * 17} cy={10 + Math.floor(i / 7) * 9} r="3" fill={i % 5 === 0 ? '#3df5b0' : i % 3 === 0 ? c : '#c9b7bd'} opacity={.4 + (i % 4) * .15} />)}
        {g && <text x="60" y="74" textAnchor="middle" className="mini-big" style={{ fontSize: 20 }}>{g.g95.toLocaleString('es-ES', { minimumFractionDigits: 3 })}<tspan className="mini-unit"> €/l</tspan></text>}
      </svg>
    )
  }
  if (t.id === 'comercio') {
    const e = (resumen as unknown as { comercio?: { año: string; exp: number; imp: number } }).comercio
    const max = Math.max(e?.exp ?? 1, e?.imp ?? 1)
    return (
      <svg viewBox="0 0 120 80" className="mini" aria-hidden>
        {e && ([['Vende', e.exp, c], ['Compra', e.imp, '#3987e5']] as const).map(([n, v, col], i) => <g key={n}>
          <text x="4" y={26 + i * 28} className="mini-unit" style={{ fontSize: 10.5 }}>{n}</text>
          <motion.rect x="42" y={17 + i * 28} height="10" rx="2" fill={col} initial={{ width: 0 }} animate={{ width: (v / max) * 74 }} transition={{ delay: .4 + i * .15, duration: .8 }} />
          <text x="44" y={41 + i * 28} className="mini-unit" style={{ fontSize: 9.5 }}>{v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} mil M€</text>
        </g>)}
      </svg>
    )
  }
  if (t.id === 'economia') {
    const e = (resumen as unknown as { economia?: { ipc?: [string, number]; paro?: [string, number]; pib?: [string, number] } }).economia
    const filas = ([['PIB', e?.pib], ['IPC', e?.ipc], ['Paro', e?.paro]] as const).filter(f => f[1])
    return (
      <svg viewBox="0 0 120 80" className="mini" aria-hidden>
        {filas.map(([n, v], i) => <g key={n}>
          <text x="4" y={20 + i * 25} className="mini-unit" style={{ fontSize: 11 }}>{n}</text>
          <motion.rect x="34" y={12 + i * 25} height="9" rx="2" fill={c} initial={{ width: 0 }} animate={{ width: Math.min(52, v![1] * 4) }} transition={{ delay: .4 + i * .12, duration: .7 }} />
          <text x="118" y={21 + i * 25} textAnchor="end" className="mini-big" style={{ fontSize: 13 }}>{v![1].toLocaleString('es-ES', { maximumFractionDigits: 1 })} %</text>
        </g>)}
      </svg>
    )
  }
  if (t.id === 'trenes') return (
    <svg viewBox="0 0 120 80" className="mini" aria-hidden>
      <path d="M4 60 L40 40 L70 44 L116 14 M40 40 L52 76 M70 44 L104 70" fill="none" stroke={c} strokeOpacity=".35" strokeWidth="2" />
      {[0, 1, 2].map(i => <motion.circle key={i} r="3.5" fill={c} initial={{ offsetDistance: '0%' }} animate={{ offsetDistance: '100%' }} transition={{ duration: 5 + i * 2, repeat: Infinity, ease: 'linear', delay: i }} style={{ offsetPath: `path('${['M4 60 L40 40 L70 44 L116 14', 'M40 40 L52 76', 'M70 44 L104 70'][i]}')` }} />)}
    </svg>
  )
  if (t.vista === 'pirámide') {
    const p = (resumen as { poblacion?: { total: number } }).poblacion
    return (
      <svg viewBox="0 0 120 88" className="mini" aria-hidden>{[30, 38, 44, 46, 44, 40, 34, 26, 16, 8].map((w, i) => (
        <g key={i}><motion.rect y={4 + i * 6} height="4.5" fill="#3987e5" initial={{ x: 60, width: 0 }} animate={{ x: 60 - w, width: w - 1 }} transition={{ delay: .4 + i * .05, duration: .6 }} /><motion.rect x={61} y={4 + i * 6} height="4.5" fill="#d95926" initial={{ width: 0 }} animate={{ width: w + (i > 6 ? 4 : 0) }} transition={{ delay: .4 + i * .05, duration: .6 }} /></g>))}
        {p && <text x="60" y="84" textAnchor="middle" className="mini-big" style={{ fontSize: 17 }}>{(p.total / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })}<tspan className="mini-unit"> M</tspan></text>}
      </svg>
    )
  }
  if (t.vista === 'relieve') return (
    <svg viewBox="0 0 120 80" className="mini" aria-hidden>
      <path d="M0 74 L22 40 L34 52 L56 14 L72 38 L84 28 L120 74 Z" fill={c} fillOpacity=".12" stroke={c} strokeOpacity=".7" />
      <path d="M48 27 L56 14 L64 26 L60 24 L56 28 L52 25 Z M80 33 L84 28 L89 34 Z" fill={c} />
    </svg>
  )
  if (t.id === 'carreteras') return (
    <svg viewBox="0 0 120 80" className="mini" aria-hidden>
      <path d="M6 70 C 40 60, 30 20, 70 22 S 110 10, 116 6" fill="none" stroke={c} strokeOpacity=".25" strokeWidth="8" />
      <path d="M6 70 C 40 60, 30 20, 70 22 S 110 10, 116 6" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="6 6" />
      <circle cx="70" cy="22" r="4" fill={c} />
    </svg>
  )
  if (t.id === 'energia') {
    const e = (resumen as unknown as { energia?: { ren?: number | null } }).energia
    const ren = e?.ren ?? null, R = 26, L = 2 * Math.PI * R
    return (
      <svg viewBox="0 0 120 80" className="mini" aria-hidden>
        <circle cx="60" cy="38" r={R} fill="none" stroke={c} strokeOpacity=".15" strokeWidth="7" />
        {ren != null && <motion.circle cx="60" cy="38" r={R} fill="none" stroke={c} strokeWidth="7" strokeLinecap="round" transform="rotate(-90 60 38)" strokeDasharray={L} initial={{ strokeDashoffset: L }} animate={{ strokeDashoffset: L * (1 - ren / 100) }} transition={{ delay: .4, duration: 1.1 }} />}
        {ren != null && <text x="60" y="44" textAnchor="middle" className="mini-big" style={{ fontSize: 17 }}>{Math.round(ren)}<tspan className="mini-unit"> %</tspan></text>}
        <text x="60" y="78" textAnchor="middle" className="mini-unit" style={{ fontSize: 9.5 }}>renovable ayer</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 80" className="mini" aria-hidden>
      <path d="M4 60 L18 54 L30 58 L44 44 L58 48 L72 34 L86 38 L100 22 L116 26" fill="none" stroke={c} strokeWidth="2" />
      <path d="M4 60 L18 54 L30 58 L44 44 L58 48 L72 34 L86 38 L100 22 L116 26 L116 78 L4 78 Z" fill={c} fillOpacity=".1" />
    </svg>
  )
}

/** Los datos clave de cada tema, para verlos de un vistazo sin entrar. Salen de src/resumen.json, que escriben los robots. */
function cifras(id: string): { n: number; f: (v: number) => string; l: string }[] {
  const r = R[id] as Record<string, unknown> | undefined
  if (!r) return []
  const par = (k: string) => (r[k] as [string, number] | undefined)?.[1] ?? 0
  const pct = (d = 1, signo = false) => (v: number) => `${signo && v > 0 ? '+' : ''}${es(v, d)} %`
  const eur = (d = 3) => (v: number) => `${es(v, d)} €`
  const ent = (v: number) => es(v, 0)
  switch (id) {
    case 'agua': return [{ n: reserva, f: pct(1), l: 'llenos los embalses' }, { n: Number(r.a) / 1000, f: v => `${es(v, 1)} mil hm³`, l: 'de agua guardada' }]
    case 'gasolineras': return [{ n: Number(r.g95), f: eur(), l: 'gasolina 95, mediana' }, { n: Number(r.dsl), f: eur(), l: 'diésel' }, { n: Number(r.n), f: ent, l: 'gasolineras' }]
    case 'energia': return [{ n: Number(r.ren), f: pct(0), l: 'renovable ayer' }, { n: Number(r.pvpc), f: eur(), l: 'kWh hoy, tarifa regulada' }]
    case 'economia': return [{ n: par('pib'), f: pct(1, true), l: 'crece el PIB' }, { n: par('ipc'), f: pct(1), l: 'inflación' }, { n: par('paro'), f: pct(1), l: 'paro' }]
    case 'comercio': return [{ n: Number(r.exp), f: ent, l: `mil M€ vendidos en ${r.año}` }, { n: Number(r.exp) - Number(r.imp), f: v => es(v, 1), l: 'mil M€ de saldo' }]
    case 'vivienda': return [{ n: par('ipv_a'), f: pct(1, true), l: 'sube el precio en un año' }, { n: Number(r.compraventas), f: ent, l: 'casas vendidas en 12 meses' }]
    case 'cuentas': return [{ n: (Number(r.gasto) / Number(r.pib)) * 100, f: pct(1), l: `del PIB gastan las administraciones (${r.año})` }, { n: (Number(r.ingreso) - Number(r.gasto)) / Number(r.pib) * 100, f: pct(1), l: Number(r.ingreso) < Number(r.gasto) ? 'déficit' : 'superávit' }]
    case 'subvenciones': return [{ n: Number(r.imp) / 1e9, f: v => `${es(v, 1)} mil M€`, l: 'en ayudas, últimos 12 meses' }, { n: Number(r.n) / 1e6, f: v => `${es(v, 1)} M`, l: 'concesiones' }]
    case 'impuestos': return [{ n: Number(r.total12) / 1000, f: v => `${es(v, 1)} mil M€`, l: 'recaudados en 12 meses' }, { n: Number(r.var), f: pct(1, true), l: 'en un año' }]
    case 'poblacion': return [{ n: Number(r.total) / 1e6, f: v => `${es(v, 2)} M`, l: `habitantes (${r.año})` }, { n: Number(r.municipios), f: ent, l: 'municipios' }]
    default: return []
  }
}
const FUENTE: Record<string, string> = { impuestos: 'Agencia Tributaria, cada semana', cuentas: 'Eurostat, cada semana', subvenciones: 'BDNS, cada día', vivienda: 'INE, cada semana', agua: `Datos del ${fecha}`, poblacion: 'Padrón del INE', economia: 'Eurostat, cada día', energia: 'En directo, Red Eléctrica', comercio: 'Eurostat, cada semana', gasolineras: 'Datos de hoy' }


const R = resumen as unknown as Record<string, Record<string, unknown>>
const color = (id: string) => TEMAS.find(t => t.id === id)?.color ?? '#9fd8e8'
const ruta = (id: string) => TEMAS.find(t => t.id === id)?.ruta
const es = (v: number, d = 1) => v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d })
/** Las lecturas del mapa de entrada: un dato vivo de cada tema, colocado donde tiene sentido. */
const LECTURAS: Lectura[] = [
  { id: 'agua', lon: -6.3, lat: 39.4, color: color('agua'), valor: `${Math.round(reserva)} %`, texto: 'agua en los embalses', href: ruta('agua') },
  { id: 'gasolineras', lon: -0.9, lat: 41.65, color: color('gasolineras'), valor: `${es(Number(R.gasolineras?.g95 ?? 0), 3)} €`, texto: 'litro de gasolina 95', href: ruta('gasolineras') },
  { id: 'energia', lon: -7.9, lat: 42.9, color: color('energia'), valor: `${Math.round(Number(R.energia?.ren ?? 0))} %`, texto: 'luz renovable ayer', href: ruta('energia') },
  { id: 'poblacion', lon: -3.7, lat: 40.42, color: color('poblacion'), valor: `${es(Number(R.poblacion?.total ?? 0) / 1e6, 1)} M`, texto: 'habitantes', href: ruta('poblacion') },
  { id: 'economia', lon: 2.17, lat: 41.39, color: color('economia'), valor: `${es((R.economia?.ipc as [string, number])?.[1] ?? 0, 1)} %`, texto: 'inflación anual (IPC)', href: ruta('economia') },
  { id: 'comercio', lon: -5.45, lat: 36.15, color: color('comercio'), valor: `${es(Number(R.comercio?.exp ?? 0), 0)} mil M€`, texto: 'vendido al mundo', href: ruta('comercio') },
]
const TICKER = [
  ['Embalses', `${Math.round(reserva)} %`, 'agua'], ['Gasolina 95', `${es(Number(R.gasolineras?.g95 ?? 0), 3)} €/l`, 'gasolineras'], ['Diésel', `${es(Number(R.gasolineras?.dsl ?? 0), 3)} €/l`, 'gasolineras'],
  ['Luz hoy (PVPC)', `${es(Number(R.energia?.pvpc ?? 0), 3)} €/kWh`, 'energia'], ['Renovable ayer', `${Math.round(Number(R.energia?.ren ?? 0))} %`, 'energia'],
  ['IPC', `${es((R.economia?.ipc as [string, number])?.[1] ?? 0, 1)} %`, 'economia'], ['Paro', `${es((R.economia?.paro as [string, number])?.[1] ?? 0, 1)} %`, 'economia'], ['PIB', `+${es((R.economia?.pib as [string, number])?.[1] ?? 0, 1)} %`, 'economia'],
  ['Habitantes', `${es(Number(R.poblacion?.total ?? 0) / 1e6, 1)} M`, 'poblacion'], ['Exportaciones', `${es(Number(R.comercio?.exp ?? 0), 0)} mil M€`, 'comercio'],
] as const

/** Foco de luz que sigue al puntero sobre la tarjeta (solo cambia dos variables CSS, sin repintar React). */
const foco = (e: PointerEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`) }

/** Los temas por áreas: chips para filtrar (con una píldora que se desliza) y, en cada área, las tarjetas con sus datos clave. */
function Areas() {
  const [area, setArea] = useState<AreaId | null>(null)
  const abiertos = TEMAS.filter(t => t.ruta).length
  const chips: { id: AreaId | null; nombre: string }[] = [{ id: null, nombre: 'Todo' }, ...AREAS]
  return <LayoutGroup>
    <nav className="areas-nav" aria-label="Áreas">
      {chips.map(c => <button key={c.id ?? 'todo'} className={area === c.id ? 'is-on' : ''} onClick={() => setArea(area === c.id ? null : c.id)} aria-pressed={area === c.id}>
        {area === c.id && <motion.i className="chip-pildora" layoutId="chip-pildora" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
        <span>{c.nombre}{c.id == null && <small>{abiertos} abiertos de {TEMAS.length}</small>}</span>
      </button>)}
    </nav>
    <AnimatePresence mode="popLayout" initial={false}>
      {AREAS.filter(a => !area || a.id === area).map(a => {
        const temas = [...TEMAS.filter(t => t.area === a.id && t.ruta), ...TEMAS.filter(t => t.area === a.id && !t.ruta)]
        return <motion.section key={a.id} className="area" layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, transition: { duration: .2 } }} transition={{ duration: .45, ease: [0.2, 0.8, 0.2, 1] }}>
          <header>
            <motion.h2 initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: .5 }}>{a.nombre}</motion.h2>
            <p>{a.lema}</p>
            <motion.i className="area-linea" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: .9, ease: [0.2, 0.8, 0.2, 1] }} />
          </header>
          <ul className="temas">
            {temas.map((t, i) => {
              const abierto = !!t.ruta, cs = cifras(t.id)
              const Card = abierto ? motion.a : motion.div
              return (
                <motion.li layout key={t.id} className={abierto ? 'es-abierto' : 'es-plan'} style={{ '--c': t.color } as React.CSSProperties}
                  initial={{ opacity: 0, y: 26, clipPath: 'inset(0 0 100% 0)' }} whileInView={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }} viewport={{ once: true, margin: '-30px' }}
                  transition={{ delay: i * .08, duration: .6, ease: [0.2, 0.8, 0.2, 1] }}>
                  <Card href={t.ruta} className="tema" onPointerMove={foco} whileHover={abierto ? { y: -3 } : undefined} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                    <div className="tema-txt">
                      <h3>{t.nombre}{abierto && <ArrowUpRight size={18} />}</h3>
                      <p>{abierto ? t.lema : t.plan ?? t.lema}</p>
                      {cs.length > 0 && <dl className="cifras">{cs.map((c, k) => <div key={c.l}><dt>{c.l}</dt><dd><CountUp value={c.n} fmt={c.f} delay={.25 + k * .12} duration={1.3} /></dd></div>)}</dl>}
                      <small>{abierto ? <><i className="vivo" /> {FUENTE[t.id] ?? 'Datos oficiales'}</> : 'En preparación'}</small>
                    </div>
                    {abierto && <Mini t={t} />}
                  </Card>
                </motion.li>
              )
            })}
          </ul>
        </motion.section>
      })}
    </AnimatePresence>
  </LayoutGroup>
}

export default function Portada() {
  return (
    <main className="portada">
      <header className="cabecera">
        <div className="cab-txt">
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .2 }}>España<span>en datos</span></motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: .8 }}>El país como un cuadro de mando. Datos oficiales que se actualizan solos: cuánta agua queda, cuánto cuesta la luz esta hora, cuántos somos y qué le vendemos al mundo.</motion.p>
          <motion.p className="cab-pista" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.2, duration: .8 }}>Pasa el ratón o el dedo por el mapa. Toca un dato para abrir su tema.</motion.p>
        </div>
        <Hero lecturas={LECTURAS} />
      </header>
      <div className="ticker" aria-label="Datos de hoy">
        <div className="ticker-pista">{[0, 1].map(k => <span key={k} aria-hidden={k === 1}>{TICKER.map(([n, v, id]) => <a key={n} href={ruta(id)} style={{ ['--c' as string]: color(id) }}><i />{n} <b>{v}</b></a>)}</span>)}</div>
      </div>
      <Areas />
      <footer className="pie">Fuentes oficiales, enlazadas en cada tema: <A id="boletin">MITECO</A>, <A id="siane">IGN</A>, <A id="ine_padron">INE</A>, <A id="eurostat">Eurostat</A>, <A id="ree">REE</A>, <A id="aemet">AEMET</A>. Sin registro, sin anuncios.</footer>
    </main>
  )
}
