import { describe, it, expect } from 'vitest'
import { COMANDI } from '../../scripts/cli/registry'

/** Invarianti del catalogo comandi: sono la garanzia che l'help resti sempre
 *  completo e coerente. */
describe('CLI ehub — invarianti del registry', () => {
  it('nomi unici e conformi a tool:azione', () => {
    const nomi = COMANDI.map((c) => c.nome)
    expect(new Set(nomi).size).toBe(nomi.length)
    for (const n of nomi) expect(n).toMatch(/^[a-z]+:[a-z][a-z0-9-]*$/)
  })

  it('ogni comando ha descrizione ed esempi che iniziano con npm run ehub -- <nome>', () => {
    for (const c of COMANDI) {
      expect(c.descrizione.trim().length, c.nome).toBeGreaterThan(0)
      expect(c.esempi.length, c.nome).toBeGreaterThan(0)
      for (const e of c.esempi) expect(e, c.nome).toMatch(new RegExp(`^npm run ehub -- ${c.nome}( |$)`))
    }
  })

  it('spec argomenti coerente: niente nomi duplicati, variadico solo sull\'ultimo posizionale', () => {
    for (const c of COMANDI) {
      const nomi = c.argomenti.map((a) => a.nome)
      expect(new Set(nomi).size, c.nome).toBe(nomi.length)
      const posizionali = c.argomenti.filter((a) => a.tipo === 'posizionale')
      posizionali.forEach((a, i) => {
        if (a.variadico) expect(i, `${c.nome}: variadico non ultimo`).toBe(posizionali.length - 1)
      })
      // posizionali obbligatori prima degli opzionali
      const primoOpz = posizionali.findIndex((a) => !a.obbligatorio)
      if (primoOpz >= 0) {
        for (const a of posizionali.slice(primoOpz)) expect(a.obbligatorio, c.nome).toBe(false)
      }
      for (const a of c.argomenti) expect(a.descrizione.trim().length, `${c.nome} --${a.nome}`).toBeGreaterThan(0)
    }
  })
})
