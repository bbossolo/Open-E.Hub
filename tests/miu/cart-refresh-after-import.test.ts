import { describe, it, expect } from 'vitest'
import { miuSource } from './miu-src'

/**
 * Regressione: "Aggiungi al computo" dalla distinta Ampère sembrava non fare
 * nulla quando l'overlay Computo Metrico era già aperto. Le voci finivano
 * davvero in S.qty/S.custom (commitRowToElencoPrezzi), ma senza richiamare
 * refreshCartOverlayIfOpen() l'overlay già aperto non veniva ripatchato — nessun
 * errore, solo silenzio visivo. Fix: src/tools/miu/legacy/import-distinte.js
 * (phiConfirmDistinta chiama ora refreshCartOverlayIfOpen()).
 */
const html = miuSource()

describe('contratto sul sorgente inline — le conferme di import aggiornano il computo aperto', () => {
  it('phiConfirmDistinta (Ampère) richiama refreshCartOverlayIfOpen dopo aver scritto le voci', () => {
    const fn = html.match(/function phiConfirmDistinta\([\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).not.toBe('')
    expect(fn).toContain('refreshCartOverlayIfOpen(')
  })

})
