import { motion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import resumen from '../resumen.json'
import { TEMAS, type Tema } from '../temas'

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
  if (t.id === 'energia') return (
    <svg viewBox="0 0 120 80" className="mini" aria-hidden>{[22, 30, 46, 58, 52, 64, 70, 56, 40, 34, 28, 24].map((h, i) => <rect key={i} x={4 + i * 9.5} y={76 - h} width="6.5" height={h} fill={c} opacity={.35 + (h / 70) * .6} />)}</svg>
  )
  return (
    <svg viewBox="0 0 120 80" className="mini" aria-hidden>
      <path d="M4 60 L18 54 L30 58 L44 44 L58 48 L72 34 L86 38 L100 22 L116 26" fill="none" stroke={c} strokeWidth="2" />
      <path d="M4 60 L18 54 L30 58 L44 44 L58 48 L72 34 L86 38 L100 22 L116 26 L116 78 L4 78 Z" fill={c} fillOpacity=".1" />
    </svg>
  )
}

const VISTA = { mapa: 'Se explora en un mapa', consola: 'Se explora en paneles y series', 'pirámide': 'Se explora en pirámides y flujos', relieve: 'Se explora en relieve 3D' }

export default function Portada() {
  return (
    <main className="portada">
      <header className="cabecera">
        <h1>España<span>en datos</span></h1>
        <p>Datos oficiales de España para explorar como un tablero de mando. Cada tema con su vista, sus fichas y su color.</p>
      </header>
      <ul className="temas">
        {TEMAS.map((t, i) => {
          const abierto = !!t.ruta
          const Card = abierto ? motion.a : motion.div
          return (
            <li key={t.id} className={`${abierto ? 'es-abierto' : ''} ${i === 0 ? 'es-grande' : ''}`} style={{ '--c': t.color } as React.CSSProperties}>
              <Card href={t.ruta} className="tema" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 + i * .09, duration: .5 }}>
                <div className="tema-txt">
                  <h2>{t.nombre}{abierto && <ArrowUpRight size={20} />}</h2>
                  <p>{t.lema}</p>
                  <small>{abierto ? <><i className="vivo" /> {t.id === 'agua' ? `Datos del ${fecha}` : t.id === 'poblacion' ? 'Padrón y series del INE' : 'Datos de hoy'}</> : 'En preparación'} · {VISTA[t.vista]}</small>
                </div>
                <Mini t={t} />
              </Card>
            </li>
          )
        })}
      </ul>
      <footer className="pie">Fuentes oficiales en cada tema: MITECO, IGN, INE, REE, AEMET, DGT. Sin registro, sin anuncios.</footer>
    </main>
  )
}
