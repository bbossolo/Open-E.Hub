# Sicurezza

## Segnalare una vulnerabilità

**Non aprire una issue pubblica.** Usa
[GitHub Security Advisories](https://github.com/bbossolo/Open-E.Hub/security/advisories/new)
(*Security* → *Report a vulnerability*): la segnalazione resta privata finché non c'è una
correzione.

Questo è un progetto mantenuto nel tempo libero, senza un team di sicurezza dietro: non
promettiamo tempi di risposta che non possiamo rispettare. L'impegno è leggere ogni
segnalazione, dire se è stata accettata o no, e — se accettata — pubblicare la correzione
insieme a un avviso che ti attribuisce la scoperta, se lo desideri.

Nella segnalazione aiuta molto avere: versione di Open E.Hub, sistema operativo, i passi per
riprodurre e, se serve un file di innesco (PDF, XLSX, DXF, `.ehub`), il file stesso.

## Che cosa rientra

Open E.Hub gira **interamente in locale**: non c'è un server, non c'è un account, non ci sono
dati di altri utenti da proteggere. La superficie d'attacco reale è **il file che apri**: un
prezzario, una scheda tecnica PDF, un DXF o un progetto `.ehub` ricevuti da terzi.

Rientra quindi tutto ciò che, partendo da un file ostile, porta a:

- esecuzione di codice nel renderer o nel processo main di Electron;
- lettura o scrittura di file fuori da quelli che l'utente ha scelto (path traversal);
- uscita di dati verso la rete (la suite non deve fare **nessuna** richiesta esterna);
- superamento dell'isolamento del preload (`window.ehubNative`).

Non rientrano: la mancanza di firma del codice negli installer (è dichiarata, vedi
[Docs/03-Build-e-Release.md](Docs/03-Build-e-Release.md)), e le vulnerabilità delle dipendenze
di **sviluppo** (`electron-builder`, `vitest`, `vite`), che non finiscono nell'app distribuita.

## Come è difeso, oggi

- **Nessuna rete.** Ogni pagina dichiara una CSP in cui non compare alcuno schema `http:`/
  `https:`: la suite non può caricare risorse remote né spedire dati fuori. Nel codice non
  esiste una sola `fetch`/`XMLHttpRequest`/`WebSocket`, non c'è telemetria e non c'è
  aggiornamento automatico.
- **Renderer isolato.** Electron gira con `contextIsolation: true` e `nodeIntegration: false`;
  il renderer vede solo l'API minima esposta da [preload.js](preload.js). `sandbox` è `false`
  perché il preload usa `fs` per leggere la cartella risorse dell'app.
- **PDF non fidati.** Ogni `getDocument()` di pdf.js passa `isEvalSupported: false`: è la
  mitigazione indicata da Mozilla per CVE-2024-4367, che qui conta perché i PDF (cartigli,
  schede tecniche) arrivano da fuori. Il perché la libreria sia ferma alla 3.11.174 è in
  [NOTICE.md](NOTICE.md).
- **Librerie di terzi congelate.** Le copie in [vendor/](vendor/) non le aggiorna nessun
  gestore di pacchetti: versione e licenza di ciascuna sono in [NOTICE.md](NOTICE.md), ed è
  lì che si guarda quando esce un avviso di sicurezza.
- **Scansione mensile.** [Trivy](.github/workflows/trivy.yml) passa dipendenze, segreti e
  configurazioni il primo di ogni mese; non blocca la CI, i risultati stanno nel log del run.
