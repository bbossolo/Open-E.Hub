/**
 * Codifica dei DXF ANSI: lettura a flusso con fallback e ri-codifica simmetrica.
 *
 * I DXF salvati dai CAD italiani sono spesso ANSI/cp1252, non UTF-8. Decodificarli
 * con `TextDecoder('utf-8')` non fatale produce U+FFFD al posto di à/è/° — mojibake
 * silenzioso che finisce nei nomi layer e, in export, nel file consegnato. Il rimedio
 * è in due metà simmetriche:
 *
 * 1. in LETTURA si tenta UTF-8 STRETTO (fatal): al primo byte non valido scatta il
 *    TypeError e si rilegge da capo in windows-1252. I file UTF-8 validi non pagano nulla;
 * 2. in SCRITTURA, se la sorgente era cp1252, si ri-codifica l'output in cp1252
 *    (Blob serializza le stringhe in UTF-8: un file con $DWGCODEPAGE ANSI_1252 e byte
 *    UTF-8 mostrerebbe «Ã¨» in AutoCAD). Con decode+encode simmetrici le righe non
 *    toccate tornano byte-per-byte identiche.
 */

export type CodificaDxf = 'utf-8' | 'windows-1252'

/** Chi consuma il testo a pezzi: AnalizzatoreDxf, RiscrittoreDxf, LettoreDxf. */
export interface ConsumatoreTesto {
  push(testo: string): void
}

/**
 * Legge il file a flusso decodificando con fallback. `creaConsumatore` è una
 * FACTORY chiamata a ogni tentativo con la codifica di quel tentativo: i
 * consumatori sono stateful, e se l'UTF-8 fallisce a metà file si deve ripartire
 * da zero con un consumatore nuovo. `onProgress(frazione)` riparte da 0 sul
 * secondo tentativo. `codificaNota` (es. rilevata da un'analisi precedente dello
 * stesso file) salta il tentativo UTF-8 e legge direttamente in quella codifica.
 */
export async function leggiStreamConFallback<T extends ConsumatoreTesto>(
  file: File,
  creaConsumatore: (codifica: CodificaDxf) => T,
  onProgress?: (frazione: number) => void,
  codificaNota?: CodificaDxf,
): Promise<{ consumatore: T; codifica: CodificaDxf }> {
  if (codificaNota === 'windows-1252') {
    return { consumatore: await unaPassata(file, creaConsumatore(codificaNota), codificaNota, onProgress), codifica: codificaNota }
  }
  try {
    return { consumatore: await unaPassata(file, creaConsumatore('utf-8'), 'utf-8', onProgress), codifica: 'utf-8' }
  } catch (err) {
    if (!(err instanceof TypeError)) throw err
    // byte non UTF-8: è un DXF ANSI (cp1252, il caso italiano) — si rilegge
    if (onProgress) onProgress(0)
    return { consumatore: await unaPassata(file, creaConsumatore('windows-1252'), 'windows-1252', onProgress), codifica: 'windows-1252' }
  }
}

async function unaPassata<T extends ConsumatoreTesto>(
  file: File,
  consumatore: T,
  codifica: CodificaDxf,
  onProgress?: (frazione: number) => void,
): Promise<T> {
  const decoder = new TextDecoder(codifica, { fatal: codifica === 'utf-8' })
  const reader = file.stream().getReader()
  const totale = file.size || 1
  let letti = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      letti += value.byteLength
      consumatore.push(decoder.decode(value, { stream: true }))
      if (onProgress) onProgress(Math.min(1, letti / totale))
    }
    consumatore.push(decoder.decode()) // svuota il decoder
  } finally {
    reader.releaseLock()
  }
  return consumatore
}

/* I 27 codepoint della fascia 0x80–0x9F che in cp1252 non coincidono col latin-1.
   Tutto il resto (≤ 0xFF) si codifica col valore del codepoint. */
const SPECIALI_CP1252: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
}

/**
 * Encoder windows-1252 (TextEncoder sa fare solo UTF-8). I caratteri non
 * rappresentabili diventano `?` e si contano in `nonMappabili` — con input che
 * viene da cp1252 e stringhe iniettate ASCII non dovrebbe accadere mai.
 *
 * I codepoint ≤ 0xFF passano DIRETTI al byte, C1 compresi: così l'encoder è
 * l'inverso esatto sia del decoder WHATWG (browser/Electron: 0x80 → €, e i 5
 * byte non definiti restano controlli) sia dei runtime senza ICU completo che
 * decadono a latin-1 (0x80 → U+0080) — il round-trip byte-per-byte tiene su
 * tutti i 256 byte in entrambi i mondi.
 */
export class CodificatoreCp1252 {
  nonMappabili = 0

  codifica(testo: string): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(new ArrayBuffer(testo.length))
    for (let i = 0; i < testo.length; i++) {
      const c = testo.charCodeAt(i)
      const sp = SPECIALI_CP1252[c]
      if (sp !== undefined) out[i] = sp
      else if (c <= 0xFF) out[i] = c
      else { out[i] = 0x3F; this.nonMappabili++ } // '?'
    }
    return out
  }
}
