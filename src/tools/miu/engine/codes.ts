/**
 * Helper puri e generici (indipendenti dal formato) su intestazioni e codici voce.
 * Estratti fedelmente da PriceList_v2_3.html; riusati dal parser legacy e dai
 * futuri parser per-famiglia.
 */

/** Normalizza un'intestazione per il confronto: minuscolo, senza accenti, solo [a-z0-9]. */
export function normH(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Anteprima breve a una riga: prima riga del testo, spazi compattati, troncata a `max`.
 * Riusata dai parser per generare `desc_short` quando manca una descrizione sintetica.
 */
export function firstLinePreview(text: string, max = 220): string {
  const firstLine = (text || '').split(/[\n\r]/)[0].trim().replace(/\s+/g, ' ')
  return firstLine.length > max ? firstLine.substring(0, max) + '…' : firstLine
}

/**
 * Spezza un codice nei suoi segmenti gerarchici progressivi.
 * Splitta su QUALSIASI separatore "-" o ".", quindi ogni segmento è un livello:
 * "VEN25-10.05.03.a" → ["VEN25","VEN25-10","VEN25-10.05","VEN25-10.05.03","VEN25-10.05.03.a"]
 * Gestisce separatori misti "-"/"." e il suffisso ".-" finale della Lombardia.
 * (NB: il commento originale nel monolite ometteva per errore il primo livello "VEN25".)
 */
export function codeLevels(cod: string): string[] {
  const c = cod.replace(/\.-$/, '')                 // togli ".-" finale (Lombardia)
  const parts = c.split(/[-.]/).filter(Boolean)     // spezza su - e .
  const levels: string[] = []
  let acc = ''
  for (let k = 0; k < parts.length; k++) {
    // ricostruisci il prefisso usando il separatore originale
    if (k === 0) {
      acc = parts[0]
    } else {
      // trova il separatore reale tra parts[k-1] e parts[k] nel codice originale
      const sep = c.charAt(acc.length)              // carattere subito dopo l'accumulato
      acc = acc + (sep === '-' || sep === '.' ? sep : '.') + parts[k]
    }
    levels.push(acc)
  }
  return levels
}
