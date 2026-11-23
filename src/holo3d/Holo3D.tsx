import { useEffect, useRef } from 'react'
import './holo3d.css'

/**
 * Holograma de alambre en 3D, dibujado a mano en SVG (sin WebGL ni filtros):
 * cada modelo devuelve segmentos 3D para el instante t y aquí se giran, se proyectan
 * y se pintan en dos trazos (nítido y tenue) a 30 imágenes por segundo como mucho.
 */
export type Seg = [number, number, number, number, number, number]
export type Escena = { fuerte: Seg[]; tenue: Seg[]; puntos?: [number, number, number][] }
export type Modelo = (t: number) => Escena

type Props = { modelo: Modelo; color: string; alto?: number; giro?: number; etiqueta?: string; className?: string }

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function Holo3D({ modelo, color, alto = 260, giro = 0.25, etiqueta, className = '' }: Props) {
  const fuerte = useRef<SVGPathElement>(null), glow = useRef<SVGPathElement>(null), tenue = useRef<SVGPathElement>(null), pts = useRef<SVGPathElement>(null), base = useRef<SVGPathElement>(null)
  const mod = useRef(modelo); mod.current = modelo
  useEffect(() => {
    let raf = 0, last = 0, vivo = true
    const W = 300, H = alto, cx = W / 2, cy = H * 0.78, S = H * 0.62, tilt = 0.32
    const ct = Math.cos(tilt), st = Math.sin(tilt)
    const proj = (x: number, y: number, z: number, ca: number, sa: number) => {
      const X = x * ca - z * sa, Z = x * sa + z * ca
      const Y = y * ct - Z * st, D = Z * ct + y * st
      const k = 1 / (1 + D * 0.18)
      return [cx + X * S * k, cy - Y * S * k] as const
    }
    const dibuja = (ms: number) => {
      const t = ms / 1000, a = t * giro, ca = Math.cos(a), sa = Math.sin(a)
      const e = mod.current(t)
      const d = (segs: Seg[]) => { let s = ''; for (const g of segs) { const p = proj(g[0], g[1], g[2], ca, sa), q = proj(g[3], g[4], g[5], ca, sa); s += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}` } return s }
      const df = d(e.fuerte); fuerte.current?.setAttribute('d', df); glow.current?.setAttribute('d', df)
      tenue.current?.setAttribute('d', d(e.tenue))
      if (pts.current) { let s = ''; for (const p of e.puntos ?? []) { const q = proj(p[0], p[1], p[2], ca, sa); s += `M${q[0].toFixed(1)} ${q[1].toFixed(1)}h.1` } pts.current.setAttribute('d', s) }
      if (base.current) { // disco del suelo: anillos y radios que giran con la pieza
        const segs: Seg[] = []
        for (const r of [0.62, 0.78]) for (let i = 0; i < 48; i++) { const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2; segs.push([Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r]) }
        for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2; segs.push([Math.cos(a0) * 0.74, 0, Math.sin(a0) * 0.74, Math.cos(a0) * 0.78, 0, Math.sin(a0) * 0.78]) }
        base.current.setAttribute('d', d(segs))
      }
    }
    const loop = (ms: number) => {
      if (!vivo) return
      if (ms - last > 33) { last = ms; dibuja(ms) }
      raf = requestAnimationFrame(loop)
    }
    if (reduced()) dibuja(2000); else raf = requestAnimationFrame(loop)
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduced()) raf = requestAnimationFrame(loop) }
    document.addEventListener('visibilitychange', vis)
    return () => { vivo = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis) }
  }, [alto, giro])
  return (
    <div className={`h3d ${className}`} style={{ ['--h3' as string]: color }}>
      <svg viewBox={`0 0 300 ${alto}`} role="img" aria-label={etiqueta ?? 'Holograma'}>
        <defs><radialGradient id="h3d-luz" cx="50%" cy="80%" r="50%"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="150" cy={alto * 0.78} rx="130" ry="34" fill="url(#h3d-luz)" />
        <path ref={base} className="h3d-base" />
        <path ref={tenue} className="h3d-tenue" />
        <path ref={glow} className="h3d-glow" />
        <path ref={fuerte} className="h3d-fuerte" />
        <path ref={pts} className="h3d-pts" />
      </svg>
    </div>
  )
}
