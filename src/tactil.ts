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
