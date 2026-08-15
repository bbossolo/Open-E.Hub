import { describe, it, expect } from 'vitest'
import { hubSource } from '../hub/hub-src'

/**
 * Interconnessione di suite: un import non deve distruggere il lavoro
 * avviato altrove. Verifica sui sorgenti VIVI (i tool/hub sono monoliti DOM non unit-testabili
 * sul bus) che le due guardie chiave esistano e non regrediscano:
 * Verifica sul sorgente VIVO dell'hub (monolite DOM non unit-testabile sul bus) che
 * aprire un progetto con modifiche non salvate chieda conferma (salva/scarta/annulla).
 * Affianca la regola di interconnessione del progetto (test I/O + bus su ogni relay).
 */
const HUB = hubSource()

describe('guardia import a livello Open E.Hub (hub)', () => {
  it('applyEhubProject chiede conferma quando il progetto è «dirty» (salva/scarta/annulla)', () => {
    // la guardia è nel ramo di apertura ed è condizionata a projectDirty + confirm.
    expect(HUB).toMatch(/projectDirty\s*&&\s*typeof window\.confirm/)
    expect(HUB).toMatch(/SALVA prima di aprire/i)
    expect(HUB).toMatch(/SCARTANDO le modifiche/i)
  })

  it('lo stato per-appId è generico (niente più phiProject/pricelistComputo/tauComputo hard-coded)', () => {
    expect(HUB).not.toMatch(/hubState\.(phiProject|pricelistComputo|tauComputo)/)
    expect(HUB).toMatch(/setToolProject\(hubState/)
    expect(HUB).toMatch(/projectStateMessages\(hubState\)/)
  })
})
