import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DxfBuilder, dxfBegin, dxfEnd, insertBlock, type DxfBlockToWrite } from '../../src/shared/dxf'
import { parseInserts, parseBlockDefs } from '../../src/shared/dxf-read'

/**
 * Round-trip dello SCRITTORE BLOCCHI condiviso (fase 3a): `dxfBegin({ blocks })` scrive
 * vere definizioni BLOCK (geometria + ATTDEF) con BLOCK_RECORD dedicato, `insertBlock`
 * piazza le istanze (INSERT + ATTRIB). Verifica che il lettore condiviso (`shared/dxf-read`,
 * lo stesso usato per catalogare la libreria studio) rilegga esattamente ciò che si è scritto.
 */

const PLAFONIERA: DxfBlockToWrite = {
  name: 'PL_PLAFONIERA_TEST',
  prims: [
    { kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0 },
    { kind: 'circle', cx: 5, cy: 5, r: 3 },
    { kind: 'polyline', pts: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true },
  ],
  attdefs: [{ tag: 'DESCRIZIONE', x: 0, y: -2, height: 2, default: 'Plafoniera' }],
}

function sample(): string {
  const b = new DxfBuilder(200)
  dxfBegin(b, { extMax: [200, 200], layers: [{ name: 'ELE-ILLUMINAZIONE_NORMALE', color: 3 }], blocks: [PLAFONIERA] })
  insertBlock(b, 'PL_PLAFONIERA_TEST', 50, 60, { layer: 'ELE-ILLUMINAZIONE_NORMALE', attrs: { DESCRIZIONE: 'Plafoniera 4x18W', PORTATA: '4x18W' } })
  insertBlock(b, 'PL_PLAFONIERA_TEST', 80, 60, { layer: 'ELE-ILLUMINAZIONE_NORMALE', attrs: { DESCRIZIONE: 'Plafoniera 2x18W', PORTATA: '2x18W' } })
  return dxfEnd(b)
}

describe('defineBlock/insertBlock · round-trip col lettore condiviso', () => {
  const dxf = sample()

  it('la definizione BLOCK è rileggibile (geometria + ATTDEF)', () => {
    const defs = parseBlockDefs(dxf)
    const def = defs.find(d => d.name === 'PL_PLAFONIERA_TEST')
    expect(def).toBeTruthy()
    expect(def!.prims).toHaveLength(3)
    expect(def!.prims.some(p => p.kind === 'circle')).toBe(true)
    expect(def!.attdefs.map(a => a.tag)).toContain('DESCRIZIONE')
  })

  it('le istanze INSERT sono rilette con nome, layer, posizione e attributi', () => {
    const inserts = parseInserts(dxf)
    expect(inserts).toHaveLength(2)
    const a = inserts.find(i => i.attrs.PORTATA === '4x18W')!
    expect(a.name).toBe('PL_PLAFONIERA_TEST')
    expect(a.layer).toBe('ELE-ILLUMINAZIONE_NORMALE')
    expect(a.x).toBeCloseTo(50, 1)
    expect(a.y).toBeCloseTo(140, 1) // flip Y (sheetHeight=200)
    expect(a.attrs.DESCRIZIONE).toBe('Plafoniera 4x18W')
  })
})

/** Stessa validazione «di realtà» con ezdxf usata da dxf-ezdxf.test.ts: skippa se assente. */
const SCRIPT = resolve(__dirname, '../../scripts/dxf-validate.py')
function ezdxfAvailable(): boolean {
  try { execFileSync('python3', ['-c', 'import ezdxf'], { stdio: 'ignore' }); return true } catch { return false }
}

describe('defineBlock/insertBlock · validazione ezdxf (CAD rigido)', () => {
  let has = false
  beforeAll(() => { has = ezdxfAvailable() })

  it('il DXF con blocchi/insert veri è accettato da ezdxf senza errori bloccanti', () => {
    if (!has) return
    const dir = mkdtempSync(join(tmpdir(), 'dxf-blocks-'))
    const path = join(dir, 'blocks.dxf')
    writeFileSync(path, sample())
    const out = execFileSync('python3', [SCRIPT, path], { encoding: 'utf-8' })
    expect(out).not.toMatch(/ERRORE|ERROR/i)
  })
})
