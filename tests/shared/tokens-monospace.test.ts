import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * TOKEN "MONOSPACE": base neutra + accento-da-tool
 * (docs/mockups/suite-redesign/ — shared.css, README §2–§5)
 *
 * Spec di puro token/CSS: la verifica è invariante di contratto + non-regressione,
 * non un nuovo flusso utente. Parsiamo src/shared/ui/tokens.css e asseriamo:
 *  - la base ardesia/:root (dark) è grafite NEUTRA con i valori del linguaggio;
 *  - hub è accento NEUTRO #9fb0c6 (non più rosso) e i 4 tool restano pieni;
 *  - i derivati accento e i token di tracking esistono;
 *  - --sans è alias di --mono e --prose resta distinto;
 *  - i nomi-token CANONICI consumati dal sorgente non sono stati rinominati.
 */

const SRC = resolve(__dirname, '../..')
// Normalizza CRLF→LF: su working tree Windows (git autocrlf) il file è CRLF, ma i
// selettori qui sotto sono confrontati con \n letterali → altrimenti indexOf fallirebbe.
const tokens = readFileSync(resolve(SRC, 'src/shared/ui/tokens.css'), 'utf8').replace(/\r\n/g, '\n')

/** Estrae il valore di una custom property dentro un blocco selettore dato. */
function declInBlock(css: string, selector: string, prop: string): string | null {
  // trova il blocco { … } che segue il selettore (prima occorrenza)
  const idx = css.indexOf(selector)
  if (idx === -1) return null
  const open = css.indexOf('{', idx)
  const close = css.indexOf('}', open)
  if (open === -1 || close === -1) return null
  const block = css.slice(open + 1, close)
  const re = new RegExp(`${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+);`)
  const m = block.match(re)
  return m ? m[1].trim() : null
}

describe('base ardesia grafite NEUTRA (dark, default)', () => {
  const sel = ':root,\n[data-theme="dark"],\n[data-palette="ardesia"][data-theme="dark"]'

  it('le superfici/linee/testo sono i valori grafite del linguaggio', () => {
    expect(declInBlock(tokens, sel, '--bg')).toBe('#0b0d11')
    expect(declInBlock(tokens, sel, '--panel')).toBe('#12151b')
    expect(declInBlock(tokens, sel, '--panel2')).toBe('#171b22')
    expect(declInBlock(tokens, sel, '--panel3')).toBe('#1e232c')
    expect(declInBlock(tokens, sel, '--line')).toBe('#222831')
    expect(declInBlock(tokens, sel, '--line2')).toBe('#2f3742')
    expect(declInBlock(tokens, sel, '--text')).toBe('#e7ecf2')
    expect(declInBlock(tokens, sel, '--muted')).toBe('#93a0b1')
  })

  it('introduce --line3 (bordo enfatizzato) come token di struttura', () => {
    expect(declInBlock(tokens, sel, '--line3')).toBe('#3c4654')
    // anche nel light
    const selLight = '[data-theme="light"],\n[data-palette="ardesia"][data-theme="light"]'
    expect(declInBlock(tokens, selLight, '--line3')).toBe('#8a96a8')
  })

  it('nessun colore (hue) nei token di base: bg/panel/line/text restano grafite neutra', () => {
    // i token strutturali sono grigi bluastri freddi: canale R ≈ G, B leggermente più alto,
    // mai una dominante di tinta calda/satura. Verifica che NON siano accenti saturi.
    for (const prop of ['--bg', '--panel', '--panel2', '--panel3', '--line', '--line2', '--text', '--muted', '--faint']) {
      const hex = declInBlock(tokens, sel, prop)!
      const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)!
      const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      // saturazione contenuta (struttura neutra): lo spread fra canali è piccolo
      expect(max - min).toBeLessThanOrEqual(40)
    }
  })
})

