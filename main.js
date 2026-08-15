const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// ── Progetto Open E.Hub: cartella di salvataggio ricordata (scelta la prima volta) ──
function configPath() {
  return path.join(app.getPath('userData'), 'ehub-config.json')
}
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')) || {} } catch (e) { return {} }
}
function writeConfig(cfg) {
  try { fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8') } catch (e) { /* best-effort */ }
}
async function pickProjectDir() {
  const win = BrowserWindow.getFocusedWindow()
  const res = await dialog.showOpenDialog(win, {
    title: 'Scegli la cartella dei progetti Open E.Hub',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths || !res.filePaths.length) return null
  return res.filePaths[0]
}

// Salva un progetto Open E.Hub: la prima volta chiede la cartella e la ricorda.
ipcMain.handle('ehub:save-project', async (_e, { filename, content }) => {
  try {
    let dir = readConfig().projectDir
    if (!dir || !fs.existsSync(dir)) {
      dir = await pickProjectDir()
      if (!dir) return { canceled: true }
      writeConfig({ ...readConfig(), projectDir: dir })
    }
    const safe = path.basename(String(filename || 'progetto.ehub'))
    const full = path.join(dir, safe)
    fs.writeFileSync(full, content, 'utf8')
    return { path: full }
  } catch (err) {
    return { error: String((err && err.message) || err) }
  }
})

// Legge un DXF per percorso assoluto (planimetria di Progetto come XREF): il file
// è quello scelto dall'utente col selettore; nessun byte del DXF finisce nel .ehub.
ipcMain.handle('ehub:read-dxf', async (_e, { path: p }) => {
  try {
    if (!p || typeof p !== 'string') return { error: 'percorso non valido' }
    return { text: fs.readFileSync(p, 'utf8') }
  } catch (err) {
    return { error: String((err && err.message) || err) }
  }
})

// Dice solo SE l'xref è ancora al suo posto, e quanto pesa. Serve al banner
// «planimetria non trovata»: prima quella verifica si faceva leggendo l'intero file,
// che su una tavola vera dello studio significa spostare 240 MB per sapere che esiste.
ipcMain.handle('ehub:stat-dxf', async (_e, { path: p }) => {
  try {
    if (!p || typeof p !== 'string') return { error: 'percorso non valido' }
    const st = fs.statSync(p)
    return { exists: st.isFile(), size: st.size }
  } catch {
    return { exists: false, size: 0 }
  }
})

// Cambia la cartella di salvataggio progetti.
ipcMain.handle('ehub:choose-project-dir', async () => {
  const dir = await pickProjectDir()
  if (!dir) return { canceled: true }
  writeConfig({ ...readConfig(), projectDir: dir })
  return { path: dir }
})

function buildMenu() {
  const isMac = process.platform === 'darwin'

  // Menu minimo: tiene attivi gli shortcut standard (copia/incolla/seleziona,
  // chiudi, ricarica, zoom). Senza questo, su macOS Cmd+C/V/Q smettono di
  // funzionare in un'app di data-entry.
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: 'Info su Open E.Hub' },
        { type: 'separator' },
        { role: 'hide', label: 'Nascondi Open E.Hub' },
        { role: 'hideOthers', label: 'Nascondi altre' },
        { role: 'unhide', label: 'Mostra tutte' },
        { type: 'separator' },
        { role: 'quit', label: 'Esci da Open E.Hub' }
      ]
    }] : []),
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripeti' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona tutto' }
      ]
    },
    {
      label: 'Vista',
      submenu: [
        { role: 'reload', label: 'Ricarica' },
        { role: 'forceReload', label: 'Ricarica forzata' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Aumenta zoom' },
        { role: 'zoomOut', label: 'Riduci zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
        { role: 'toggleDevTools', label: 'Strumenti sviluppatore' }
      ]
    },
    ...(isMac ? [{
      label: 'Finestra',
      submenu: [
        { role: 'minimize', label: 'Riduci a icona' },
        { role: 'zoom', label: 'Ingrandisci' },
        { role: 'front', label: 'Porta tutte in primo piano' }
      ]
    }] : [])
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'Open E.Hub',
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // STEP 7 — hardening: il renderer (hub) è ISOLATO dal contesto Node. Il
      // preload espone solo un'API minima via contextBridge (window.ehubNative).
      // sandbox resta false perché il preload usa 'fs' per la cartella risorse;
      // il renderer non ha comunque accesso diretto a Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.loadFile('EHub.html')

  // Apri i link esterni nel browser di sistema, non in una finestra Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
