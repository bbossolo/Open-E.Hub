// preload.js
// ──────────────────────────────────────────────────────────────────────────
// STEP 7 — hardening: contextIsolation:true. Il renderer (hub) è isolato dal
// contesto Node del preload; espone SOLO un'API minima e sicura via
// contextBridge (`window.ehubNative`). L'hub la usa per scoprire e caricare i
// tool dalla cartella risorse dell'app (dove vivono gli .html + vendor/), al
// posto della File System Access API (che non esiste sotto file://).
// In un pacchetto asar __dirname è dentro l'asar e 'fs' lo legge comunque.
// ──────────────────────────────────────────────────────────────────────────
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

const RES_DIR = __dirname

contextBridge.exposeInMainWorld('ehubNative', {
  /** Nome della cartella risorse (per la UI). */
  folderName() {
    return path.basename(RES_DIR) || 'Open E.Hub'
  },
  /** Nomi dei file .html direttamente nella cartella risorse. */
  listHtml() {
    return fs
      .readdirSync(RES_DIR, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.html'))
      .map((d) => d.name)
  },
  /** Testo di un file della cartella risorse (solo file diretti: niente path traversal). */
  readText(name) {
    const safe = path.basename(String(name))
    return fs.readFileSync(path.join(RES_DIR, safe), 'utf8')
  },
  /**
   * Salva un progetto Open E.Hub. La PRIMA volta chiede la cartella di destinazione
   * (e la ricorda); le volte successive ci scrive direttamente. Ritorna
   * { path } | { canceled:true } | { error }. Delega al main (dialog + fs).
   */
  saveProject(filename, content) {
    return ipcRenderer.invoke('ehub:save-project', { filename, content })
  },
  /** Forza la scelta di una nuova cartella di salvataggio progetti. */
  chooseProjectDir() {
    return ipcRenderer.invoke('ehub:choose-project-dir')
  },
  /**
   * Legge un file DXF per PERCORSO ASSOLUTO (planimetria di Progetto come XREF):
   * a differenza di readText (solo cartella risorse), qui il percorso è quello
   * scelto dall'utente col selettore file. Ritorna { text } | { error }.
   */
  readDxf(absPath) {
    return ipcRenderer.invoke('ehub:read-dxf', { path: absPath })
  },
  /**
   * Dice se un DXF è ancora al suo posto, e quanto pesa — senza leggerlo.
   * Ritorna { exists, size } | { error }.
   */
  statDxf(absPath) {
    return ipcRenderer.invoke('ehub:stat-dxf', { path: absPath })
  },
})
