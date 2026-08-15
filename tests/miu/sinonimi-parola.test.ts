import { describe, it, expect } from 'vitest'
import { variantiParola } from '../../src/shared/compositore/sinonimi-parola'

// NOTA (Open E.Hub): GRUPPI_PAROLA_DATA arriva da `compositore-catalog:sinonimi-parola`,
// che vite.config.ts alias-a allo stub vuoto (catalog-data-empty.ts) — Open E.Hub non
// distribuisce vocabolario proprietario, l'utente porta il proprio dizionario. I test
// che verificavano CONTENUTO di gruppi reali (interrotto↔interruttore, presa↔IP65…) sono
// stati rimossi: con GRUPPI_PAROLA=[] non c'è nulla da verificare. Resta solo il
// contratto puro del fallback: una parola fuori dizionario ritorna se stessa.

describe('variantiParola — fallback a dizionario vuoto', () => {
  it('parola fuori dizionario → solo se stessa', () => {
    expect(variantiParola('zoccolo')).toEqual(['zoccolo'])
  })
})
