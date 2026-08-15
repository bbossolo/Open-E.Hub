/* δ Copertine — punto d'ingresso del tool. Genera le copertine degli elaborati: un
   template (PDF/immagine) come sfondo, campi FISSI e VARIABILI posizionati sopra,
   un elenco (CSV/Excel) che fa una copertina per riga → un PDF unico. Engine puro
   in ./engine/; la UI vive in ui/, un modulo per vista/tema.

   Questo file è il BARREL: import, coda d'avvio e, in fondo, l'esposizione su
   window degli handler richiamati dagli attributi on*= di index.html. Gli import
   fra moduli ui/ sono CIRCOLARI e
   va bene: i nomi si usano solo dentro i corpi funzione, mai al top-level, quindi
   i live-binding ESM sono già risolti quando parte il primo handler. */
import { applySuiteAesthetics, bindThemeShortcut, onHubMessage, sendToHub } from '../../shared'
import { initAnalytics } from '../../shared/analytics'
import { bindGuideShortcut, makeResizer } from '../../shared/ui/components'
import { registerGuide } from '../../shared/ui/guide'
import { DELTA_GUIDE } from './data/guida'
import { parseState } from './engine'
import { addField } from './ui/campi.js'
import { toggleDrawField } from './ui/disegno.js'
import { addStandardFields, cancelElencoVerify, clearElenco, confirmElencoVerify, detectCampi, detectColumnsNow, onElencoFile } from './ui/elenco.js'
import { generaDXF, generaPDF, previewStep, stampaAnteprimaCorrente } from './ui/genera.js'
import { applyTheme, closeGuide, openGuide, renderAll, setTemplateMode, showView, startDeltaTour, toggleTemplateEditor, toggleTheme, updateRailProgress } from './ui/shell.js'
import { S, setPreviewIndex, setS, setSel } from './ui/stato.js'
import { clearTemplate, onTemplateFile, renderTemplate } from './ui/template.js'
import { campiZoom, generaZoom, setCampiZoom, setGeneraZoom, wireCanvasWheelZoom, zoomCampi, zoomGenera } from './ui/zoom.js'

initAnalytics()

onHubMessage(m => {
  if (m.type === 'hub:set-theme') {
    applyTheme(m.theme)
    if (m.palette) document.documentElement.setAttribute('data-palette', m.palette)
  }
  applySuiteAesthetics(m)
  if (m.type === 'hub:collect-state') {
    // appId LETTERALE (non una variabile): l'hub valida il mittente contro il
    // registry e la guardia CI bus-contract lo verifica staticamente.
    sendToHub({ type: 'app:full-state', appId: 'delta-pages', state: S })
  }
  if (m.type === 'hub:restore-state' && m.state) {
    setS(parseState(m.state))
    setSel(null); setPreviewIndex(0)
    renderAll()
  }
})

/* ── Avvio ── */
applyTheme(document.documentElement.getAttribute('data-theme') || 'light')
renderTemplate()
wireCanvasWheelZoom('dEditorCanvas', () => campiZoom, setCampiZoom)
wireCanvasWheelZoom('dPreviewCanvas', () => generaZoom, setGeneraZoom)
updateRailProgress()

// Pannelli regolabili (makeResizer condiviso, come μ): larghezza persistita,
// comune a Template unificata e Genera — un solo handle per lato basta perché
// solo una vista è visibile alla volta.
for (const h of document.querySelectorAll('[data-resize="left"]')) {
  makeResizer(h, { cssVar: '--d-left-w', side: 'left', min: 210, max: 480, storageKey: 'delta:left-w' })
}
for (const h of document.querySelectorAll('[data-resize="right"]')) {
  makeResizer(h, { cssVar: '--d-right-w', side: 'right', min: 240, max: 520, storageKey: 'delta:right-w' })
}
Object.assign(window, {
  toggleTheme, showView, openGuide, closeGuide, startDeltaTour, setTemplateMode, toggleTemplateEditor,
  onTemplateFile, clearTemplate, addField, addStandardFields, detectCampi, toggleDrawField, onElencoFile, clearElenco, previewStep, generaPDF, generaDXF,
  confirmElencoVerify, cancelElencoVerify, detectColumnsNow, stampaAnteprimaCorrente,
  zoomCampi, zoomGenera,
})

bindThemeShortcut(toggleTheme)
registerGuide({ ...DELTA_GUIDE, onTour: () => startDeltaTour() })
bindGuideShortcut('delta')

