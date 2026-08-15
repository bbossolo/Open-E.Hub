import { describe, it, expect } from 'vitest'
import { miuSource } from '../miu/miu-src'

/**
 * PROGETTO E.HUB (.ehub): ciò che si salva è ciò che si riapre.
 *
 * Due buchi veri, trovati insieme e della stessa natura — lo stato che il tool costruisce
 * lavorando non finiva nel file che l'utente si porta via:
 *
 *  · un tool di disegno salvava il DISEGNO ma non il RICONOSCIMENTO (albero dei layer +
 *    elementi con la loro famiglia). Riaprire un progetto dava la pianta senza il
 *    computo: per riaverlo bisognava re-importare il DXF — che pesa fino a 240 MB.
 *  · μ salvava le voci e le misure ma non `categoria`, cioè la STRUTTURA del computo
 *    (Ambito|Disciplina|Voce). Il computo tornava un elenco piatto, e le categorie a 3
 *    livelli assegnate all'import sparivano proprio nel momento in cui servono.
 *
 * Convenzione dei test main.js/index.html della suite: assertion STRUTTURALE sul sorgente
 * (monoliti browser, non isolabili in jsdom senza scaffolding enorme).
 */

function extractFunctionBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`funzione non trovata: ${name}`)
  const braceStart = src.indexOf('{', start)
  let depth = 0
  let i = braceStart
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break } }
  }
  return src.slice(start, i)
}

describe('μ: il .ehub si porta dietro le CATEGORIE del computo', () => {
  const src = miuSource()

  it('collectMiuState salva `categoria` (Ambito|Disciplina|Voce)', () => {
    const body = extractFunctionBody(src, 'collectMiuState')
    expect(body).toMatch(/categoria:\s*JSON\.parse\(JSON\.stringify\(S\.categoria\s*\|\|\s*\{\}\)\)/)
  })

  it('restoreMiuState le ripristina PRIMA di migrateLegacySel, che rimappa le chiavi', () => {
    const body = extractFunctionBody(src, 'restoreMiuState')
    expect(body).toMatch(/S\.categoria\s*=\s*\(state&&state\.categoria\)/)
    // migrateLegacySel sposta S.categoria[chiaveVecchia] → S.categoria[chiaveNuova]:
    // se le categorie arrivassero dopo, quella rimappatura lavorerebbe sul vuoto
    const iCat = body.indexOf('S.categoria=')
    const iMig = body.indexOf('migrateLegacySel(')
    expect(iCat).toBeGreaterThan(-1)
    expect(iMig).toBeGreaterThan(iCat)
  })

  it('un .ehub VECCHIO senza `categoria` si apre lo stesso (default {})', () => {
    const body = extractFunctionBody(src, 'restoreMiuState')
    expect(body).toMatch(/S\.categoria=\(state&&state\.categoria\)\?JSON\.parse\(JSON\.stringify\(state\.categoria\)\):\{\}/)
  })
})
