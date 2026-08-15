// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { makeCollapse } from '../../src/shared/ui/components/collapse'

/**
 * Sidebar comprimibile unica (makeCollapse), condivisa dai tool.
 *
 * Test di REGRESSIONE per uno spec di refactor UI: il comportamento osservabile
 * deve essere preservato e ora uniforme tra le superfici. Si montano i veri
 * frammenti di markup reale e si cabla makeCollapse come fanno i tool, poi si
 * verificano classe di stato, persistenza con chiave namespaced, migrazione (μ),
 * persistenza e la scorciatoia 'b'.
 */
// jsdom 29 non sempre espone localStorage: shim minimale per i test di persistenza.
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('μ Prezzi — sidebar comprimibile', () => {
  // Replica il wiring di src/tools/miu/main.ts (migrazione + makeCollapse + 2° trigger).
  function wireMiu(): ReturnType<typeof makeCollapse> {
    const old = localStorage.getItem('sidebarCollapsed')
    if (old !== null && localStorage.getItem('miu:sidebar-collapsed') === null) {
      localStorage.setItem('miu:sidebar-collapsed', old)
      localStorage.removeItem('sidebarCollapsed')
    }
    const h = makeCollapse(
      document.getElementById('sidebar'),
      document.getElementById('sidebar-collapse-btn'),
      { storageKey: 'miu:sidebar-collapsed' },
    )
    document.querySelector('#sidebar-collapsed-icon button')?.addEventListener('click', () => h.toggle())
    return h
  }

  function mountMiuSidebar(): void {
    document.body.innerHTML = `
      <aside id="sidebar">
        <div class="sidebar-section-title">
          <button id="sidebar-collapse-btn" title="Comprimi/espandi sidebar"></button>
        </div>
        <div id="sidebar-collapsed-icon"><button title="Espandi sidebar">▶</button></div>
        <div id="archive-list">Prezzari caricati</div>
      </aside>`
  }

  it('il bottone comprime/espande aggiungendo .collapsed su #sidebar', () => {
    mountMiuSidebar()
    wireMiu()
    const sb = document.getElementById('sidebar') as HTMLElement
    ;(document.getElementById('sidebar-collapse-btn') as HTMLElement).click()
    expect(sb.classList.contains('collapsed')).toBe(true)
    ;(document.getElementById('sidebar-collapse-btn') as HTMLElement).click()
    expect(sb.classList.contains('collapsed')).toBe(false)
  })

  it("l'affordance di espansione riapre la sidebar (2° trigger)", () => {
    mountMiuSidebar()
    const h = wireMiu()
    h.set(true)
    const expandBtn = document.querySelector('#sidebar-collapsed-icon button') as HTMLElement
    expandBtn.click()
    expect((document.getElementById('sidebar') as HTMLElement).classList.contains('collapsed')).toBe(false)
  })

  it('persiste con la chiave namespaced miu:sidebar-collapsed', () => {
    mountMiuSidebar()
    wireMiu()
    ;(document.getElementById('sidebar-collapse-btn') as HTMLElement).click()
    expect(localStorage.getItem('miu:sidebar-collapsed')).toBe('1')
  })

  it('migra one-shot la vecchia chiave sidebarCollapsed → miu:sidebar-collapsed e ripristina', () => {
    localStorage.setItem('sidebarCollapsed', '1')
    mountMiuSidebar()
    wireMiu()
    expect(localStorage.getItem('miu:sidebar-collapsed')).toBe('1')
    expect(localStorage.getItem('sidebarCollapsed')).toBeNull()
    expect((document.getElementById('sidebar') as HTMLElement).classList.contains('collapsed')).toBe(true)
  })

  it('il contenuto della sidebar (Prezzari) resta nel DOM da compresso', () => {
    mountMiuSidebar()
    const h = wireMiu()
    h.set(true)
    expect(document.getElementById('archive-list')?.textContent).toContain('Prezzari')
  })
})

describe('secondo tool — sidebar comprimibile', () => {
  // Replica il wiring di src/tools/tau/main.js (makeCollapse + alias toggleSide + 'b').
  function wireTau(): { handle: ReturnType<typeof makeCollapse>; toggleSide: () => void } {
    const handle = makeCollapse(
      document.getElementById('t-side'),
      document.querySelector('#t-side .t-side-collapse'),
      { storageKey: 'tau:side-collapsed' },
    )
    const toggleSide = (): void => handle.toggle()
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName || ''
      if (e.key === 'b' && !/input|select|textarea/i.test(tag)) toggleSide()
    })
    return { handle, toggleSide }
  }

  function mountTauSide(): void {
    document.body.innerHTML = `
      <aside id="t-side">
        <div class="t-side-head">
          <span class="t-side-title">Progetto</span>
          <button class="t-side-collapse" aria-label="Comprimi">‹</button>
        </div>
        <div class="t-side-body"><input id="meta-x"><div class="t-side-sec">Sorgente computo</div></div>
      </aside>
      <aside id="t-right"><button class="t-side-collapse">›</button></aside>`
  }

  it('il bottone della sidebar sinistra la comprime senza toccare t-right', () => {
    mountTauSide()
    wireTau()
    ;(document.querySelector('#t-side .t-side-collapse') as HTMLElement).click()
    expect((document.getElementById('t-side') as HTMLElement).classList.contains('collapsed')).toBe(true)
    expect((document.getElementById('t-right') as HTMLElement).classList.contains('collapsed')).toBe(false)
  })

  it("persiste lo stato (prima assente) su tau:side-collapsed", () => {
    mountTauSide()
    wireTau()
    ;(document.querySelector('#t-side .t-side-collapse') as HTMLElement).click()
    expect(localStorage.getItem('tau:side-collapsed')).toBe('1')
  })

  it('ripristina lo stato compresso al boot', () => {
    localStorage.setItem('tau:side-collapsed', '1')
    mountTauSide()
    wireTau()
    expect((document.getElementById('t-side') as HTMLElement).classList.contains('collapsed')).toBe(true)
  })

  it("la scorciatoia 'b' comprime la sidebar fuori dagli input", () => {
    mountTauSide()
    wireTau()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))
    expect((document.getElementById('t-side') as HTMLElement).classList.contains('collapsed')).toBe(true)
  })

  it("la scorciatoia 'b' è ignorata dentro un input", () => {
    mountTauSide()
    wireTau()
    const input = document.getElementById('meta-x') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))
    expect((document.getElementById('t-side') as HTMLElement).classList.contains('collapsed')).toBe(false)
  })

  it('i campi Progetto restano nel DOM da compresso', () => {
    mountTauSide()
    const { handle } = wireTau()
    handle.set(true)
    expect(document.getElementById('meta-x')).toBeTruthy()
  })
})

describe('garanzie a livello di sorgente', () => {
  it('μ wira makeCollapse con la chiave namespaced e non ha più toggleSidebar JS', () => {
    const main = read('src/tools/miu/main.ts')
    const html = read('src/tools/miu/index.html')
    expect(main).toContain("makeCollapse")
    expect(main).toContain("miu:sidebar-collapsed")
    // niente più funzione/handler inline penzolante
    expect(html).not.toMatch(/function toggleSidebar/)
    expect(html).not.toMatch(/onclick="toggleSidebar\(\)"/)
  })
})
