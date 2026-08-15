# Testi di licenza delle librerie in `vendor/`

Le licenze MIT e Apache-2.0 non chiedono solo di *citare* la libreria: chiedono che il
testo della licenza accompagni il codice ridistribuito. `vendor/` contiene build
minificate di software di terzi, quindi i testi vivono qui.

| File | Si applica a |
|---|---|
| `Apache-2.0.txt` | SheetJS (xlsx), pdf.js (Mozilla), tslib incluso nel bundle pdf-lib |
| `JSZip-LICENSE.txt` | JSZip (dual MIT/GPLv3 — si usa il ramo MIT) |
| `pdf-lib-LICENSE.txt` | pdf-lib |
| `fontkit-LICENSE.txt` | fontkit (`@pdf-lib/fontkit`) |
| `OFL-1.1.txt` | i **font** ridistribuiti: Inter, JetBrains Mono, Cormorant, Fredoka, Pixelify Sans, Arimo |

I font non stanno tutti qui sotto `vendor/`: alcuni vivono in `src/shared/ui/fonts/`, e
Arimo è incorporato in base64 dentro `src/shared/doc/pdf-font.ts`. `OFL-1.1.txt` elenca per
ciascuno il copyright e dove sta il file — l'OFL chiede che licenza e avviso accompagnino i
file font ridistribuiti, ovunque siano.

Per fontkit la nota è stata ricostruita: né la build minificata né i pacchetti upstream
includono un file di licenza, quindi il file riporta la licenza e la paternità così come le
dichiarano i `package.json` e i README dei due repo, e lo dice esplicitamente.
