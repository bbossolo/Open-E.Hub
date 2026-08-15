import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Test di CONTRATTO cross-tool sul bus (`sendToHub`/`onHubMessage`) — PREVENGONO
 * due classi di bug viste sul campo:
 *
 * 1. Un tool pubblica `app:project-update`/`app:full-state` con un appId DIVERSO
 *    da quello REGISTRATO in `src/hub/data/registry.ts` → l'hub scarta il
 *    messaggio in SILENZIO (nessun relay, `hub/main.js`: valida l'appId contro
 *    `APP_REGISTRY`). Il tool sembra funzionare, ma nessun altro tool riceve mai
 *    i suoi dati, e «Salva Open E.Hub»/import cross-tool falliscono senza errore.
 *
 * 2. Un tool non gestisce `hub:collect-state`/`hub:restore-state` → «Salva
 *    Open E.Hub» lo esclude in silenzio dal progetto salvato (nessuna eccezione,
 *    il timeout del collector scade e basta), e non viene mai ripristinato.
 *
 * Analisi STATICA sul testo sorgente (non esecuzione): main.js/index.html non
 * sono moduli importabili in isolamento (script pieni di DOM), quindi il
 * contratto si verifica a livello di stringhe — ma è esattamente il tipo di
 * controllo che avrebbe individuato quei bug PRIMA che diventassero un
 * problema di dati persi in produzione.
 */

import { miuSource } from '../miu/miu-src'

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')
// μ ha estratto lo script inline in legacy/*.js: il codice del bus non vive più
// in un solo file. `srcOf` restituisce il sorgente COMPLETO del tool, così il
// contratto vale ovunque finisca il codice.
const MULTI_FILE: Record<string, () => string> = { miu: miuSource }
const srcOf = (t: ToolEntry): string => (MULTI_FILE[t.name] ? MULTI_FILE[t.name]!() : read(t.file))

/** Un tool per il quale ha senso verificare il contratto bus: registryId (come
 *  in registry.ts) + il file sorgente principale dove cercare le stringhe. */
interface ToolEntry { name: string; registryId: string; file: string }

const TOOLS: ToolEntry[] = [
  { name: 'miu', registryId: 'miu-price-list', file: 'src/tools/miu/index.html' },
  { name: 'beta', registryId: 'beta-contabilita', file: 'src/tools/beta/main.ts' },
  { name: 'delta', registryId: 'delta-pages', file: 'src/tools/delta/main.js' },
  { name: 'chi', registryId: 'chi-refs', file: 'src/tools/chi/main.js' },
]

/** Nessun tool di questa suite è «stateless»: TUTTI partecipano al Progetto Open E.Hub.
 *  Se un tool nuovo non tiene stato di progetto, dichiararlo qui — ma con la
 *  consapevolezza che «Salva Open E.Hub» lo escluderà. */
const STATELESS_TOOLS = new Set<string>([])

/** Estrae gli appId letterali che identificano il TOOL STESSO (mittente) nei
 *  messaggi `app:project-update`/`app:full-state`/`app:ready` — NON ogni
 *  `appId` nel sorgente: `hub:navigate`/richieste verso altri tool (es. il
 *  un bottone che porta a un altro tool) usano `appId` per
 *  riferirsi a un ALTRO tool, non per l'identità del mittente, e non vanno
 *  confusi col contratto verificato qui. */
function findOwnAppIdLiterals(src: string): string[] {
  const out: string[] = []
  const selfTypes = /type\s*:\s*['"]app:(?:project-update|full-state|ready)['"]/g
  let mt: RegExpExecArray | null
  while ((mt = selfTypes.exec(src))) {
    // l'appId può comparire prima o dopo `type` nello stesso oggetto letterale:
    // guarda in una finestra di ~200 caratteri intorno al match.
    const start = Math.max(0, mt.index - 200)
    const window = src.slice(start, mt.index + mt[0].length + 200)
    const idMatch = /appId\s*:\s*['"]([^'"]+)['"]/.exec(window)
    if (idMatch) out.push(idMatch[1])
  }
  return out
}

describe('contratto bus cross-tool (registry ↔ appId + Salva Open E.Hub)', () => {
  it('src/hub/data/registry.ts registra tutti gli id attesi dai TOOLS di questo test', () => {
    const registrySrc = read('src/hub/data/registry.ts')
    for (const t of TOOLS) {
      expect(registrySrc, `registry.ts deve contenere id: '${t.registryId}' (${t.name})`).toContain(`'${t.registryId}'`)
    }
  })

  for (const t of TOOLS) {
    it(`${t.name}: ogni appId letterale nel bus coincide con l'id registrato ('${t.registryId}')`, () => {
      const path = resolve(ROOT, t.file)
      if (!existsSync(path)) {
        // il file atteso non esiste: meglio un fallimento esplicito che un test
        // silenziosamente "verde" perché non ha trovato nulla da controllare.
        throw new Error(`file sorgente non trovato per ${t.name}: ${t.file} (aggiorna TOOLS in questo test)`)
      }
      const src = srcOf(t)
      const literals = [...new Set(findOwnAppIdLiterals(src))]
      if (!literals.length) {
        // nessun appId nel bus: ok SOLO se il tool è un'eccezione dichiarata.
        expect(STATELESS_TOOLS.has(t.name), `${t.name} non usa mai 'appId' nel bus — se è intenzionale aggiungilo a STATELESS_TOOLS, altrimenti è quel bug che si ripete`).toBe(true)
        return
      }
      for (const lit of literals) {
        expect(lit, `${t.name} usa appId '${lit}' nel bus ma il suo id registrato è '${t.registryId}' — l'hub scarterebbe il messaggio in silenzio (vedi hub/main.js: APP_REGISTRY.some(a => a.id === msg.appId))`).toBe(t.registryId)
      }
    })
  }

  for (const t of TOOLS) {
    if (STATELESS_TOOLS.has(t.name)) continue
    it(`${t.name}: partecipa al progetto Open E.Hub (hub:collect-state → app:full-state, hub:restore-state)`, () => {
      const src = srcOf(t)
      expect(src, `${t.name} non gestisce 'hub:collect-state' — «Salva Open E.Hub» lo esclude in silenzio dal progetto salvato`).toContain('hub:collect-state')
      expect(src, `${t.name} non gestisce 'hub:restore-state' — non viene mai ripristinato da un progetto Open E.Hub salvato`).toContain('hub:restore-state')
      expect(src, `${t.name} gestisce hub:collect-state ma non risponde con 'app:full-state'`).toContain('app:full-state')
    })
  }

  it('nessun tool "stateless" dichiarato supporta in realtà collect/restore-state (l\'eccezione va rimossa se non è più vera)', () => {
    for (const name of STATELESS_TOOLS) {
      const t = TOOLS.find(x => x.name === name)!
      const src = srcOf(t)
      const hasCollect = src.includes('hub:collect-state')
      const hasRestore = src.includes('hub:restore-state')
      if (hasCollect || hasRestore) {
        throw new Error(`${name} è in STATELESS_TOOLS ma il sorgente ORA gestisce collect/restore-state — togli ${name} dall'eccezione in questo test`)
      }
    }
  })
})
