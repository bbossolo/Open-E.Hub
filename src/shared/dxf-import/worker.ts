/**
 * Worker d'import DXF: legge il file a flusso e restituisce la scena.
 *
 * Sta su un thread separato per due motivi, entrambi verificati sul vero:
 * 1. una tavola da 240 MB impiega ~5 s a essere letta — sul thread dell'interfaccia
 *    significa finestra congelata, nessuna barra di avanzamento, e con ogni probabilità il
 *    processo ucciso dal sistema;
 * 2. il picco di memoria (~700 MB) resta confinato qui e viene liberato alla chiusura,
 *    invece di gonfiare per sempre l'heap della pagina.
 *
 * Il file arriva come `File` (clonabile) e viene consumato con `stream()`: la stringa
 * intera non viene MAI materializzata.
 */
import { leggiStreamConFallback } from './codifica'
import { LettoreDxf } from './read'
import { scenaDaLettura } from './scene'
import type { DxfParseOptions, DxfScene } from './types'

export interface DxfWorkerRichiesta {
  file: File
  opts?: Omit<DxfParseOptions, 'onProgress'>
}

export type DxfWorkerRisposta =
  | { tipo: 'avanzamento'; frazione: number }
  | { tipo: 'fatto'; scena: DxfScene }
  | { tipo: 'errore'; messaggio: string }

const post = (m: DxfWorkerRisposta): void => { (self as unknown as Worker).postMessage(m) }

self.onmessage = async (ev: MessageEvent<DxfWorkerRichiesta>): Promise<void> => {
  const { file, opts } = ev.data
  try {
    /* La codifica (UTF-8 stretto → fallback windows-1252) è nel modulo condiviso.
       La lettura è ~metà del lavoro: l'altra metà è l'espansione dei blocchi. */
    let prossimoAvviso = 0
    const { consumatore: lettore } = await leggiStreamConFallback(
      file,
      () => { prossimoAvviso = 0; return new LettoreDxf() },
      (frazione) => {
        if (frazione >= prossimoAvviso) {
          post({ tipo: 'avanzamento', frazione: frazione * 0.5 })
          prossimoAvviso = frazione + 0.02
        }
      },
    )

    post({ tipo: 'avanzamento', frazione: 0.55 })
    const scena = scenaDaLettura(lettore.chiudi(), opts)
    post({ tipo: 'avanzamento', frazione: 1 })
    post({ tipo: 'fatto', scena })
  } catch (e) {
    post({ tipo: 'errore', messaggio: e instanceof Error ? e.message : String(e) })
  }
}
