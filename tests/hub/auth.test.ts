import { describe, it, expect } from 'vitest'
import { isValidProfile, profileLabel } from '../../src/hub/engine/auth'
import { findCompany, companyLogoHtml, COMPANIES } from '../../src/hub/data/companies'

/**
 * Profilo dell'hub. Open E.Hub è mono-studio locale: non c'è
 * login, si entra sempre come admin locale (vedi initAuth in hub/ui/auth.js).
 */

describe('registro aziende', () => {
  it('Studio Demo è riconosciuto per id, nome e prefisso', () => {
    expect(findCompany('studio-demo')?.id).toBe('studio-demo')
    expect(findCompany('Studio Demo')?.id).toBe('studio-demo')
    expect(findCompany('Studio')?.id).toBe('studio-demo')
    expect(findCompany('acme')).toBeNull()
    expect(findCompany('')).toBeNull()
  })
  it('Studio Demo ha il logo (data URL) → <img> con fallback; azienda senza logo → placeholder sigla', () => {
    const demo = COMPANIES.find((c) => c.id === 'studio-demo')!
    const html = companyLogoHtml(demo)
    expect(html).toContain('<img')            // logo reale
    expect(html).toContain('data:image')      // incorporato come data URL (vale anche nei documenti)
    expect(html).toContain('co-logo--ph')     // placeholder nascosto come fallback onerror
    const noLogo = companyLogoHtml({ id: 'x', name: 'ACME spa', short: 'ACME' })
    expect(noLogo).not.toContain('<img')       // senza logo → solo placeholder
    expect(noLogo).toContain('ACME')
  })
})

describe('isValidProfile / profileLabel (senza username)', () => {
  it('valida il companyId (string|null) e i campi', () => {
    expect(isValidProfile({ azienda: 'Studio Demo', utente: '', role: 'user', companyId: 'studio-demo', ts: 1 })).toBe(true)
    expect(isValidProfile({ azienda: 'admin', utente: '', role: 'admin', companyId: null, ts: 1 })).toBe(true)
    expect(isValidProfile({ azienda: 'A', utente: '', role: 'user', ts: 1 })).toBe(false) // manca companyId
  })
  /* Il nome di CHI è entrato dev'essere sempre visibile: su una postazione
     condivisa la sola ragione sociale (identica per tutti i colleghi) non fa
     accorgere di stare usando la sessione di un altro. */
  it('profileLabel porta l\'utente, con azienda/ruolo a seguire', () => {
    expect(profileLabel({ azienda: 'Studio Demo', utente: 'mrossi', role: 'user', companyId: 'studio-demo', ts: 0 })).toBe('mrossi · Studio Demo')
    expect(profileLabel({ azienda: 'Studio Demo', utente: '', role: 'user', companyId: 'studio-demo', ts: 0 })).toBe('Studio Demo')
    expect(profileLabel({ azienda: 'admin', utente: 'admin', role: 'admin', companyId: null, ts: 0 })).toBe('Amministratore')
    expect(profileLabel({ azienda: 'admin', utente: 'Davide', role: 'admin', companyId: null, ts: 0 })).toBe('Davide · Amministratore')
    expect(profileLabel({ azienda: '', utente: 'lgialli', role: 'user', companyId: null, ts: 0 })).toBe('lgialli')
  })
})
