import { describe, it, expect } from 'vitest'
import {
  caricaSinonimi, salvaSinonimi, sinonimoDi, decidiSinonimo, chiaveStore, SINONIMI_VUOTO,
  type SinonimiElenco, type Store,
} from '../../src/tools/delta/engine/elenco-synonyms'

/** Store finto in memoria (come un localStorage). */
function memStore(): Store & { data: Record<string, string> } {
  const data: Record<string, string> = {}
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v } }
}

describe('δ elenco-synonyms — storage per azienda', () => {
  it('chiave compartimentata per companyId (anon senza azienda)', () => {
    expect(chiaveStore('studio-a')).toBe('ehub:elenco-sinonimi:studio-a')
    expect(chiaveStore(null)).toBe('ehub:elenco-sinonimi:anon')
  })
  it('round-trip salva/carica', () => {
    const s = memStore()
    const d = decidiSinonimo(SINONIMI_VUOTO, 'CMS', 'CODICE_COMMESSA')
    salvaSinonimi(s, d, 'studio-a')
    const back = caricaSinonimi(s, 'studio-a')
    expect(sinonimoDi(back, 'CMS')).toBe('CODICE_COMMESSA')
  })
  it('JSON corrotto o assente → SINONIMI_VUOTO', () => {
    const s = memStore()
    expect(caricaSinonimi(s, 'x')).toEqual(SINONIMI_VUOTO)
    s.data[chiaveStore('x')] = '{ non json'
    expect(caricaSinonimi(s, 'x')).toEqual(SINONIMI_VUOTO)
  })
  it('chiavi non fra le 14 standard vengono scartate al caricamento', () => {
    const s = memStore()
    s.data[chiaveStore('x')] = JSON.stringify({ v: 1, map: { cms: 'CODICE_COMMESSA', xyz: 'NON_ESISTE', '': 'DATA' } })
    const back = caricaSinonimi(s, 'x')
    expect(back.map).toEqual({ cms: 'CODICE_COMMESSA' })
  })
})

describe('δ elenco-synonyms — decidiSinonimo/sinonimoDi', () => {
  it('insegna un alias normalizzato (minuscole, senza accenti/punteggiatura)', () => {
    const d = decidiSinonimo(SINONIMI_VUOTO, 'CMS', 'CODICE_COMMESSA')
    expect(sinonimoDi(d, 'cms')).toBe('CODICE_COMMESSA')
    expect(sinonimoDi(d, 'CMS')).toBe('CODICE_COMMESSA')
  })
  it('standardKey non valida → non insegna nulla', () => {
    const d = decidiSinonimo(SINONIMI_VUOTO, 'CMS', 'NON_ESISTE')
    expect(sinonimoDi(d, 'CMS')).toBeNull()
  })
  it('standardKey null cancella una decisione precedente', () => {
    const taught = decidiSinonimo(SINONIMI_VUOTO, 'CMS', 'CODICE_COMMESSA')
    const forgot = decidiSinonimo(taught, 'CMS', null)
    expect(sinonimoDi(forgot, 'CMS')).toBeNull()
    expect(sinonimoDi(taught, 'CMS')).toBe('CODICE_COMMESSA') // immutabile: l'originale non cambia
  })
  it('alias vuoto → nessuna modifica', () => {
    expect(decidiSinonimo(SINONIMI_VUOTO, '  ', 'CODICE_COMMESSA')).toEqual(SINONIMI_VUOTO)
  })
  it('alias sconosciuto → null', () => {
    expect(sinonimoDi(SINONIMI_VUOTO, 'boh')).toBeNull()
  })
})

describe('δ elenco-synonyms — integrazione con columns.ts', () => {
  it('il dizionario si passa così com\'è (map) come extraSynonyms a matchColumn/detectHeaderRow', async () => {
    const { matchColumn } = await import('../../src/tools/delta/engine/columns')
    const d: SinonimiElenco = decidiSinonimo(SINONIMI_VUOTO, 'CMS', 'CODICE_COMMESSA')
    expect(matchColumn(['CMS', 'Titolo'], 'CODICE_COMMESSA', d.map)).toBe('CMS')
  })
})
