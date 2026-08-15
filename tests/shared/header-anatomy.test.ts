// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * COMPONENTE HEADER CONDIVISO (.ehb-hdr)
 * (audit storico §7 header/brand)
 *
 * Un'unica anatomia di header (brand a sinistra, azioni a destra) nel design
 * system, adottata dai tool della suite. Garanzie:
 *  1. ogni superficie usa .ehb-hdr > .ehb-hdr__brand(.ehb-logo) + .ehb-hdr__actions;
 *  2. le vecchie classi ad hoc divergenti sono dismesse dalle intestazioni migrate;
 *  3. nessuna azione/ponte esistente è persa (id + onclick invariati), e i ponti
 *     di bus restano dentro le azioni.
 */

const SRC = resolve(__dirname, '../..')
function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf8')
}
/** Parserizza l'HTML del tool e restituisce il primo <header>. */
function header(rel: string): HTMLElement {
  document.documentElement.innerHTML = read(rel)
  const hdr = document.querySelector('header')
  expect(hdr, `${rel}: manca un <header>`).toBeTruthy()
  return hdr as HTMLElement
}

const TOOLS = {
  'μ Prezzi': 'src/tools/miu/index.html',
} as const

describe('anatomia header condivisa adottata', () => {
  for (const [tool, rel] of Object.entries(TOOLS)) {
    it(`${tool}: header è .ehb-hdr con brand(.ehb-logo) e azioni`, () => {
      const hdr = header(rel)
      expect(hdr.classList.contains('ehb-hdr')).toBe(true)

      const brand = hdr.querySelector('.ehb-hdr__brand')
      expect(brand, `${tool}: manca .ehb-hdr__brand`).toBeTruthy()
      expect(brand!.querySelector('.ehb-logo'), `${tool}: il brand non riusa .ehb-logo`).toBeTruthy()

      // gruppo azioni: .ehb-hdr__actions oppure un .hdr-actions specifico del tool
      const actions = hdr.querySelector('.ehb-hdr__actions, .hdr-actions')
      expect(actions, `${tool}: manca il gruppo azioni a destra`).toBeTruthy()
    })

    it(`${tool}: l'accento è governato da data-tool`, () => {
      const hdr = header(rel)
      const tooled = hdr.matches('[data-tool]') || !!hdr.querySelector('[data-tool]')
      expect(tooled, `${tool}: nessun data-tool nell'header`).toBe(true)
    })
  }

  it('brand è il primo figlio dell\'header; azioni allineate a destra', () => {
    for (const [tool, rel] of Object.entries(TOOLS)) {
      const hdr = header(rel)
      expect(
        (hdr.firstElementChild as HTMLElement).classList.contains('ehb-hdr__brand'),
        `${tool}: il brand non è il primo figlio`,
      ).toBe(true)
    }
  })
})

describe('classi ad hoc dismesse nelle intestazioni migrate', () => {
  const DISMISSED: Record<string, string[]> = {
    'src/tools/miu/index.html': ['class="logo"', 'logo-text', 'logo-mu', 'hdr-spacer'],
  }
  for (const [rel, classes] of Object.entries(DISMISSED)) {
    it(`${rel}: non contiene più ${classes.join(', ')}`, () => {
      const blob = read(rel)
      for (const c of classes) expect(blob, `trovato ancora ${c}`).not.toContain(c)
    })
  }
})

describe('nessuna perdita di azioni/ponti', () => {
  /** id → onclick atteso (ponti e azioni che NON devono cambiare). */
  const ACTIONS: Record<string, Record<string, string>> = {
    'src/tools/miu/index.html': {
      'drop-zone': '',
      'folder-btn': 'openFolder()',
    },
  }

  for (const [rel, ids] of Object.entries(ACTIONS)) {
    it(`${rel}: i ponti/azioni restano dentro il gruppo azioni`, () => {
      const hdr = header(rel)
      const actions = hdr.querySelector('.ehb-hdr__actions')!
      for (const id of Object.keys(ids)) {
        const el = document.getElementById(id)
        expect(el, `${rel}: id #${id} sparito`).toBeTruthy()
        expect(actions.contains(el), `${rel}: #${id} non è nelle azioni a destra`).toBe(true)
      }
    })

    it(`${rel}: gli onclick dei ponti/azioni sono invariati`, () => {
      header(rel)
      for (const [id, onclick] of Object.entries(ids)) {
        if (!onclick) continue
        const el = document.getElementById(id)!
        expect(el.getAttribute('onclick'), `${rel}: onclick di #${id} cambiato`).toBe(onclick)
      }
    })
  }
})
