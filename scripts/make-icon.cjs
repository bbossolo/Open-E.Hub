/**
 * Genera l'ICONA dell'app dal MARCHIO ε GOLDEN (src/shared/ui/brand-mark.ts) — unica fonte
 * di verità. Così l'icona dell'eseguibile è SEMPRE il logo aggiornato. ε nero + punto rosso
 * identitario + contorno bianco (leggibile su dock chiaro/scuro). Rasterizza via Electron.
 *
 *  - assets/icon.png     1024²  sfondo TRASPARENTE  → macOS (dock a squircle)
 *  - assets/icon-win.png 1024²  sfondo BIANCO       → Windows (niente trasparenza in barra/explorer)
 *
 * Uso: npx electron scripts/make-icon.cjs
 */
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { tmpdir } = require('node:os')

const ROOT = resolve(__dirname, '..')
const brand = readFileSync(resolve(ROOT, 'src/shared/ui/brand-mark.ts'), 'utf8')
const pick = (re, label) => { const m = brand.match(re); if (!m) throw new Error('brand-mark: manca ' + label); return m[1] }
const VIEWBOX = pick(/EHUB_MARK_VIEWBOX\s*=\s*'([^']+)'/, 'VIEWBOX')
const PATH = pick(/EHUB_MARK_PATH\s*=\s*\n?\s*'([^']+)'/, 'PATH')
const dotSrc = pick(/EHUB_MARK_DOT\s*=\s*\{([^}]+)\}/, 'DOT')
const num = (k) => Number((dotSrc.match(new RegExp(k + '\\s*:\\s*([\\d.]+)')) || [])[1])
const fill = (dotSrc.match(/fill\s*:\s*'([^']+)'/) || [])[1] || '#e5484d'
const DOT = { cx: num('cx'), cy: num('cy'), r: num('r'), fill }

// 1024² con il marchio centrato (SVG annidato: scala/centra automaticamente dal viewBox).
const SIZE = 1024, INNER = 800, off = (SIZE - INNER) / 2
const svg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Open E.Hub app icon">
  <svg x="${off}" y="${off}" width="${INNER}" height="${INNER}" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
    <path d="${PATH}" fill="#0c0f14" stroke="#ffffff" stroke-width="10" paint-order="stroke" stroke-linejoin="round"/>
    <circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${DOT.fill}" stroke="#ffffff" stroke-width="10" paint-order="stroke"/>
  </svg>
</svg>`
writeFileSync(resolve(ROOT, 'assets/icon.svg'), svg + '\n')

// Rasterizza un SVG a PNG con lo sfondo dato ('transparent' oppure '#ffffff').
async function rasterize(bg) {
  const win = new BrowserWindow({
    width: SIZE, height: SIZE, show: false, frame: false, transparent: true,
    backgroundColor: '#00000000', useContentSize: true,
    webPreferences: { offscreen: true },
  })
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;padding:0;width:${SIZE}px;height:${SIZE}px;background:${bg}}</style></head>
    <body>${svg}</body></html>`
  const htmlPath = resolve(tmpdir(), `ehub-icon-${bg === 'transparent' ? 'mac' : 'win'}.html`)
  writeFileSync(htmlPath, html)
  await win.loadFile(htmlPath)
  await new Promise(r => setTimeout(r, 400))
  const img = await win.webContents.capturePage()
  win.destroy()
  return img
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const mac = await rasterize('transparent')
  writeFileSync(resolve(ROOT, 'assets/icon.png'), mac.toPNG())
  const winIco = await rasterize('#ffffff')
  writeFileSync(resolve(ROOT, 'assets/icon-win.png'), winIco.toPNG())
  const s = mac.getSize()
  console.log(`✓ assets/icon.svg + icon.png (mac, trasparente) + icon-win.png (Windows, bianco) ${s.width}x${s.height} dal marchio ε golden`)
  app.quit()
})
