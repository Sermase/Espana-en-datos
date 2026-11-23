import { useEffect, useRef } from 'react'
import { animate } from 'motion'
import { reduced } from './util'

/** Número que cuenta hasta su valor cuando aparece. */
export function CountUp({ value, fmt, start = true, delay = 0, duration = 1.1 }: { value: number; fmt: (v: number) => string; start?: boolean; delay?: number; duration?: number }) {
  const el = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const f = useRef(fmt); f.current = fmt
  useEffect(() => {
    const node = el.current; if (!node) return
    const fmt = f.current
    if (!start) { node.textContent = fmt(from.current); return }
    if (reduced()) { node.textContent = fmt(value); from.current = value; return }
    const c = animate(from.current, value, { duration, delay, ease: [0.2, 0.8, 0.2, 1], onUpdate: v => { node.textContent = fmt(v) } })
    from.current = value
    return () => c.stop()
  }, [value, start, delay, duration])
  return <span ref={el}>{fmt(start ? 0 : value)}</span>
}
