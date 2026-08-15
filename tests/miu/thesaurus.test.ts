import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expandQuery, normQuery } from '../../src/shared/compositore/thesaurus'

// NOTA (Open E.Hub): FAMIGLIE_DATA arriva da `compositore-catalog:thesaurus`, che
// vite.config.ts alias-a allo stub vuoto (catalog-data-empty.ts) — Open E.Hub non
// distribuisce vocabolario proprietario, l'utente porta il proprio catalogo. I test
// che verificavano CONTENUTO di catalogo reale (id/alias/sinonimi/accessori delle
// famiglie) sono stati rimossi: con FAMIGLIE=[] non c'è nulla da verificare. Restano
// solo i test di normalizzazione pura e di comportamento a catalogo vuoto.

describe('expandQuery — comportamento a catalogo vuoto', () => {
  it('query-codice o parole ignote: nessuna famiglia, tutto in liberi', () => {
    const e = expandQuery('LOM261.LP.EEA cemento')
    expect(e.famiglie).toEqual([])
    expect(e.liberi).toEqual([normQuery('LOM261.LP.EEA'), 'cemento'])
  })
  it('normQuery: accenti, × e spazi multipli', () => {
    expect(normQuery('Tubò  25×30')).toBe('tubo 25x30')
  })
  it('normQuery: formazione cavo «3G6»/«3 g 6» (gergo elettricista) ≡ «3x6» (notazione prezzario)', () => {
    expect(normQuery('3G6')).toBe('3x6')
    expect(normQuery('3 g 6')).toBe('3x6')
    expect(normQuery('fg16om16 3g6')).toBe('fg16om16 3x6')
    // «fg16om16» non contiene un digit-g-digit: non deve essere alterata
    expect(normQuery('fg16om16')).toBe('fg16om16')
  })
})

describe('thesaurus — anti-leak (indipendente dal contenuto del catalogo)', () => {
  it('nessun dato identificativo di progetto nel sorgente del thesaurus', () => {
    const src = readFileSync(resolve(__dirname, '../../src/shared/compositore/thesaurus.ts'), 'utf-8').toLowerCase()
    // pattern codice commessa (lettera+3 cifre con separatori da nome-file computo) e nomi propri di fornitori/progetto
    expect(src).not.toMatch(/[a-z][0-9]{3}-[a-z]/)
    for (const leak of ['tecnofire', 'palazzina', 'commessa']) expect(src).not.toContain(leak)
  })
})
