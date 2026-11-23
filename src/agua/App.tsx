import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Activity, CloudRain, Droplets, Factory, House, Recycle, Info as InfoIcon, X, Zap, ChevronUp, Trophy } from 'lucide-react'
import { Board, type Layer } from './Board'
import { Panel } from './Panel'
import { SelCard } from './SelCard'
import { consumo, data, energyTotals, fechaLarga, fmt, fmtPct } from './data'
import { useRivers } from './rivers'
import { fromKey, randomSel, sameSel, selKey, useCollection, type Milestone, type Sel } from './sel'
import { CountUp, Info } from './ui'
import { A } from '../Fuentes'

const LAYERS: { id: Layer; label: string; short?: string; icon: typeof Droplets }[] = [
  { id: 'agua', label: 'Agua', icon: Droplets },
  { id: 'energia', label: 'Energía', icon: Zap },
  { id: 'lluvia', label: 'Lluvia', icon: CloudRain },
  { id: 'rios', label: 'Ríos', icon: Activity },
  { id: 'consumo', label: 'Abastecimiento', short: 'Grifo', icon: House },
  { id: 'depuracion', label: 'Depuración', short: 'Depura', icon: Recycle },
  { id: 'vertidos', label: 'Vertidos', icon: Factory },
]

const n = data.meta.national
const wettest = [...data.rain].sort((a, b) => b.p - a.p)[0]
const layerFor = (s: Sel, cur: Layer): Layer => s.k === 'river' ? (cur === 'energia' || cur === 'rios' ? cur : 'agua') : s.k === 'rain' ? 'lluvia' : s.k === 'dis' ? 'vertidos' : s.k === 'flow' ? 'rios' : s.k === 'cons' ? 'consumo' : s.k === 'dep' ? 'depuracion' : cur === 'energia' ? 'energia' : 'agua'

function useIsPhone() {
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 980px)').matches)
  useEffect(() => {
    const m = matchMedia('(max-width: 980px)'), on = () => setPhone(m.matches)
    m.addEventListener('change', on); return () => m.removeEventListener('change', on)
  }, [])
  return phone
}

const BOOT = [
  `Enlazando boletín hidrológico ${data.meta.boletin}`,
  `${data.reservoirs.length} embalses · ${fmt(n.c)} hm³ de capacidad`,
  `${data.rain.length} pluviómetros · ${data.flows.length} estaciones de aforo`,
  'Calibrando cuencas hidrográficas',
]

function Boot({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1200); return () => clearTimeout(t) }, [onDone])
  return (
    <motion.div className="boot" onClick={onDone} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div className="boot-box">
        <motion.h1 initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.18em' }} transition={{ duration: 0.8 }}>CAUDAL</motion.h1>
        <ul>
          {BOOT.map((l, i) => <motion.li key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.25 }}><i />{l}</motion.li>)}
        </ul>
        <div className="boot-bar"><motion.i initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.1, ease: 'easeInOut' }} /></div>
      </div>
    </motion.div>
  )
}

