/* δ Pages — zoom dei canvas (editor e anteprima): rotella, pinch, limiti. */

export let campiZoom = 1      // livello di zoom del canvas Campi (1 = adatta al riquadro)
export let generaZoom = 1     // livello di zoom del canvas Genera

/** Applica lo zoom al canvas indicato: `dir` -1/+1 cambia passo, 0 riporta a 100%. */
export function applyZoom(canvasId, zoom) {
  const el = document.getElementById(canvasId)
  if (el) { el.style.transform = `scale(${zoom})`; el.style.transformOrigin = 'center center' }
}
export const ZOOM_MIN = 0.25, ZOOM_MAX = 4
export function setCampiZoom(z) { campiZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); applyZoom('dEditorCanvas', campiZoom) }
export function setGeneraZoom(z) { generaZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); applyZoom('dPreviewCanvas', generaZoom) }
export function zoomCampi(dir) { setCampiZoom(dir === 0 ? 1 : campiZoom + dir * 0.25) }
export function zoomGenera(dir) { setGeneraZoom(dir === 0 ? 1 : generaZoom + dir * 0.25) }

/** Zoom con rotella/trackpad: pizzico a due dita su trackpad e Ctrl/Cmd+rotella
 *  arrivano come evento `wheel` con `ctrlKey` (il browser li normalizza così); una
 *  rotella fisica "a scatti" si riconosce da `deltaMode!==0` o un salto grande senza
 *  componente orizzontale. Lo scroll normale (due dita in verticale, senza pizzico)
 *  NON viene intercettato: resta il pan nativo di `.d-canvas-wrap` (overflow:auto).
 *  Stessa euristica di `wirePanZoom`. */
export function wireCanvasWheelZoom(canvasId, get, set) {
  const canvas = document.getElementById(canvasId)
  const wrap = canvas && canvas.closest('.d-canvas-wrap')
  if (!wrap) return
  wrap.addEventListener('wheel', e => {
    const isZoom = e.ctrlKey || e.metaKey || e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50)
    if (!isZoom) return
    e.preventDefault()
    set(get() * (e.deltaY > 0 ? 0.9 : 1 / 0.9))
  }, { passive: false })
  wireCanvasPinchZoom(wrap, get, set)
}
/** Pizzico a due dita su schermo touch REALE (non trackpad, già coperto dal wheel
 *  sopra): traccia la distanza fra i due pointer 'touch' e scala lo zoom di
 *  conseguenza, stesso pattern startDrag/onDrag già usato per i campi. */
export function wireCanvasPinchZoom(wrap, get, set) {
  const pts = new Map()
  let startDist = null, startZoom = 1
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2) { startDist = dist(); startZoom = get() }
  })
  wrap.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2 && startDist) set(startZoom * (dist() / startDist))
  })
  const release = e => { pts.delete(e.pointerId); if (pts.size < 2) startDist = null }
  wrap.addEventListener('pointerup', release)
  wrap.addEventListener('pointercancel', release)
}
