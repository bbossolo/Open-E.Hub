import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * CONTROLLI PROGETTO E.HUB — Apri/Salva (.ehub) in DUE contesti + project-gate.
 *
 * In passato i pulsanti erano in 2 contesti (app-bar + welcome), poi
 * RIPRISTINATI anche nella sidebar (3 contesti). Su richiesta utente la
 * duplicazione nella welcome screen è stata rimossa (comprimeva lo spazio
 * verticale di #welcome-cards fino al clipping): i pulsanti restano SOLO in
 * app-bar (tool aperto) e sidebar footer (sempre raggiungibili dal rail).
 * Il project-gate (#project-gate) riusa gli stessi onclick "Nuovo progetto"/
 * "Apri progetto" come TERZO contesto (nessuna logica duplicata) — "Salva
 * progetto" non compare nel gate (non c'è ancora nulla da salvare). Questo
 * test blinda i contesti e l'hook dirty (.js-save-project).
 */

const HTML = readFileSync(
  resolve(__dirname, '../../src/hub/index.html'),
  'utf-8',
)

/** Conta le occorrenze non sovrapposte di un literal in una stringa. */
function count(haystack: string, needle: string): number {
  let n = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    n++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return n
}

describe('hub index.html — controlli progetto Open E.Hub (app-bar + sidebar)', () => {
  it('espone 3 pulsanti "Apri progetto" (app-bar + sidebar + project-gate)', () => {
    expect(count(HTML, 'onclick="openEhubProject()"')).toBe(3)
  })

  it('espone 2 pulsanti "Salva progetto" (app-bar + sidebar)', () => {
    expect(count(HTML, 'onclick="saveEhubProject()"')).toBe(2)
  })

  it('espone 3 pulsanti "Nuovo progetto" (app-bar + sidebar + project-gate)', () => {
    expect(count(HTML, 'onclick="newEhubProject()"')).toBe(3)
  })

  it('la sidebar ha il blocco #side-proj nel footer (ripristinato)', () => {
    expect(HTML).toContain('id="side-proj"')
    expect(count(HTML, 'class="side-proj-btn"')).toBe(3) // Nuovo + Apri + Salva con nome (sidebar)
    expect(count(HTML, 'class="side-proj-btn js-save-project"')).toBe(1) // Salva (sidebar)
  })

  it('mantiene #sidebar-footer e #stat-row (le statistiche restano)', () => {
    expect(HTML).toContain('id="sidebar-footer"')
    expect(HTML).toContain('id="stat-row"')
  })

  it('tutte le istanze "Salva" portano l\'hook dirty .js-save-project (2)', () => {
    expect(count(HTML, 'js-save-project')).toBe(2)
  })

  it('app-bar usa lo stile unificato .proj-act (welcome non li duplica più)', () => {
    expect(count(HTML, 'class="proj-act"')).toBe(3) // Nuovo + Apri + Salva con nome (app-bar)
    expect(count(HTML, 'class="proj-act js-save-project"')).toBe(1) // Salva progetto (app-bar)
  })

  it('non usa più .bar-act / .wlc-theme-opt per i pulsanti progetto', () => {
    // l'unico .bar-act rimasto in #bar-actions è "Ricarica"
    expect(count(HTML, 'class="bar-act"')).toBe(1)
    expect(HTML).not.toContain('class="wlc-theme-opt" onclick="openEhubProject()"')
  })

  it('conserva l\'input file nascosto #ehub-file con il suo handler', () => {
    expect(HTML).toContain('id="ehub-file"')
    expect(HTML).toContain('onchange="onEhubFile(this)"')
  })
})