export default function App() {
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const [boot, setBoot] = useState(!reduce)
  const [sel, setSel] = useState<Sel | null>(() => fromKey(location.hash))
  const [layer, setLayer] = useState<Layer>(() => { const s = fromKey(location.hash); return s ? layerFor(s, 'agua') : 'agua' })
  const [dir, setDir] = useState(1)
  const [isNew, setIsNew] = useState(false)
  const [toast, setToast] = useState<Milestone | null>(null)
  const [sources, setSources] = useState(false)
  const [sheet, setSheet] = useState(false)
  const { seen, resSeen, discover } = useCollection()
  useRivers() // al llegar los ríos se repinta, por si el enlace apuntaba a uno
  const toastTimer = useRef(0)
  const endBoot = useCallback(() => setBoot(false), [])

  const pick = useCallback((s: Sel | null, d = 1) => {
    setDir(d); setSel(s)
    if (s) {
      setLayer(l => layerFor(s, l))
      const { fresh, milestone } = discover(s)
      setIsNew(fresh)
      if (milestone) { setToast(milestone); clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 3600) }
      setSheet(false)
    }
    try { history.replaceState(null, '', s ? `#${selKey(s)}` : location.pathname + location.search) } catch { /* el visor puede no dejar tocar la URL */ }
  }, [discover])

  const changeLayer = (l: Layer) => { setLayer(l); if (sel && layerFor(sel, l) !== l) pick(null) }

  const first = useRef(true)
  useEffect(() => {
    if (!first.current) return
    first.current = false
    if (sel) setIsNew(discover(sel).fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selRef = useRef(sel); selRef.current = sel
  useEffect(() => {
    const onHash = () => { const s = fromKey(location.hash); if (!sameSel(s, selRef.current)) pick(s) }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const i = Number(e.key) - 1
      if (i >= 0 && i < LAYERS.length) changeLayer(LAYERS[i].id)
      if (e.key === 'Escape') { setSources(false); pick(null) }
      if (e.key === '/') { e.preventDefault(); document.getElementById('buscar')?.focus() }
      if (e.key === 'r' || e.key === 'R') pick(randomSel(layer, seen))
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && selRef.current) document.querySelector<HTMLButtonElement>(`.sel-nav button[aria-label="${e.key === 'ArrowRight' ? 'Siguiente' : 'Anterior'}"]`)?.click()
    }
    addEventListener('hashchange', onHash); addEventListener('keydown', onKey)
    return () => { removeEventListener('hashchange', onHash); removeEventListener('keydown', onKey) }
  })

  const card = sel && <SelCard key={selKey(sel)} sel={sel} onPick={pick} isNew={isNew} compact={phone} dir={dir} />
  const progress = resSeen / data.reservoirs.length

  return (
    <main className="game">
      <Board layer={layer} sel={sel} onPick={s => pick(s)} seen={seen} onDice={() => pick(randomSel(layer, seen))} />
      <div className="vignette" aria-hidden />

      <header className="hud-top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Caudal</h1>
          <p>Red hidrológica de España · {fechaLarga}</p>
        </div>
        <ul className="res" aria-label="Indicadores nacionales">
          <li className="res-water"><Droplets size={16} aria-hidden /><div><span>Reserva <Info k="reserva" /></span><b><CountUp value={n.a} ms={1800} /> <small>hm³</small></b><em>{fmtPct((n.a / n.c) * 100)} · <i className={n.d >= 0 ? 'up' : 'down'}>{n.d >= 0 ? '+' : '−'}{fmt(Math.abs(n.d))}</i></em></div></li>
          <li className="res-energy"><Zap size={16} aria-hidden /><div><span>Energía <Info k="energia" /></span><b><CountUp value={energyTotals.e} ms={1800} /> <small>GWh</small></b><em>{fmtPct((energyTotals.e / energyTotals.ec) * 100)} de carga</em></div></li>
          <li className="res-avg"><Activity size={16} aria-hidden /><div><span>Vs. media <Info k="media10" /></span><b>{n.a >= n.avg10 ? '+' : '−'}{fmt(Math.abs((n.a / n.avg10 - 1) * 100))} <small>%</small></b><em>diez años</em></div></li>
          <li className="res-rain"><CloudRain size={16} aria-hidden /><div><span>Lluvia máx.</span><b>{fmt(wettest.p)} <small>l/m²</small></b><em>{wettest.n}</em></div></li>
          <li className="res-col" title="Embalses que has abierto">
            <span className="ring" style={{ ['--p' as string]: `${progress * 360}deg` }}><Trophy size={13} aria-hidden /></span>
            <div><span>Explorados</span><b>{resSeen}<small>/{data.reservoirs.length}</small></b></div>
          </li>
        </ul>
      </header>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" role="status" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
            <Trophy size={20} aria-hidden /><div><b>{toast.title}</b><span>{toast.line}</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className={`panel ${sheet ? 'is-open' : ''} ${phone && sel ? 'is-hidden' : ''}`} aria-label="Consola de datos">
        <button className="sheet-handle" onClick={() => setSheet(s => !s)} aria-expanded={sheet}>
          <ChevronUp size={17} className={sheet ? 'flip' : ''} aria-hidden /> {sheet ? 'Ocultar consola' : 'Consola: resumen, histórico y rankings'}
        </button>
        <Panel layer={layer} onPick={pick} sel={sel} card={phone ? null : card} />
      </aside>

      <AnimatePresence mode="popLayout">
        {phone && sel ? (
          <motion.div key="peek" className="peek" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <AnimatePresence mode="popLayout" initial={false}>{card}</AnimatePresence>
          </motion.div>
        ) : (
          <motion.nav key="hotbar" className="hotbar" aria-label="Capas del mapa" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}>
            {LAYERS.map((l, i) => {
              const Icon = l.icon
              return (
                <button key={l.id} className={`slot slot-${l.id} ${layer === l.id ? 'is-on' : ''}`} onClick={() => changeLayer(l.id)} aria-pressed={layer === l.id}>
                  <kbd>{i + 1}</kbd><Icon size={19} aria-hidden /><span className="l-largo">{l.label}</span>{l.short && <span className="l-corto" aria-hidden>{l.short}</span>}
                  {layer === l.id && <motion.i layoutId="slot-glow" className="slot-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                </button>
              )
            })}
            <button className="slot slot-info" onClick={() => setSources(true)}><InfoIcon size={18} aria-hidden /><span>Fuentes</span></button>
          </motion.nav>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sources && (
          <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSources(false)}>
            <motion.div className="modal" role="dialog" aria-modal="true" aria-labelledby="src-title" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <header className="card-head"><h2 id="src-title">De dónde sale cada número</h2><button className="icon-btn" onClick={() => setSources(false)} aria-label="Cerrar"><X size={18} /></button></header>
              <ul className="src">
                <li><b>Embalses y energía embalsada.</b> <A id="boletin">Boletín Hidrológico semanal</A> del Ministerio para la Transición Ecológica, nº {data.meta.boletin}: {data.reservoirs.length} embalses peninsulares de más de 5 hm³.</li>
                <li><b>Histórico.</b> <A id="embalses_bd">Base de datos de embalses</A> del ministerio (semanal desde 1988 hasta febrero de 2026) y totales semanales de 2026 del mismo boletín.</li>
                <li><b>Comparativas nacionales.</b> Nota semanal del ministerio: hace un año, {fmt(n.prevYear)} hm³; media de diez años, {fmt(n.avg10)} hm³.</li>
                <li><b>Presas.</b> <A id="presas">Inventario de Presas y Embalses</A> del ministerio: río y altura desde cimientos, cuando consta.</li>
                <li><b>Lluvia.</b> Precipitación semanal en {data.rain.length} observatorios principales de <A id="aemet">AEMET</A>, recogida en el boletín.</li>
                <li><b>Ríos.</b> Caudal medio semanal en {data.flows.length} estaciones de aforo y salidas de embalse del boletín.</li>
                <li><b>Abastecimiento.</b> <A id="ine_agua">Estadística sobre el Suministro y Saneamiento del Agua</A> del INE, año {consumo.year}: agua que entra en la red, la registrada, las pérdidas y el consumo de los hogares por comunidad autónoma. No hay datos oficiales por municipio para toda España.</li>
                <li><b>Depuración.</b> La misma estadística del INE: agua residual tratada y reutilizada por comunidad, destino del agua depurada y kilómetros de alcantarillado. El mapa de depuradoras del ministerio llegará en otra versión.</li>
                <li><b>Vertidos.</b> <A id="vertidos">Censo Nacional de Vertidos</A>: volumen anual autorizado, que no equivale al consumo.</li>
                {data.hydro && <li><b>Producción hidráulica.</b> <A id="ree_generacion">REData de Red Eléctrica</A>.</li>}
                <li><b>Equivalencias.</b> Piscina olímpica de 2.500 m³, bañera de 150 litros, hogar de unos 3.500 kWh al año: aproximaciones para hacerse una idea.</li>
                <li><b>Mapa.</b> Demarcaciones hidrográficas del ministerio; red de ríos y canales del IGN (<A id="siane">SIANE</A>, escala 1:3 millones, CC BY 4.0); siluetas de embalses del IGN y del ministerio.</li>
              </ul>
              <p className="unit">Tu colección de embalses explorados se guarda solo en este navegador. Caudal es un proyecto independiente de IstariCore, no una web oficial.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{boot && <Boot onDone={endBoot} />}</AnimatePresence>
    </main>
  )
}
