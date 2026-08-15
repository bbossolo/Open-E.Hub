// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { hubSource } from './hub-src'

/**
 * Open E.Hub è mono-studio locale (edizione 'server' rimossa): non
 * c'è login, non c'è gate d'accesso, non c'è sessione da far scadere. L'hub
 * apre sempre con un profilo admin locale fisso (`initAuth`), scritto in
 * sessionStorage (vedi shared/session-profile) così i tool caricati in iframe
 * lo riconoscono — usato in particolare dal gate difensivo di α (Centro di
 * controllo). Questo test verifica che NON resti alcun riferimento
 * all'infrastruttura server (login.html, /api/auth, cambio password) e che il
 * profilo/le funzioni multi-utente locali dell'admin restino intatte.
 */

const SRC = resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf8')
const doc = new JSDOM(read('src/hub/index.html')).window.document
const mainJs = hubSource()

describe('nessun gate di login, nessuna infrastruttura server', () => {
  it('nessun markup del gate nell\'HTML dell\'hub', () => {
    expect(doc.querySelector('#login-gate')).toBeNull()
    expect(doc.querySelector('#lg-azienda')).toBeNull()
    expect(doc.querySelector('#lg-form')).toBeNull()
    expect(doc.querySelector('#changepw-overlay')).toBeNull()
  })

  it('nessuna logica di login/logout/sessione server nell\'hub', () => {
    expect(mainJs).not.toMatch(/function doLogin/)
    expect(mainJs).not.toMatch(/function showLoginGate/)
    expect(mainJs).not.toMatch(/function onAziendaInput/)
    expect(mainJs).not.toMatch(/function logout/)
    expect(mainJs).not.toMatch(/login\.html/)
    expect(mainJs).not.toMatch(/\/api\/auth/)
  })

  it('Impostazioni ha la riga Profilo con bottone α (centro di controllo), senza «Esci» né «Cambia password»', () => {
    const row = doc.querySelector('#set-profile')!
    expect(row).not.toBeNull()
    expect(row.hasAttribute('hidden')).toBe(true)
    expect(row.querySelector('[onclick*="launchApp(\'alfa-control-center\')"]')).not.toBeNull()
    expect(doc.querySelector('#set-prof-out')).toBeNull()
    expect(doc.querySelector('#set-prof-pw')).toBeNull()
  })
})

describe('profilo dell\'hub (mono-studio locale, sempre admin)', () => {
  it('initAuth sintetizza un profilo admin locale fisso, senza gate', () => {
    expect(mainJs).toMatch(/function initAuth/)
    expect(mainJs).toMatch(/from '(?:\.\.\/)+shared\/session-profile'/)
    expect(mainJs).toMatch(/authProfile = \{ azienda: 'admin', utente: 'admin', role: 'admin', companyId: null/)
  })
  it('il profilo viene scritto in sessionStorage (mai in localStorage): i tool in iframe lo riconoscono', () => {
    expect(mainJs).toMatch(/writeAuth\(authProfile\)/)
    expect(mainJs, 'il profilo non deve finire in localStorage').not.toMatch(/localStorage\.[gs]etItem\(\s*['"]hub:auth/)
  })
  it('α (admin-only) riceve app:admin-changed per ricaricare utenti/flag nell\'hub', () => {
    expect(mainJs).toMatch(/case 'app:admin-changed'/)
  })
  it('il profilo aziendale resta nel footer della sidebar', () => {
    expect(mainJs).toContain('side-company')
    expect(mainJs).toMatch(/companyLogoHtml/)
  })
})
