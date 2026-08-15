/**
 * Estrae i CONTORNI dei glifi (polilinee chiuse, unità em, Y verso l'alto) dai font
 * della suite e genera `src/shared/dxf-glyphs.ts` (committato): è la base del testo
 * «contorni pieni» negli export DXF fedeli al PDF (golden standard utente).
 *
 * Font sorgente (già in repo, nessun download):
 *  - Arimo 400/700 — base64 woff2 in src/shared/doc/pdf-font.ts (il font dei PDF)
 *  - JetBrains Mono — src/shared/ui/fonts/jetbrains-mono-{latin,greek}.woff2
 *
 * Solo build-time: devDeps opentype.js + wawoff2. Runtime resta zero-dependencies.
 * Uso: npm run build:dxf-glyphs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decompress } from 'wawoff2'
import { parse as otParse, type Font } from 'opentype.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Charset: ASCII stampabile + accentate ITA + simboli dei documenti + greche dei tool. */
const CHARSET = (() => {
  let s = ''
  for (let c = 32; c <= 126; c++) s += String.fromCharCode(c)
  s += 'àáâèéêìíòóôùúçÀÈÉÌÒÙ°×·—’Ø±'
  s += 'πφωμτλεΩ'
  return [...new Set([...s])]
})()

/** Appiattisce le curve del path opentype in contorni di punti (unità font, Y-up). */
function pathToContours(cmds: Array<Record<string, number | string>>, upem: number): number[][][] {
  const out: number[][][] = []
  let cur: number[][] = []
  let x = 0, y = 0, sx = 0, sy = 0
  const N = 8 // suddivisioni per curva: a 1000 upem ≈ tolleranza 1/50 em, più che sufficiente
  const pt = (px: number, py: number) => cur.push([+(px / upem).toFixed(4), +(py / upem).toFixed(4)])
  for (const c of cmds) {
    const t = c.type as string
    if (t === 'M') { if (cur.length > 2) out.push(cur); cur = []; x = sx = c.x as number; y = sy = c.y as number; pt(x, y) }
    else if (t === 'L') { x = c.x as number; y = c.y as number; pt(x, y) }
    else if (t === 'Q') {
      const x1 = c.x1 as number, y1 = c.y1 as number, X = c.x as number, Y = c.y as number
      for (let i = 1; i <= N; i++) {
        const u = i / N, v = 1 - u
        pt(v * v * x + 2 * v * u * x1 + u * u * X, v * v * y + 2 * v * u * y1 + u * u * Y)
      }
      x = X; y = Y
    } else if (t === 'C') {
      const x1 = c.x1 as number, y1 = c.y1 as number, x2 = c.x2 as number, y2 = c.y2 as number, X = c.x as number, Y = c.y as number
      for (let i = 1; i <= N; i++) {
        const u = i / N, v = 1 - u
        pt(v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * X,
           v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * Y)
      }
      x = X; y = Y
    } else if (t === 'Z') { x = sx; y = sy; if (cur.length > 2) out.push(cur); cur = [] }
  }
  if (cur.length > 2) out.push(cur)
  return out
}

async function loadFont(woff2: Buffer): Promise<Font> {
  const ttf = await decompress(woff2)
  return otParse(new Uint8Array(ttf).buffer)
}

/** Estrae un glifo (advance + contorni) da una catena di font (primo che ha il carattere). */
function extractGlyph(chain: Font[], ch: string): { adv: number; c: number[][][] } | null {
  for (const f of chain) {
    const g = f.charToGlyph(ch)
    if (!g || g.index === 0) continue
    const upem = f.unitsPerEm
    return { adv: +((g.advanceWidth ?? upem * 0.5) / upem).toFixed(4), c: pathToContours(g.path.commands as never, upem) }
  }
  return null
}

async function main() {
  // Arimo 400/700 dal CSS base64 dei PDF (ordine dei @font-face: 400 poi 700).
  const pdfFontTs = readFileSync(resolve(ROOT, 'src/shared/doc/pdf-font.ts'), 'utf8')
  const b64s = [...pdfFontTs.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g)].map(m => m[1])
  if (b64s.length < 2) throw new Error('Arimo base64 non trovati in pdf-font.ts')
  const arimo = await loadFont(Buffer.from(b64s[0], 'base64'))
  const arimoBold = await loadFont(Buffer.from(b64s[1], 'base64'))
  const jbLatin = await loadFont(readFileSync(resolve(ROOT, 'src/shared/ui/fonts/jetbrains-mono-latin.woff2')))
  const jbGreek = await loadFont(readFileSync(resolve(ROOT, 'src/shared/ui/fonts/jetbrains-mono-greek.woff2')))

  // Catene di fallback: le greche mancano nel subset latino di Arimo → JB greek.
  const faces: Array<[string, Font[]]> = [
    ['arimo', [arimo, jbLatin, jbGreek]],
    ['arimo-bold', [arimoBold, jbLatin, jbGreek]],
    ['mono', [jbLatin, jbGreek, arimo]],
  ]

  const lines: string[] = []
  lines.push('/**')
  lines.push(' * GENERATO da scripts/build-dxf-glyphs.ts — NON editare a mano.')
  lines.push(' * Contorni glifi (unità em, Y verso l\'alto, origine sulla baseline) per il testo')
  lines.push(' * «contorni pieni» degli export DXF. Font: Arimo 400/700 (PDF) + JetBrains Mono.')
  lines.push(' */')
  lines.push('')
  lines.push('/** Un glifo: advance width (em) + contorni chiusi [ [x,y], … ] in em. */')
  lines.push('export interface DxfGlyph { adv: number; c: number[][][] }')
  lines.push('')
  lines.push("export type DxfFontFace = 'arimo' | 'arimo-bold' | 'mono'")
  lines.push('')
  for (const [name, chain] of faces) {
    const entries: string[] = []
    for (const ch of CHARSET) {
      const g = extractGlyph(chain, ch)
      if (!g) continue
      entries.push(`${JSON.stringify(ch)}:${JSON.stringify(g).replace(/"/g, '')}`)
    }
    const constName = name.toUpperCase().replace(/-/g, '_')
    lines.push(`const ${constName}: Record<string, DxfGlyph> = {`)
    lines.push(entries.join(',\n'))
    lines.push('}')
    lines.push('')
  }
  lines.push('export const DXF_FONTS: Record<DxfFontFace, Record<string, DxfGlyph>> = {')
  lines.push("  'arimo': ARIMO, 'arimo-bold': ARIMO_BOLD, 'mono': MONO,")
  lines.push('}')
  lines.push('')

  const outPath = resolve(ROOT, 'src/shared/dxf-glyphs.ts')
  writeFileSync(outPath, lines.join('\n'))
  const kb = Math.round(Buffer.byteLength(lines.join('\n')) / 1024)
  console.log(`✓ ${outPath} — ${CHARSET.length} caratteri × 3 face, ${kb} KB`)
}

main().catch(e => { console.error(e); process.exit(1) })
