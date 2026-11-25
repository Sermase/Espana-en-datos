import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/** Todas las páginas llevan lo necesario para instalar la web como app (manifiesto, iconos, color de la barra). */
const app = (): Plugin => ({
  name: 'app-instalable',
  transformIndexHtml(html, ctx) {
    const raiz = '../'.repeat(Math.max(0, ctx.path.split('/').filter(Boolean).length - 1)) || './'
    return html.replace('</head>', `    <link rel="manifest" href="${raiz}manifest.webmanifest" />
    <meta name="theme-color" content="#03090f" />
    <link rel="apple-touch-icon" href="${raiz}iconos/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="España en datos" />
  </head>`)
  },
})

// Una página por tema: la portada en la raíz y cada tema en su carpeta (agua/, energia/…).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), app()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { portada: resolve(__dirname, 'index.html'), agua: resolve(__dirname, 'agua/index.html'), gasolineras: resolve(__dirname, 'gasolineras/index.html'), poblacion: resolve(__dirname, 'poblacion/index.html'), economia: resolve(__dirname, 'economia/index.html'), energia: resolve(__dirname, 'energia/index.html'), comercio: resolve(__dirname, 'comercio/index.html'), vivienda: resolve(__dirname, 'vivienda/index.html'), cuentas: resolve(__dirname, 'cuentas/index.html'), subvenciones: resolve(__dirname, 'subvenciones/index.html'), impuestos: resolve(__dirname, 'impuestos/index.html'), seguridad: resolve(__dirname, 'seguridad/index.html'), aire: resolve(__dirname, 'aire/index.html'), hogares: resolve(__dirname, 'hogares/index.html'), coches: resolve(__dirname, 'coches/index.html'), igualdad: resolve(__dirname, 'igualdad/index.html'), turismo: resolve(__dirname, 'turismo/index.html'), acerca: resolve(__dirname, 'acerca/index.html') } },
  },
})
