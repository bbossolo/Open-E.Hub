import { describe, it, expect } from 'vitest'
import type { CartItem } from '../../src/shared/compositore'

describe('CartItem — contratto condiviso per la voce di carrello', () => {
  it('accetta un oggetto con solo il campo obbligatorio (codice)', () => {
    const item: CartItem = { codice: 'ABC.001' }
    expect(Object.keys(item)).toEqual(['codice'])
  })

  it('accetta tutti i campi previsti dall\'AC1, nessuno in più', () => {
    const item: CartItem = {
      codice: 'ABC.001',
      desc_short: 'Interruttore',
      declaratoria: 'Interruttore magnetotermico...',
      um: 'cad',
      prezzo: 12.5,
      qty: 3,
      regione: 'Lombardia',
      anno: '2024',
      tematica: 'Elettrico',
      source: 'phi',
    }
    const expectedKeys = [
      'codice', 'desc_short', 'declaratoria', 'um', 'prezzo',
      'qty', 'regione', 'anno', 'tematica', 'source',
    ].sort()
    expect(Object.keys(item).sort()).toEqual(expectedKeys)
  })

  it('accetta qty null (non misurata) e le source note', () => {
    const notMeasured: CartItem = { codice: 'X', qty: null }
    expect(notMeasured.qty).toBeNull()

    for (const source of ['phi', 'manual', 'xls'] as const) {
      const item: CartItem = { codice: 'X', source }
      expect(item.source).toBe(source)
    }
  })
})
