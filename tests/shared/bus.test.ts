import { describe, it, expect } from 'vitest'
import { parseHubMessage, PALETTES, FONTS, TEXT_SIZES, MOTION_MODES, SHADOW_INTENSITIES, sharedIdOf } from '../../src/shared/bus'

describe('parseHubMessage — validazione messaggi hub→tool', () => {
  it('accetta hub:set-theme con tema valido', () => {
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'light' })).toEqual({ type: 'hub:set-theme', theme: 'light' })
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark' })?.type).toBe('hub:set-theme')
  })
  it('accetta hub:project-state con source', () => {
    const m = parseHubMessage({ type: 'hub:project-state', source: 'phi', project: { a: 1 } })
    expect(m?.type).toBe('hub:project-state')
  })
  // Interconnessione: il validatore DEVE continuare ad accettare le source usate dalle
  // integrazioni reali fra tool (distinta, computo, carrello). Se qualcuno
  // restringesse le source ammesse, i flussi si romperebbero in silenzio.
  it('accetta le source delle integrazioni cross-tool', () => {
    for (const source of ['phi', 'pricelist', 'tau']) {
      const m = parseHubMessage({ type: 'hub:project-state', source, project: { items: [] } })
      expect(m, `source "${source}" deve passare`).not.toBeNull()
      expect((m as { source: string }).source).toBe(source)
    }
  })
  it('rifiuta tema non valido, tipi sconosciuti e non-oggetti', () => {
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'blue' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:project-state' })).toBeNull()   // manca source
    expect(parseHubMessage({ type: 'app:ready' })).toBeNull()           // non è hub→tool
    expect(parseHubMessage(null)).toBeNull()
    expect(parseHubMessage('hub:set-theme')).toBeNull()
  })

  // Intestazione azienda (studio) per le stampe — additiva, company o null.
  it('accetta hub:set-company con azienda o null, rifiuta shape errata', () => {
    expect(parseHubMessage({ type: 'hub:set-company', company: null })?.type).toBe('hub:set-company')
    const m = parseHubMessage({ type: 'hub:set-company', company: { name: 'Studio Demo', address: 'VR', logoHtml: '<img>' } })
    expect(m).not.toBeNull()
    expect((m as { company: { name: string } }).company.name).toBe('Studio Demo')
    expect(parseHubMessage({ type: 'hub:set-company', company: { address: 'x' } })).toBeNull() // manca name
    expect(parseHubMessage({ type: 'hub:set-company' })).toBeNull()                            // manca company
  })

  // La palette è una dimensione OPZIONALE su hub:set-theme, ortogonale al modo.
  it('accetta hub:set-theme con palette nota (oltre al modo)', () => {
    for (const palette of ['ardesia', 'carbonio', 'pergamena']) {
      const m = parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette })
      expect(m, `palette "${palette}" deve passare`).not.toBeNull()
      expect((m as { palette: string }).palette).toBe(palette)
    }
  })
  it('accetta i messaggi legacy hub:set-theme col solo modo (retro-compat)', () => {
    const m = parseHubMessage({ type: 'hub:set-theme', theme: 'light' })
    expect(m).toEqual({ type: 'hub:set-theme', theme: 'light' })
    // palette esplicitamente undefined non invalida il messaggio
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette: undefined })?.type)
      .toBe('hub:set-theme')
  })
  it('rifiuta hub:set-theme con palette malformata (non nell\'allowlist)', () => {
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette: 'blu' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette: '' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette: 42 })).toBeNull()
  })
  // Il catalogo cresce a ≥5 palette; ogni voce dell'allowlist deve passare.
  it('accetta hub:set-theme con le nuove palette (notturno, inchiostro)', () => {
    for (const palette of ['notturno', 'inchiostro']) {
      const m = parseHubMessage({ type: 'hub:set-theme', theme: 'light', palette })
      expect(m, `palette "${palette}" deve passare`).not.toBeNull()
      expect((m as { palette: string }).palette).toBe(palette)
    }
  })
  it('accetta ogni voce del catalogo PALETTES (allowlist = single source of truth)', () => {
    for (const palette of PALETTES) {
      expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette }), palette).not.toBeNull()
    }
  })

  // Il font di sistema, come la palette, è ORTOGONALE a tema/palette
  // e si propaga via un messaggio dedicato.
  it('accetta hub:set-font con ogni voce del catalogo FONTS', () => {
    for (const font of FONTS) {
      const m = parseHubMessage({ type: 'hub:set-font', font })
      expect(m, `font "${font}" deve passare`).not.toBeNull()
      expect((m as { font: string }).font).toBe(font)
    }
  })
  it('rifiuta hub:set-font con font non in allowlist o mancante', () => {
    expect(parseHubMessage({ type: 'hub:set-font', font: 'comic-sans' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-font', font: '' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-font' })).toBeNull()
  })

  // Dimensione testo, come font/palette, è ORTOGONALE alle altre
  // dimensioni e si propaga via un messaggio dedicato.
  it('accetta hub:set-text-size con ogni voce del catalogo TEXT_SIZES', () => {
    for (const size of TEXT_SIZES) {
      const m = parseHubMessage({ type: 'hub:set-text-size', size })
      expect(m, `size "${size}" deve passare`).not.toBeNull()
      expect((m as { size: string }).size).toBe(size)
    }
  })
  it('rifiuta hub:set-text-size con size non in allowlist o mancante', () => {
    expect(parseHubMessage({ type: 'hub:set-text-size', size: 'huge' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-text-size', size: '' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-text-size' })).toBeNull()
  })
  // Valore continuo --ui-scale opzionale nello stesso messaggio.
  it('accetta hub:set-text-size con scale numerico valido', () => {
    const m = parseHubMessage({ type: 'hub:set-text-size', size: 'md', scale: 1.22 })
    expect(m).not.toBeNull()
    expect((m as { scale: number }).scale).toBe(1.22)
  })
  it('rifiuta hub:set-text-size con scale non numerico o fuori range', () => {
    expect(parseHubMessage({ type: 'hub:set-text-size', size: 'md', scale: 'x' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-text-size', size: 'md', scale: 0.1 })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-text-size', size: 'md', scale: 5 })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-text-size', size: 'md', scale: Infinity })).toBeNull()
  })

  it('accetta hub:set-motion con ogni voce del catalogo MOTION_MODES', () => {
    for (const motion of MOTION_MODES) {
      const m = parseHubMessage({ type: 'hub:set-motion', motion })
      expect(m, `motion "${motion}" deve passare`).not.toBeNull()
      expect((m as { motion: string }).motion).toBe(motion)
    }
  })
  it('rifiuta hub:set-motion con motion non in allowlist o mancante', () => {
    expect(parseHubMessage({ type: 'hub:set-motion', motion: 'fast' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-motion' })).toBeNull()
  })

  it('accetta hub:set-shadow con ogni voce del catalogo SHADOW_INTENSITIES', () => {
    for (const shadow of SHADOW_INTENSITIES) {
      const m = parseHubMessage({ type: 'hub:set-shadow', shadow })
      expect(m, `shadow "${shadow}" deve passare`).not.toBeNull()
      expect((m as { shadow: string }).shadow).toBe(shadow)
    }
  })
  it('rifiuta hub:set-shadow con shadow non in allowlist o mancante', () => {
    expect(parseHubMessage({ type: 'hub:set-shadow', shadow: 'huge' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:set-shadow' })).toBeNull()
  })
})

// Regressione: un cavidotto/circuito NATIVO (mai adottato da un altro
// tool) non ha `sharedId` valorizzato su se stesso; il match cross-tool DEVE
// comunque risolvere lo stesso id che verrebbe pubblicato dall'altro tool.
describe('sharedIdOf — identità di pool cross-tool', () => {
  it('un oggetto NATIVO (mai adottato, niente sharedId) risolve dal proprio id locale + origine', () => {
    expect(sharedIdOf({ id: 'CC01' }, 'gamma')).toBe('gamma:CC01')
  })
  it('un oggetto ADOTTATO da un altro tool usa lo sharedId esplicito, non l\'id locale', () => {
    expect(sharedIdOf({ id: 'cond-1', sharedId: 'gamma:CC01' }, 'pi')).toBe('gamma:CC01')
  })
  it('pubblicazione (nativo) e match in arrivo (stesso oggetto) producono LO STESSO id', () => {
    const nativo = { id: 'CC01' }
    const idPubblicato = sharedIdOf(nativo, 'gamma')
    // un circuito che referenzia questo cavidotto pubblica lo stesso id calcolato:
    const condSharedIdInArrivo = 'gamma:CC01'
    expect(sharedIdOf(nativo, 'gamma')).toBe(condSharedIdInArrivo)
    expect(idPubblicato).toBe(condSharedIdInArrivo)
  })
})
