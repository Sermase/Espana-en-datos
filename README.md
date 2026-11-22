# España en datos

Datos oficiales de España para explorar como un tablero de mando. Web pública, sin registro: React 19, Vite, TypeScript, Tailwind 4, Motion y Lucide.

Cada tema es una página propia con su vista principal y su color:

| Tema | Carpeta | Vista | Estado |
|---|---|---|---|
| Agua (Caudal) | `agua/`, `src/agua/` | mapa | abierto, ver [docs/caudal.md](docs/caudal.md) |
| Energía | — | paneles y series | en preparación |
| Economía | — | paneles y series | en preparación |
| Población | — | pirámides y flujos | en preparación |
| Carreteras | — | mapa | en preparación |
| Montaña y nieve | — | relieve 3D | en preparación |

La lista y los colores de los temas están en `src/temas.ts`; la portada (`index.html`, `src/portada/`) se monta sola a partir de ella.

## Datos

El workflow `.github/workflows/datos.yml` ejecuta `scripts/update-data.mjs` cada día y los martes por la tarde, guarda los datos nuevos en el repo y publica en GitHub Pages. Un tema solo se publica si sus datos se actualizan solos.

Para activarlo: **Settings → Pages → Source: GitHub Actions**.

## Desarrollo

```sh
npm ci
npm run dev        # portada en /, agua en /agua/
npm run build
node scripts/update-data.mjs
```

## Añadir un tema

1. Página `<tema>/index.html` y código en `src/<tema>/`.
2. Entrada en `rollupOptions.input` de `vite.config.ts`.
3. `ruta` en su entrada de `src/temas.ts`.
4. Su paso de descarga en `scripts/` y en el workflow, con un resumen en `src/resumen.json` para la portada.
