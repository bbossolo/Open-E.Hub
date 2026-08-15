import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseBasilicata } from '../../src/tools/miu/engine/parsers/basilicata'

const xml = readFileSync(resolve(__dirname, 'fixtures/basilicata-sample.xml'), 'utf-8')

describe('parseBasilicata — anagrafica Capitolo/Categoria/Voce/Sottovoce', () => {
  const res = parseBasilicata(xml, { regione: 'Basilicata' })

  it('regione dal fallback, anno dal contenuto', () => {
    expect(res.regione).toBe('Basilicata')
    expect(res.anno).toBe('2025')
  })

  it('una voce per Sottovoce con prezzo; codice composto dalla gerarchia', () => {
    expect(res.rows.map(r => r.codice)).toEqual(['A.01.001.01', 'A.01.001.03'])
  })

  it('mappa prezzo, manodopera, um e gerarchia', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(61.77, 2)
    expect(r.ru).toBeCloseTo(46.75, 2)
    expect(r.um).toBe('ora')                              // unitaMisura ripulita
    expect(r.disciplina).toBe('NOLEGGI')                  // Capitolo
    expect(r.sistema).toBe('Noleggi')                     // Categoria
    expect(r.settore).toBe('Veicolo peso totale:')        // Voce
    // sintetica self-contained: padre (Voce) + foglia (Sottovoce)
    expect(r.desc_short).toBe('Veicolo peso totale: fino a kg. 1.200 (portata kg. 600) a caldo')
    expect(r.declaratoria).toContain('Veicolo peso totale:')   // eredita la Voce
  })

  it('seconda sottovoce: manodopera 0', () => {
    expect(res.rows[1].prezzo).toBeCloseTo(6.11, 2)
    expect(res.rows[1].ru).toBe(0)
  })
})
