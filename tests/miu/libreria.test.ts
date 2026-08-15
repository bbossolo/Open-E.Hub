import { describe, it, expect } from 'vitest'
import { VOCI_PRONTE, voceProntaText, FRASARIO, componiDescrizione } from '../../src/tools/miu/engine'

/**
 * Libreria di voci pronte — seed curato minato dai computi golden. Verifica che
 * ogni voce sia coerente col motore (famigliaId noto, testo ricalcolabile) e che
 * il fallback su testo/override funzioni per le voci personali.
 */
describe('Libreria voci pronte', () => {
  it('ogni voce ha id univoco, nome e U.M.', () => {
    const ids = VOCI_PRONTE.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const v of VOCI_PRONTE) {
      expect(v.nome.trim().length).toBeGreaterThan(0)
      expect(v.um.trim().length).toBeGreaterThan(0)
    }
  })

  it('ogni famigliaId referenziata esiste nel FRASARIO', () => {
    const known = new Set(FRASARIO.map(f => f.famigliaId))
    for (const v of VOCI_PRONTE) {
      if (v.famigliaId) expect(known, v.id).toContain(v.famigliaId)
    }
  })

  it('il testo di una voce con famiglia coincide col motore del compositore', () => {
    for (const v of VOCI_PRONTE) {
      if (!v.famigliaId) continue
      const t = voceProntaText(v)
      const d = componiDescrizione({
        famigliaId: v.famigliaId,
        misura: v.misura || undefined,
        materiale: v.materiale || undefined,
        posa: v.posa || undefined,
        opzioni: v.opzioni,
      })
      expect(t.breve).toBe(d.breve)
      expect(t.estesa).toBe(d.estesa)
      expect(t.breve.length).toBeGreaterThan(0)
    }
  })

  it('un override di testo (voce personale) ha priorità sul motore', () => {
    const t = voceProntaText({ id: 'x', nome: 'n', um: 'cad', famigliaId: 'radiatore', breve: 'MIO TESTO', estesa: 'MIA ESTESA' })
    expect(t.breve).toBe('MIO TESTO')
    expect(t.estesa).toBe('MIA ESTESA')
  })

  it('senza famiglia né override ripiega sul nome', () => {
    const t = voceProntaText({ id: 'x', nome: 'Voce custom', um: 'cad' })
    expect(t.breve).toBe('Voce custom')
    expect(t.estesa).toBe('Voce custom')
  })
})
