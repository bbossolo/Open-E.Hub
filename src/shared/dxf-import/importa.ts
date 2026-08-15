/**
 * Import di un DXF dal lato interfaccia: una chiamata, una barra di avanzamento, una scena.
 *
 * Il worker è inlinato (`?worker&inline`) perché ogni tool della suite viene compilato in un
 * unico HTML self-contained (`vite-plugin-singlefile`): un worker come file separato non
 * sopravvivrebbe al build.
 *
 * Se i Worker non ci sono (jsdom nei test, ambienti ridotti) si ripiega sul parse sincrono:
 * stessa funzione, stesso risultato, solo senza avanzamento.
 */
import DxfWorker from './worker?worker&inline'
import type { DxfWorkerRisposta } from './worker'
import { dxfToScene } from './scene'
import type { DxfParseOptions, DxfScene } from './types'

export interface ImportaDxfOpzioni extends Omit<DxfParseOptions, 'onProgress'> {
  /** 0 → 1. Chiamata spesso: aggiornare la UI, non fare lavoro pesante qui dentro. */
  onProgress?: (frazione: number) => void
}

export function importaDxf(file: File, opts: ImportaDxfOpzioni = {}): Promise<DxfScene> {
  const { onProgress, ...parseOpts } = opts

  if (typeof Worker === 'undefined') {
    return file.text().then((t) => dxfToScene(t, { ...parseOpts, onProgress }))
  }

  return new Promise<DxfScene>((resolve, reject) => {
    const w = new DxfWorker()
    const chiudi = (): void => { w.terminate() }

    w.onmessage = (ev: MessageEvent<DxfWorkerRisposta>): void => {
      const m = ev.data
      if (m.tipo === 'avanzamento') { onProgress?.(m.frazione); return }
      if (m.tipo === 'fatto') { chiudi(); resolve(m.scena); return }
      chiudi()
      reject(new Error(m.messaggio))
    }
    w.onerror = (e): void => {
      chiudi()
      reject(new Error(e.message || 'errore nel worker DXF'))
    }
    w.postMessage({ file, opts: parseOpts })
  })
}
