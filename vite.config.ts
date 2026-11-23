import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Una página por tema: la portada en la raíz y cada tema en su carpeta (agua/, energia/…).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { portada: resolve(__dirname, 'index.html'), agua: resolve(__dirname, 'agua/index.html'), gasolineras: resolve(__dirname, 'gasolineras/index.html'), poblacion: resolve(__dirname, 'poblacion/index.html'), economia: resolve(__dirname, 'economia/index.html'), energia: resolve(__dirname, 'energia/index.html'), comercio: resolve(__dirname, 'comercio/index.html'), vivienda: resolve(__dirname, 'vivienda/index.html'), cuentas: resolve(__dirname, 'cuentas/index.html'), subvenciones: resolve(__dirname, 'subvenciones/index.html'), impuestos: resolve(__dirname, 'impuestos/index.html') } },
  },
})
