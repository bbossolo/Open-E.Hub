import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseLombardiaDataroot } from '../../src/tools/miu/engine/parsers/lombardia-dataroot'
import { isSelfContained } from '../../src/tools/miu/engine/descriptions'

const xml = readFileSync(resolve(__dirname, 'fixtures/lombardia-dataroot-sample.xml'), 'utf-8')

describe('parseLombardiaDataroot — famiglia dataroot/Access (golden su dati reali)', () => {
  const res = parseLombardiaDataroot(xml, { anno: '2026' })

  it('rileva regione (prefisso LOM) e anno (fallback percorso)', () => {
    expect(res.regione).toBe('Lombardia')
    expect(res.anno).toBe('2026')
  })

  it('scarta le righe-categoria senza <Prezzo> (solo le foglie diventano voci)', () => {
    // 3 righe-categoria (LOM261.1C, .1C.00, .1C.00.010) scartate; restano 3 foglie a prezzo.
    expect(res.rows.map(r => r.codice)).toEqual([
      'LOM261.1C.00.010.0010',
      'LOM261.1C.00.010.0030',
      'LOM261.1E.03.030.0140.k',
    ])
  })

  it('mappa prezzo, importo netto, rapporto manodopera (notazione lunga) e u.m.', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(1.44, 2)
    expect(r.importo_netto).toBeCloseTo(1.14, 2)
    expect(r.ru).toBeCloseTo(0.456140350877193, 9)  // Rapporto_RU a notazione lunga
    expect(r.um).toBe('cad')
  })

  it('preserva le u.m. composte con prefisso numerico ("100 kg")', () => {
    expect(res.rows[1].um).toBe('100 kg')           // NON ripulita come la famiglia report
  })

  it('declaratoria = testo esteso intero; entità &apos; decodificata', () => {
    const r = res.rows[0]
    expect(r.declaratoria).toContain('Misura della durezza superficiale')
    expect(r.declaratoria).toContain("E' compreso quanto altro")  // &apos; → '
  })

  it('desc_short = prima riga, self-contained anche per foglie multi-riga', () => {
    expect(res.rows.every(r => isSelfContained(r.desc_short))).toBe(true)
    // foglia elettrica multi-riga: la prima riga (titolo) è self-contained, il frammento "- campo…" è scartato
    expect(res.rows[2].desc_short).toBe(
      'Interruttore automatico magnetotermico salvamotore, modulare con modulo di 17,5 mm, 3 poli, nelle taglie:',
    )
    expect(res.rows[2].desc_short).not.toContain('- campo di regolazione')
  })
})
