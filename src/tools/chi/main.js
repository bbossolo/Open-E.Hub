/* χ Refs — punto d'ingresso del tool. Normalizza il DXF di un collaboratore per
   usarlo come riferimento esterno: i suoi layer sotto il nostro standard, il resto
   spento, le unità dichiarate. Il motore sta in src/shared (dxf-import + xref),
   perché altri tool possano riusarlo; qui vive solo ciò che è specifico del tool.

   Questo file è il BARREL: import, coda d'avvio e, in fondo, l'esposizione su
   window degli handler richiamati dagli attributi on*= di index.html. */
import { applySuiteAesthetics, bindThemeShortcut, onHubMessage, sendToHub } from '../../shared'
import { initAnalytics } from '../../shared/analytics'
import { bindGuideShortcut } from '../../shared/ui/components'
import { registerGuide } from '../../shared/ui/guide'
import { CHI_GUIDE } from './data/guida'
import { esportaXref } from './ui/esporta.js'
import { apriFileClick, caricaFile, onDragLeave, onDragOver, onDrop, onFileScelto } from './ui/file.js'
import {
  accetta, aggiornaBarra, cambiaPreset, commutaDestinazione, deseleziona, eliminaLayerCustom,
  invalidaDestinazioni, nuovoLayer, renderTrasferimento, rimanda, rinominaDestinazione, smistaAuto,
  spegni, spegniRestanti, sposta, tasti,
} from './ui/trasferimento.js'
import { applyTheme, closeGuide, mostraVista, openGuide, renderScheda, toggleTheme } from './ui/shell.js'
import { applicaProfilo, ignoraProfilo, renderProfilo, salvaProfiloCorrente } from './ui/profilo.js'
import { impostaScala, renderScala } from './ui/scala.js'
import { azzera, ripristina, S, statoSerializzabile } from './ui/stato.js'

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
    sendToHub({ type: 'app:full-state', appId: 'chi-refs', state: statoSerializzabile() })
  }
  if (m.type === 'hub:restore-state') {
    azzera()
    invalidaDestinazioni()
    ripristina(m.state)
    mostraVista('apri')
  }
})

registerGuide(CHI_GUIDE)
bindGuideShortcut('chi')
bindThemeShortcut()
addEventListener('keydown', tasti)
mostraVista('apri')
sendToHub({ type: 'app:ready', appId: 'chi-refs' })

/** Cambia un'opzione di normalizzazione e riflette subito l'effetto. */
function cambiaOpzione(chiave, valore) {
  S.opzioni[chiave] = valore
  renderTrasferimento()
}

/* ── handler richiamati dagli on*= di index.html ── */
Object.assign(window, {
  apriFileClick, onFileScelto, onDrop, onDragOver, onDragLeave, caricaFile,
  renderTrasferimento, sposta, rimanda, spegni, accetta, commutaDestinazione,
  spegniRestanti, cambiaPreset, nuovoLayer, eliminaLayerCustom, smistaAuto,
  deseleziona, rinominaDestinazione, aggiornaBarra,
  mostraVista, renderScheda, toggleTheme, applyTheme, openGuide, closeGuide,
  esportaXref, cambiaOpzione, impostaScala, renderScala,
  applicaProfilo, ignoraProfilo, salvaProfiloCorrente, renderProfilo,
})
