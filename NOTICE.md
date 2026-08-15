# Third-party notices

Open E.Hub è distribuito sotto licenza MIT (vedi [LICENSE](LICENSE)). Include le
seguenti librerie e font di terze parti, ciascuno con la propria licenza.

## Librerie (in [vendor/](vendor/), caricate localmente — nessuna CDN)

I testi integrali delle licenze stanno in [vendor/licenses/](vendor/licenses/): MIT e
Apache-2.0 richiedono che accompagnino il codice ridistribuito, non basta citarle qui.

La **versione** è indicata perché queste copie sono congelate nel repo: non le aggiorna
nessun gestore di pacchetti, le aggiorna chi mantiene il progetto.

| Libreria | Versione | Licenza | Uso |
|---|---|---|---|
| [pdf.js](https://mozilla.github.io/pdf.js/) (Mozilla) | 3.11.174 | Apache-2.0 | lettura PDF (import sfondo/template) |
| [SheetJS (xlsx)](https://sheetjs.com/) | 0.20.3 | Apache-2.0 | lettura/scrittura file Excel |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.x | MIT | generazione PDF |
| tslib (incluso nel bundle di pdf-lib) | — | Apache-2.0 (Microsoft) | runtime TypeScript |
| [fontkit](https://github.com/foliojs/fontkit) | 1.1.x | MIT | metriche font per l'export PDF |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | MIT (dual MIT/GPLv3, si usa il ramo MIT) | archivi .zip/.docx |

> **pdf.js resta alla 3.11.174** perché la 4.x è solo ESM e qui la libreria è iniettata come
> script globale (`window.pdfjsLib`). La falla nota di quel ramo (CVE-2024-4367: JavaScript
> dentro un PDF eseguito nel renderer) è chiusa dove conta, passando `isEvalSupported: false`
> a **ogni** `getDocument()` della suite — è la mitigazione indicata da Mozilla — e la CSP
> delle pagine non consente comunque di raggiungere la rete. Vedi [SECURITY.md](SECURITY.md).

## Font (in [vendor/fonts/](vendor/fonts/) e [src/shared/ui/fonts/](src/shared/ui/fonts/))

Copyright e testo della licenza stanno in [vendor/licenses/OFL-1.1.txt](vendor/licenses/OFL-1.1.txt),
che elenca font per font il titolare e il percorso del file: l'OFL chiede che accompagnino i
file font ridistribuiti, e qui i font sono nel repo.

| Font | Licenza | Uso |
|---|---|---|
| [Inter](https://rsms.me/inter/) | SIL Open Font License 1.1 | UI, corpo testo |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | SIL Open Font License 1.1 | UI monospace, codici |
| [Arimo](https://fonts.google.com/specimen/Arimo) | SIL Open Font License 1.1 (le release più vecchie: Apache-2.0) | testo nei PDF esportati (embedded come base64 in `src/shared/doc/pdf-font.ts`) |
| Cormorant, Fredoka, Pixelify Sans | SIL Open Font License 1.1 | temi/varianti estetiche opzionali |

Il quinto tema estetico, «Sistema», non spedisce alcun file: usa il sans dell'OS. Ha
sostituito il font Switzer (Fontshare), la cui licenza consente l'uso ma non chiarisce la
ridistribuzione dei file dentro un pacchetto software — un dubbio che non ha senso correre
per un tema opzionale.

`src/shared/dxf-glyphs.ts` contiene contorni vettoriali derivati da Arimo/JetBrains Mono
(font Apache-2.0/OFL), generati da `scripts/build-dxf-glyphs.ts` per l'export testo-a-contorni
nei DXF.

## Dati

Open E.Hub **non include** prezzari, cataloghi prodotto o cartigli di alcun produttore/ente
terzo. I formati citati nel codice (es. METEL, DEI) sono riconosciuti a fini di
interoperabilità quando l'utente importa i propri file — vedi il modale "Note legali"
nell'app ([src/hub/data/legal.ts](src/hub/data/legal.ts)).
