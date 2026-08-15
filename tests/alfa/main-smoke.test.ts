// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Smoke test: il main.js di α carica in jsdom, protegge l'accesso non-admin,
 *  e le viste (Panoramica/Utenti/Azienda) funzionano senza eccezioni. */
const SRC = resolve(__dirname, '../../src/tools/alfa')
function loadDom(): void {
  const html = readFileSync(resolve(SRC, 'index.html'), 'utf8')
  document.documentElement.setAttribute('data-tool', 'alfa')
  document.documentElement.setAttribute('data-theme', 'dark')
  document.body.innerHTML = html.replace(/[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*/, '')
}
// @ts-expect-error — modulo JS senza dichiarazioni.
const loadMain = (): Promise<unknown> => import('../../src/tools/alfa/main.js')

const ADMIN_PROFILE = { azienda: 'admin', utente: 'admin', role: 'admin', companyId: null, ts: Date.now() }

/** In alcuni ambienti Node/vitest il global `localStorage` è oscurato
 *  dall'API sperimentale di Node (non da jsdom) — mock in-memory minimale. */
function makeMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
}

describe('α Alfa — main.js smoke test', () => {
  beforeEach(() => {
    vi.resetModules()
    loadDom()
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    vi.stubGlobal('localStorage', makeMemoryStorage())
  })

  it('senza profilo admin in localStorage, mostra il messaggio riservato (nessun dato)', async () => {
    await loadMain()
    expect(document.getElementById('app')?.textContent).toContain('riservato')
    expect(document.getElementById('aStatsGrid')).toBeNull()
  })

  it('con profilo admin, carica senza eccezioni e mostra la Panoramica', async () => {
    sessionStorage.setItem('hub:auth', JSON.stringify(ADMIN_PROFILE))
    await loadMain()
    expect(document.getElementById('viewPanoramica')?.hidden).toBe(false)
    const grid = document.getElementById('aStatsGrid')
    expect(grid).not.toBeNull()
    expect(grid?.children.length).toBeGreaterThan(0)
  })

  it('espone le funzioni globali attese', async () => {
    sessionStorage.setItem('hub:auth', JSON.stringify(ADMIN_PROFILE))
    await loadMain()
    const w = window as unknown as Record<string, unknown>
    for (const fn of ['toggleTheme', 'showView', 'toggleActive', 'toggleRole', 'addUser', 'exportConfig']) {
      expect(typeof w[fn]).toBe('function')
    }
  })

  it('vista Utenti mostra gli utenti seed (nessun utente salvato ⇒ SEED_USERS)', async () => {
    sessionStorage.setItem('hub:auth', JSON.stringify(ADMIN_PROFILE))
    await loadMain()
    ;(window as unknown as { showView: (n: string) => void }).showView('utenti')
    expect(document.getElementById('viewUtenti')?.hidden).toBe(false)
    const cards = document.querySelectorAll('#aUsers .adm-user')
    expect(cards.length).toBe(1) // SEED_USERS: studio-demo-u1 (predisposizione, 1 solo utente di test)
  })

  it('vista Utenti: nessun toggle di visibilità tool per-utente (rimosso, ogni tool è visibile di default)', async () => {
    sessionStorage.setItem('hub:auth', JSON.stringify(ADMIN_PROFILE))
    await loadMain()
    ;(window as unknown as { showView: (n: string) => void }).showView('utenti')
    expect(document.querySelectorAll('#aUsers .adm-user__tools').length).toBe(0)
    expect(document.getElementById('aTabTool')).toBeNull()
  })
})
