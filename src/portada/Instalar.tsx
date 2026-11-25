import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, Share, SquarePlus, X } from 'lucide-react'

const instalada = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * Botón «Instalar app». En Chrome, Edge y Android usa el aviso del propio navegador; en iPhone y iPad, que no lo
 * tienen, explica los dos toques de Safari. Si ya está instalada o el navegador no sabe instalar webs, no sale.
 */
export function Instalar() {
  const [puede, setPuede] = useState(() => !!window.__instalar)
  const [ios] = useState(() => esIOS() && !instalada())
  const [ayuda, setAyuda] = useState(false), [hecho, setHecho] = useState(instalada())
  useEffect(() => {
    const si = () => setPuede(true), ya = () => { setPuede(false); setHecho(true) }
    addEventListener('instalable', si); addEventListener('instalada', ya)
    return () => { removeEventListener('instalable', si); removeEventListener('instalada', ya) }
  }, [])
  if (hecho || (!puede && !ios)) return null
  const pulsa = async () => {
    if (window.__instalar) { const e = window.__instalar; await e.prompt(); const r = await e.userChoice; if (r.outcome === 'accepted') setHecho(true); window.__instalar = undefined; setPuede(false) }
    else setAyuda(true)
  }
  return <>
    <button className="instalar" onClick={pulsa}><Download size={16} /> Instalar app</button>
    <AnimatePresence>
      {ayuda && <motion.div className="inst-velo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAyuda(false)}>
        <motion.div className="inst-hoja" role="dialog" aria-modal="true" aria-labelledby="inst-t" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={e => e.stopPropagation()}>
          <button className="inst-cerrar" onClick={() => setAyuda(false)} aria-label="Cerrar"><X size={18} /></button>
          <img src="./iconos/icono-192.png" alt="" width={64} height={64} />
          <h3 id="inst-t">España en datos en tu pantalla de inicio</h3>
          <ol>
            <li>Toca <Share size={17} aria-label="Compartir" /> <b>Compartir</b>, abajo en Safari (arriba en el iPad).</li>
            <li>Elige <SquarePlus size={17} aria-hidden /> <b>Añadir a pantalla de inicio</b>.</li>
          </ol>
          <p>Se abre a pantalla completa, como una app, y sin conexión enseña lo último que viste.</p>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  </>
}
