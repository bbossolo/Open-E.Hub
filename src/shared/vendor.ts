/**
 * Loader runtime delle librerie in `vendor/` (xlsx, jszip, pdf, pdf-lib, fontkit).
 * Restano file ESTERNI caricati a runtime (non inglobati nel bundle singlefile),
 * per preservare il funzionamento offline. Ogni libreria viene iniettata una sola
 * volta: la cache delle Promise rende `loadScript` idempotente.
 */

/** Funzione che inietta effettivamente lo script (sostituibile nei test). */
export type Injector = (src: string) => Promise<void>

const cache = new Map<string, Promise<void>>()

/** Iniezione reale via <script> (path relativo, async=false per preservare l'ordine). */
const domInject: Injector = src => new Promise<void>((resolve, reject) => {
  try {
    const s = document.createElement('script')
    s.src = src
    s.async = false
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('vendor load failed: ' + src))
    document.head.appendChild(s)
  } catch (e) {
    reject(e instanceof Error ? e : new Error(String(e)))
  }
})

/** Carica uno script di vendor una sola volta (chiamate ripetute riusano la Promise). */
export function loadScript(src: string, inject: Injector = domInject): Promise<void> {
  let p = cache.get(src)
  if (!p) { p = inject(src); cache.set(src, p) }
  return p
}

/** Svuota la cache del loader (solo per i test). */
export function _resetVendorCache(): void { cache.clear() }

export const loadXLSX = (inject?: Injector): Promise<void> => loadScript('vendor/xlsx.full.min.js', inject)
export const loadJSZip = (inject?: Injector): Promise<void> => loadScript('vendor/jszip.min.js', inject)
export const loadPDF = (inject?: Injector): Promise<void> => loadScript('vendor/pdf.min.js', inject)
export const loadPdfLib = (inject?: Injector): Promise<void> => loadScript('vendor/pdf-lib.min.js', inject)
export const loadFontkit = (inject?: Injector): Promise<void> => loadScript('vendor/fontkit.min.js', inject)
