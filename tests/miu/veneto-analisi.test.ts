import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isVenetoAnalisi, parseVenetoAnalisi, applyAnalisi } from '../../src/tools/miu/engine/parsers/veneto-analisi'
import type { PriceRow } from '../../src/tools/miu/engine/types'

const xml = readFileSync(resolve(__dirname, 'fixtures/veneto-analisi-sample.xml'), 'utf-8')

describe('parseVenetoAnalisi — companion analisi prezzi Veneto', () => {
  it('sniff: riconosce il file analisiPrezzi (e non un prezzario)', () => {
    expect(isVenetoAnalisi(xml.slice(0, 200))).toBe(true)
    expect(isVenetoAnalisi('<prezzario cod="2026">')).toBe(false)
  })

  const { anno, byCod } = parseVenetoAnalisi(xml)

  it('anno dalla radice, componenti con tipo dal prefisso codice (RU→manodopera, AT→nolo)', () => {
    expect(anno).toBe('2026')
    const comp = byCod.get('VEN26-01.02.05.a')!
    expect(comp).toHaveLength(3)
    expect(comp[0]).toMatchObject({ codice: 'VEN26-RU.01.04.a', tipo: 'manodopera', quantita: 2.48, prezzo: 28.11, um: 'h' })
    expect(comp[0].descrizione).toBe('OPERAIO COMUNE EDILE')
    expect(comp[1]).toMatchObject({ codice: 'VEN26-AT.09.01.a', tipo: 'nolo', quantita: 0.01, prezzo: 63.09 })
  })

  it('applyAnalisi: arricchisce la riga col codice corrispondente, senza clobber', () => {
    const rows = [
      { codice: 'VEN26-01.02.05.a', risorse: undefined },
      { codice: 'VEN26-99.99.99.z' },
      { codice: 'VEN26-01.02.05.a', risorse: [{ codice: 'X', tipo: 'varie', quantita: 1, prezzo: 1 }] },
    ] as unknown as PriceRow[]
    expect(applyAnalisi(rows, byCod)).toBe(1)
    expect(rows[0].risorse).toHaveLength(3)
    expect(rows[1].risorse).toBeUndefined()
    expect(rows[2].risorse![0].codice).toBe('X') // già presente → non sovrascrive
  })

  it('la scomposizione quadra col costo diretto dichiarato (val articolo)', () => {
    const comp = byCod.get('VEN26-01.02.05.a')!
    const costoDiretto = comp.reduce((s, c) => s + c.quantita * c.prezzo, 0)
    expect(costoDiretto).toBeCloseTo(71.17, 1) // val="71.17" (tot = val + utile 26,5%)
  })
})
