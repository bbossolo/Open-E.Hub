import { describe, it, expect } from 'vitest'
import { normH, codeLevels } from '../../src/tools/miu/engine/codes'

describe('normH — normalizzazione intestazioni', () => {
  it('minuscolo, senza accenti, solo alfanumerico', () => {
    expect(normH('Unità di Misura')).toBe('unitadimisura')
    expect(normH('Descrizione (estesa)')).toBe('descrizioneestesa')
    expect(normH('Prezzo €')).toBe('prezzo')
  })
  it('robusto a null/undefined/numeri', () => {
    expect(normH(null)).toBe('')
    expect(normH(undefined)).toBe('')
    expect(normH(2025)).toBe('2025')
  })
})

describe('codeLevels — segmenti gerarchici progressivi', () => {
  it('separatori misti - e . (Veneto): ogni segmento è un livello', () => {
    expect(codeLevels('VEN25-10.05.03.a')).toEqual([
      'VEN25', 'VEN25-10', 'VEN25-10.05', 'VEN25-10.05.03', 'VEN25-10.05.03.a',
    ])
  })
  it('suffisso ".-" finale rimosso (Lombardia)', () => {
    expect(codeLevels('LOM261.RM.87.10.-')).toEqual([
      'LOM261', 'LOM261.RM', 'LOM261.RM.87', 'LOM261.RM.87.10',
    ])
  })
  it('codice senza separatori = singolo livello', () => {
    expect(codeLevels('A01')).toEqual(['A01'])
  })
})
