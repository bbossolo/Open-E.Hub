import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { DxfBuilder, dxfBegin, dxfEnd, line, rect, polyline, circle, dtext } from '../../src/shared/dxf'
import { dxfCartiglioBanda, textOutline, HIDDEN_TEXT_LAYER_DEF } from '../../src/shared/dxf-doc'
import { buildCoverDxf } from '../../src/tools/delta/engine/dxf-export'
import type { PageVectors } from '../../src/shared/dxf-from-pdf'

/**
 * VALIDAZIONE «di realtà» del DXF: apre gli export con `ezdxf` (parser rigido tipo-AutoCAD)
 * ed esegue l'audit. È la garanzia — mai avuta prima — che i CAD severi su Windows
 * (AutoCAD/GstarCAD/Eplus) accettino i file, non solo i viewer permissivi del Mac.
 *
 * Skippa automaticamente se python3/ezdxf non ci sono (la CI senza ezdxf non si rompe;
 * dove c'è, `scripts/dxf-validate.py` esce ≠0 sugli errori bloccanti facendo fallire il test).
 */
const SCRIPT = resolve(__dirname, '../../scripts/dxf-validate.py')

function ezdxfAvailable(): boolean {
  try {
    execFileSync('python3', ['-c', 'import ezdxf'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Un DXF che esercita TUTTE le primitive condivise (line/rect/polyline/circle/dtext/testo-contorni/cartiglio). */
function sampleDxf(): string {
  const b = new DxfBuilder(600)
  dxfBegin(b, {
    extMax: [400, 600],
    layers: [{ name: 'DIS', color: 7 }, { name: 'ROSSO', color: 1, lineweight: 50 },
      { name: 'CARTIGLIO', color: 7 }, HIDDEN_TEXT_LAYER_DEF],
  })
  line(b, 'DIS', 10, 10, 200, 10, { lineweight: 35 })
  rect(b, 'DIS', 20, 20, 100, 60)
  polyline(b, 'ROSSO', [[0, 0], [50, 50], [100, 0]], true)
  circle(b, 'DIS', 150, 150, 20)
  dtext(b, 'DIS', 30, 30, 5, 'CIAO π φ ω')
  textOutline(b, 'CARTIGLIO', 40, 300, 6, 'Testo a contorni')
  dxfCartiglioBanda(b, { x: 10, y: 560, w: 380, h: 24, scale: 1, toolTag: 'μ Prezzi', title: 'Titolo', subtitle: 'Sub', disclaimer: 'Disc' })
  return dxfEnd(b)
}

/** Cartiglio δ (vettoriale + testo) — deve superare l'audit ezdxf come gli altri export. */
function realDeltaCartiglio(): string {
  const base: PageVectors = {
    widthPt: 595, heightPt: 842, images: [],
    paths: [{ pts: [[10, 10], [585, 10], [585, 832], [10, 832]], closed: true }, { pts: [[10, 700], [585, 700]], closed: false }],
    texts: [{ x: 20, y: 760, h: 10, str: 'Committente:', rot: 0 }, { x: 20, y: 60, h: 8, str: 'scala:', rot: 0 }],
  }
  return buildCoverDxf(base, [
    { text: 'DEMO-01', x: 0.7, y: 0.2, anchor: 'ml', align: 'left', fontFrac: 0.03, bold: false },
    { text: 'GEN-EL01a', x: 0.5, y: 0.85, anchor: 'ml', align: 'left', fontFrac: 0.02, bold: false },
  ])
}

const cases: Record<string, () => string> = {
  'sample.dxf': sampleDxf,
  'delta-cartiglio.dxf': realDeltaCartiglio,
}

describe('export DXF — audit ezdxf (accettato dai CAD rigidi)', () => {
  const available = ezdxfAvailable()
  const dir = mkdtempSync(join(tmpdir(), 'ehub-dxf-'))
  const paths: Record<string, string> = {}

  beforeAll(() => {
    for (const [name, gen] of Object.entries(cases)) {
      const p = join(dir, name)
      writeFileSync(p, gen())
      paths[name] = p
    }
  })

  for (const name of Object.keys(cases)) {
    it.skipIf(!available)(`${name}: ezdxf.readfile + audit senza errori bloccanti`, () => {
      // scripts/dxf-validate.py esce 0 solo se l'audit non ha ERRORI (i «fix» non contano).
      const out = execFileSync('python3', [SCRIPT, paths[name]], { encoding: 'utf8' })
      expect(out).toContain('OK')
    })
  }

  it('la struttura R2004 è completa (guardia sempre attiva, senza ezdxf)', () => {
    const dxf = sampleDxf()
    // Sezioni e tabelle obbligatorie che i lettori rigidi pretendono da AC1018.
    for (const tok of ['$HANDSEED', 'OBJECTS', 'AcDbSymbolTable', 'STANDARD', 'APPID', 'ACAD',
      'BLOCK_RECORD', '*Model_Space', 'AcDbDictionary']) {
      expect(dxf).toContain(tok)
    }
    // Ogni entità deve avere un handle (group 5) subito dopo il tipo.
    const lines = dxf.split('\r\n')
    for (let i = 0; i < lines.length - 1; i++) {
      if (['LINE', 'LWPOLYLINE', 'CIRCLE', 'TEXT'].includes(lines[i]) && lines[i - 1] === '0') {
        expect(lines[i + 1]).toBe('5')
      }
    }
  })
})
