import { describe, it, expect } from 'vitest'
import { appiattisci, type LayerTrovato } from '../../src/shared/dxf-import/analizza'
import {
  aggiorna, firmaDi, idDaNome, leggiArchivio, nuovoProfilo, riconosci, salvaProfilo,
} from '../../src/shared/xref/profilo'
import { PARTI, inventario } from '../../src/shared/memoria-studio/memoria'

/**
 * Il profilo del collaboratore.
 *
 * Il valore del tool non è normalizzare un file: è normalizzare il ventesimo file dello stesso
 * collaboratore senza rifare le stesse cento decisioni. Questi test coprono le due regole che
 * lo rendono affidabile — si ricorda solo ciò che ha deciso una persona, e si riconosce il
 * mittente dai layer e non dal nome del file, che cambia a ogni consegna.
 */

const layer = (nome: string, nEntita = 10): LayerTrovato => ({
  nome, ...appiattisci(nome),
  colore: 7, spento: false, congelato: false, bloccato: false,
  linetype: 'Continuous', lineweight: -3,
  nEntita, nTesti: 0, nInsert: 0, vuoto: nEntita === 0,
})

/** Uno store di prova: `memoria-studio` accetta qualunque cosa sappia leggere e scrivere. */
function store() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

const ORA = '2026-07-26'

describe('χ Refs · profilo del collaboratore', () => {
  it('si ricorda solo le decisioni prese a mano', () => {
    // Le proposte automatiche non sono conoscenza dello studio: sono il tool che indovina. Se
    // un domani il riconoscimento migliora, non devono restare congelate in un profilo.
    const p = aggiorna(nuovoProfilo('Studio Rossi', ORA), [
      { layer: layer('IE-MURATURA'), destinazione: 'MURATURA', manuale: true },
      { layer: layer('L SOTTILI'), destinazione: 'ARREDI', manuale: false },
    ], ORA)
    expect(p.regole).toEqual({ IEMURATURA: 'MURATURA' })
  })

  it('una regola vale per tutte le varianti dello stesso layer', () => {
    const p = aggiorna(nuovoProfilo('x', ORA), [
      { layer: layer('TAV-B-XREF|muri'), destinazione: 'MURATURA', manuale: true },
    ], ORA)
    // La chiave è normalizzata: la stessa decisione copre anche `01_MURI` e `Muri`.
    expect(p.regole.MURI).toBe('MURATURA')
  })

  it('riconosce il collaboratore dai layer, non dal nome del file', () => {
    // I nomi dei file cambiano a ogni consegna; l'elenco dei layer no.
    const s = store()
    const negri = aggiorna(nuovoProfilo('Studio Rossi', ORA), [
      { layer: layer('IE-MURATURA'), destinazione: 'MURATURA', manuale: true },
      { layer: layer('IE-ARREDI'), destinazione: 'ARREDI', manuale: true },
      { layer: layer('IE-TESTO'), destinazione: 'TESTI', manuale: true },
    ], ORA)
    salvaProfilo(s, negri)

    const nuovoFile = [layer('IE-MURATURA'), layer('IE-ARREDI'), layer('IE-TESTO'), layer('IE-FM')]
    const r = riconosci(nuovoFile, leggiArchivio(s))
    expect(r).toBeTruthy()
    expect(r!.profilo.nome).toBe('Studio Rossi')
    expect(r!.copertura).toBeGreaterThan(0.7)
  })

  it('non propone niente quando il file è di un altro', () => {
    // Una proposta sbagliata costa più di nessuna proposta: l'utente si fida e non ricontrolla.
    const s = store()
    salvaProfilo(s, aggiorna(nuovoProfilo('Studio Rossi', ORA), [
      { layer: layer('IE-MURATURA'), destinazione: 'MURATURA', manuale: true },
    ], ORA))
    const altro = [layer('01_MURI'), layer('04_ARREDI'), layer('Strutturale - Portante'), layer('PDF3_Testo')]
    expect(riconosci(altro, leggiArchivio(s))).toBeNull()
  })

  it('rinominare un profilo non ne crea un doppione', () => {
    expect(idDaNome('Studio Rossi')).toBe('studio-rossi')
    expect(idDaNome('  STUDIO   ROSSI  ')).toBe('studio-rossi')
  })

  it('la firma ignora i layer che nessuna entità usa', () => {
    // Sono la maggioranza (97 su 150 su una tavola reale) e non dicono niente su chi ha fatto il file.
    expect(firmaDi([layer('MURI'), layer('roba-vecchia', 0)])).toEqual(['MURI'])
  })
})

describe('χ Refs · il profilo entra nella memoria dello studio', () => {
  it('è una parte dichiarata, quindi backup ed export lo portano con sé', () => {
    const p = PARTI.find(x => x.id === 'profili-collaboratori')
    expect(p).toBeTruthy()
    expect(p!.fusione).toBe('oggetto') // fondere unisce i profili, non li sovrascrive
    expect(p!.tool).toBe('χ')
  })

  it('compare nell’inventario quando c’è qualcosa dentro', () => {
    const s = store()
    salvaProfilo(s, nuovoProfilo('Studio Rossi', ORA))
    const inv = inventario(s, null)
    const voce = inv.find(x => x.parte.id === 'profili-collaboratori')
    expect(voce).toBeTruthy()
    expect(voce!.n).toBe(1)
  })
})