describe('accento-da-tool (un solo --accent governato da [data-tool])', () => {
  it('hub è grigio-azzurro NEUTRO #9fb0c6 (non più rosso)', () => {
    const accent = declInBlock(tokens, '[data-tool="hub"]', '--accent')
    expect(accent).toBe('#9fb0c6')
    expect(accent).not.toBe('#ef4444')
    expect(declInBlock(tokens, '[data-tool="hub"]', '--accent-h')).toBe('#bcc8d8')
    // il fallback :root coincide con hub (welcome calma)
    expect(tokens).toMatch(/:root,\s*\n\[data-tool="hub"\]\s*\{\s*--accent:\s*#9fb0c6/)
  })

  it('i 4 tool definiscono --accent e --accent-h pieni e leggibili', () => {
    const expected: Record<string, [string, string]> = {
      miu: ['#1ca371', '#2fc78d'],
      beta: ['#b02a7a', '#c74f9a'],
      delta: ['#ad1457', '#cd3a7a'],
      chi: ['#2f56c8', '#5a7ade'],
    }
    for (const [tool, [acc, accH]] of Object.entries(expected)) {
      const sel = `[data-tool="${tool}"]`
      expect(declInBlock(tokens, sel, '--accent')).toBe(acc)
      expect(declInBlock(tokens, sel, '--accent-h')).toBe(accH)
    }
  })

  it('ogni [data-tool] sovrascrive --accent/--accent-h/--on-accent (i derivati color-mix restano in :root)', () => {
    // i blocchi [data-tool] NON ridefiniscono i derivati color-mix: restano calcolati da :root.
    // --on-accent INVECE è per-tool (non derivabile da un solo valore globale: la luminanza
    // dell'accento varia troppo da tool a tool — vedi US "check UI contrasto").
    for (const tool of ['hub', 'miu', 'beta', 'delta', 'chi']) {
      const sel = `[data-tool="${tool}"]`
      expect(declInBlock(tokens, sel, '--accent-dim')).toBeNull()
      expect(declInBlock(tokens, sel, '--accent-soft')).toBeNull()
      expect(declInBlock(tokens, sel, '--on-accent')).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('i derivati accento sono definiti via color-mix (presenti, non washed-out)', () => {
    expect(tokens).toMatch(/--accent-soft:\s*color-mix\([^)]*var\(--accent\)/)
    expect(tokens).toMatch(/--accent-dim:\s*color-mix\([^)]*var\(--accent\)/)
    expect(tokens).toMatch(/--accent-line:\s*color-mix\([^)]*var\(--accent\)/)
  })

  it('--on-accent è tarato per-tool su AA ≥4.5:1 (rosa scuro δ e porpora β leggono meglio chiaro, gli altri scuro)', () => {
    const expected: Record<string, string> = {
      hub: '#000000', miu: '#000000',
      delta: '#ffffff', beta: '#ffffff', chi: '#ffffff',
    }
    for (const [tool, hex] of Object.entries(expected)) {
      expect(declInBlock(tokens, `[data-tool="${tool}"]`, '--on-accent')).toBe(hex)
    }
  })
})

describe('tipografia monospace-forward + tracking', () => {
  it('--mono è JetBrains Mono EMBEDDED (latin+greco) e --sans è alias del mono', () => {
    // Font brand embeddato (@font-face inline base64, latin + greco per i
    // glifi dei tool ε μ β δ χ α) → identico su ogni OS. Il logo ε è un <path> a parte.
    expect(tokens).toMatch(/--mono:\s*'JetBrains Mono'/)
    expect(tokens).toMatch(/@font-face[\s\S]*font-family:\s*"JetBrains Mono"/)
    expect(tokens).toMatch(/unicode-range:\s*U\+0370-03FF/) // subset greco (ε μ β …)
    expect(tokens).toMatch(/--sans:\s*var\(--mono\)/)
  })
  it('--prose (Inter) resta distinto, riservato alla prosa lunga', () => {
    expect(tokens).toMatch(/--prose:\s*'Inter'/)
  })
})

describe('documentazione "colore = funzione"', () => {
  it('il commento d\'intestazione documenta il principio', () => {
    expect(tokens).toMatch(/COLORE\s*=\s*FUNZIONE/i)
  })
})

describe('non-regressione nomi-token CANONICI', () => {
  // i nomi consumati dalle superfici tool/hub NON devono essere rinominati.
  const canonical = [
    '--radius', '--radius-sm', '--radius-lg', '--radius-pill',
    '--accent', '--accent-h', '--accent-soft', '--accent-dim', '--on-accent',
    '--shadow-1', '--shadow-2', '--shadow-3', '--shadow',
    '--bg', '--panel', '--panel2', '--panel3', '--line', '--line2',
    '--text', '--muted', '--faint',
    '--ok', '--warn', '--bad', '--ok-soft', '--warn-soft', '--bad-soft',
    '--mono', '--sans', '--prose',
  ]
  it.each(canonical)('definisce il token canonico %s', (name) => {
    // ricerca la DEFINIZIONE (name:) non un semplice riferimento var()
    const re = new RegExp(`${name.replace(/[-]/g, '\\-')}\\s*:`)
    expect(tokens).toMatch(re)
  })
})
