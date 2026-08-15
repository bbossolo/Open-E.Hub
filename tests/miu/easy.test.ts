import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEasy } from '../../src/tools/miu/engine/parsers/easy'

const xml = readFileSync(resolve(__dirname, 'fixtures/easy-sample.xml'), 'utf-8')

describe('parseEasy — famiglia EASY (golden su dati reali Calabria)', () => {
  const res = parseEasy(xml)

  it('rileva regione dal prefisso codice e anno dall\'intestazione', () => {
    expect(res.regione).toBe('Calabria')   // CAL → Calabria
    expect(res.anno).toBe('2025')           // intestazione/dettaglio@anno
  })

  it('emette solo le voci con prezzo (scarta prezzo 0)', () => {
    expect(res.rows).toHaveLength(2)        // 3 articoli, 1 senza prezzo scartato
    expect(res.rows.map(r => r.codice)).toEqual([
      'CAL25_01.A01.001.001',
      'CAL25_01.A01.001.002',
    ])
  })

  it('mappa correttamente il primo articolo (gerarchia, prezzo, um, analisi)', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(1.5605, 6)
    expect(r.um).toBe('m²')
    expect(r.disciplina).toContain('NUOVE COSTRUZIONI EDILI')   // livello1
    expect(r.sistema).toBe('BONIFICA DA ORDIGNI BELLICI')        // livello2
    expect(r.settore).toBe('Localizzazione, bonifica e scavi stratigrafici') // livello3
    expect(r.declaratoria).toContain('ricerca superficiale')     // livello4
    expect(r.desc_short.startsWith('Localizzazione e bonifica')).toBe(true)
    expect(r.importo_netto).toBeCloseTo(1.2336, 6)               // totaleparziale
    expect(r.ru).toBeCloseTo(49.28, 4)                           // incidenza manodopera %
    expect(r.regione).toBe('Calabria')
    expect(r.anno).toBe('2025')
  })

  it('gestisce articoli senza blocco Analisi (importo_netto e ru = 0)', () => {
    const r = res.rows[1]
    expect(r.prezzo).toBeCloseTo(11.02884, 6)
    expect(r.um).toBe('m')
    expect(r.importo_netto).toBe(0)
    expect(r.ru).toBe(0)
  })

  it('usa il fallback quando il contenuto non rivela regione/anno', () => {
    const minimal = '<EASY:Prezzario xmlns:EASY="x"><EASY:Contenuto>' +
      '<EASY:Articolo codice="X.01"><EASY:prezzo>5</EASY:prezzo></EASY:Articolo>' +
      '</EASY:Contenuto></EASY:Prezzario>'
    const r = parseEasy(minimal, { regione: 'Toscana', anno: '2026' })
    expect(r.regione).toBe('Toscana')
    expect(r.anno).toBe('2026')
    expect(r.rows[0].regione).toBe('Toscana')
  })
})
