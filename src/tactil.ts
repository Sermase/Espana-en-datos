import './tactil.css'

/**
 * En el móvil, el dedo queda «capturado» por el elemento que tocó primero, así que al arrastrarlo por un gráfico
 * las demás columnas, cintas o provincias no se enteran. Soltando esa captura, el dato sigue al dedo.
 * (Los gráficos dejan el desplazamiento vertical al navegador con touch-action: pan-y.)
 */
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return
  const t = e.target as Element | null
  if (t && t.closest('figure, .g-fig, .mp-plot, .mm-plot, .amapa, .sk, svg')) { try { t.releasePointerCapture(e.pointerId) } catch { /* sin captura */ } }
}, true)

/* La web se puede instalar como app: el service worker guarda lo último que se vio para abrirla sin conexión. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => { navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => { /* sin app: la web va igual */ }) })
}
/** El aviso de «instalar» del navegador se guarda para el botón de la portada (solo donde lo hay; en el resto, el navegador lo enseña a su manera). */
export type AvisoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
declare global { interface Window { __instalar?: AvisoInstalar } }
addEventListener('beforeinstallprompt', e => {
  if (!document.querySelector('[data-boton-instalar]')) return
  e.preventDefault(); window.__instalar = e as AvisoInstalar; dispatchEvent(new Event('instalable'))
})
addEventListener('appinstalled', () => { window.__instalar = undefined; dispatchEvent(new Event('instalada')) })
