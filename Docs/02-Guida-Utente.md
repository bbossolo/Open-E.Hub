# 02 — Guida Utente (ELI5)

Questa guida spiega come **usare** Open E.Hub, con parole semplici. Non serve sapere niente di
programmazione. *(Il numero di strumenti e i loro «primi passi» sono generati dal codice:
vedi i blocchi automatici più sotto.)*

Open E.Hub è una **suite di strumenti per la progettazione impiantistica**: ogni strumento copre
un pezzo del lavoro e si passano i dati tra loro, senza doverli ridigitare.

## 1. Avviare l'app

- **Mac:** doppio click su `Open E.Hub.app` (di solito in *Applicazioni*).
- **Windows:** doppio click sull'icona Open E.Hub (dopo aver lanciato l'installer una volta).

Non c'è login: Open E.Hub è per un singolo studio, quindi si apre direttamente sulla home, con
accesso a tutti gli strumenti. Il pannello **α Alfa** (Impostazioni → Centro di controllo) resta
lo strumento per gestire gli utenti dello studio (elenco locale) e il nome/logo dello studio per
le intestazioni dei documenti generati.

> La prima volta l'app trova da sola i suoi strumenti. Non devi configurare niente.

## 2. La schermata principale (il hub)

A sinistra c'è la **barra laterale** con l'elenco dei tool (raggruppati per tema) e, in fondo,
**Impostazioni** e i comandi di **progetto**. Al centro c'è la **home** con una **card** per
ogni strumento.

```
┌───────────────┬──────────────────────────────────────────────┐
│ Open E.Hub    [/]  │  COMPUTI E RELAZIONI                          │
│               │  ┌────────┐                                  │
│ Tools         │  │  μ     │                                  │
│  μ  ●         │  │ Price  │                                  │
│  β  ●         │  └────────┘                                  │
│  δ  ●         │  DOCUMENTI DI COMMESSA                        │
│  χ  ●         │  ┌────────┐ ┌────────┐ ┌────────┐             │
│               │  │  β     │ │  δ     │ │  χ     │             │
│ ⚙ Impostaz.   │  │Contab. │ │Copert. │ │ Refs   │             │
│ Progetto…     │  └────────┘ └────────┘ └────────┘             │
│               │  (α Alfa gestisce utenti e branding dello studio) │
└───────────────┴──────────────────────────────────────────────┘
```

- **Clicca una card** (o una voce della barra) per aprire lo strumento: si apre *dentro* la
  stessa finestra.
- I tool ancora in prova hanno la targhetta **`beta`**; gli altri sono stabili (nessuna targhetta).
- Per **tornare alla home** clicca il logo **Open E.Hub** in alto a sinistra o premi `Esc`.
- In fondo alla home trovi i **Protip** a rotazione (suggerimenti d'uso), i **Crediti** e le
  **Note legali**.

## 3. Scorciatoie da tastiera

| Tasto | Azione |
|---|---|
| `/` | Vai subito alla ricerca dei tool |
| `B` | Mostra/nascondi la barra laterale |
| `T` | Cambia tema chiaro/scuro |
| `Esc` | Torna alla home |
| `Cmd/Ctrl + C / V / X` | Copia / Incolla / Taglia (funzionano normalmente) |

> 💡 Ogni strumento ha in alto a destra il **pulsante Guida rosso `? Guida`**: aprilo per la
> guida specifica di quel tool. Tema e Guida stanno **sempre nello stesso posto**, in tutti i tool.

## 4. Aspetto e tema

- Il **tema chiaro/scuro** è unico per tutta la suite: all'inizio segue il tuo sistema
  operativo, poi puoi fissarlo a mano. Il **toggle del tema** è in alto in ogni strumento.
- Da **Impostazioni → Aspetto** (barra laterale) scegli **palette** colori, **font**,
  **dimensione del testo**, **densità**, **ombre** e **animazioni**: valgono per tutta la suite.

## 5. Gli strumenti, in breve

<!-- AUTO:tools:list:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->
Strumenti: **5** (Open E.Hub v1.0.2).

- **μ Prezzi** — Prezzari e computo metrico _(stabile)_
- **δ Copertine** — Copertine degli elaborati _(stabile)_
- **β Contabilità** — Contabilità lavori pubblici _(stabile)_
- **χ Refs** — Basi DXF esterne come xref _(stabile)_
- **α Alfa** — Centro di controllo dell'hub _(stabile)_
<!-- AUTO:tools:list:END -->

Come si usano, in pratica:

- **μ** — cerchi nei prezzari **con parole tue**, componi le voci e le metti nel **carrello**.
- **β** — gestisci la **contabilità lavori** (SAL, registro di contabilità) di una commessa.
- **δ** — generi le **copertine** degli elaborati di commessa da un cartiglio.
- **χ** — colleghi basi DXF esterne come **xref** dei collaboratori.

## 5bis. Primi passi (tour guidato)

Al primo accesso parte da solo un breve **tour guidato** (skippabile). Lo riapri quando vuoi dal
bottone **Guida** (barra laterale nell'hub, o `? Guida` in alto in ogni tool) → **Rivedi il tour**.

<!-- AUTO:tours:coverage:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/tour.ts + src/tools/*/data/tour.ts) — NON editare a mano -->
Hanno un tour guidato (▶ nell'hub) e i "primi passi" qui sotto: μ Prezzi.

Non ancora coperti da un tour: δ Copertine · β Contabilità · χ Refs · α Alfa.
<!-- AUTO:tours:coverage:END -->

I "primi passi" qui sotto **sono** gli step di quei tour: stessa fonte, nessuna doppia scrittura.

**Home**

<!-- AUTO:guide:home:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/tour.ts) — NON editare a mano -->
- **Benvenuto in Open E.Hub** — È la suite di strumenti per la progettazione impiantistica: ogni tool copre un pezzo del flusso e si passano dati fra loro senza doverli ridigitare.
- **Cerca un tool** — Digita per filtrare l’elenco qui sotto, o premi / per metterti subito a fuoco sulla ricerca.
- **I tool, raggruppati per tema** — Le card sono raggruppate per area (progettazione, computo, documenti…). Clicca una card per aprire quel tool.
- **Progetto Open E.Hub** — Salva/Apri un file .ehub per portarti dietro lo stato di tutti i tool insieme. "Nuovo progetto" riparte da zero.
- **La Guida resta sempre qui** — Da qui puoi riaprire la guida rapida e rivedere questo tour quando vuoi.
<!-- AUTO:guide:home:END -->

**μ Prezzi**

<!-- AUTO:guide:miu:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/tools/miu/data/tour.ts) — NON editare a mano -->
- **I 4 passi del lavoro** — Cerca o componi → Misura → Categorizza → Esporta. Clicca un passo (o i tasti 1–4) per spostarti; Esc torna a Cerca.
- **Carica un prezzario** — Da qui apri uno o più prezzari regionali: puoi tenerne aperti più di uno insieme. Servono a consultare e a pescare le voci.
- **Cerca in linguaggio naturale** — Scrivi come lo chiami tu — «passerella a filo», «tubo corrugato» — non serve la dicitura esatta del prezzario.
- **Aggiungi al computo** — Seleziona le voci e premi qui: ne finisce una COPIA nel computo. Cambiare o svuotare la ricerca non te le toglie più.
- **Componi una descrizione** — Se il prezzario non ha la voce che ti serve, componila dalle famiglie — con Σ Analisi Prezzi ne calcoli anche il prezzo.
- **Il Computo Metrico** — Qui misuri le voci e trovi l'Elenco Prezzi del progetto. Ogni voce è modificabile (✎): cambi descrizione e prezzo sulla TUA copia, il prezzario resta intatto.
- **Lista cavi da Ampère** — Importa un export Ampère (o trascinalo qui): le lunghezze diventano le quantità e i cavi si agganciano da soli alle voci di prezzario. Gli unipolari sono già moltiplicati per i conduttori, e ogni linea eredita il suo quadro come Sottocategoria.
- **La Guida resta sempre qui** — Da qui riapri la guida completa e rivedi questo tour quando vuoi.
<!-- AUTO:guide:miu:END -->

## 6. Come i tool si parlano (il flusso)

- **δ** — le copertine si generano da un cartiglio, indipendenti dal resto del flusso.
- **χ** — collega basi DXF esterne come xref, a sé stante.

## 7. Il Progetto Open E.Hub (file `.ehub`)

In fondo alla barra laterale trovi i comandi di progetto:

- **Nuovo progetto** — riparte da zero azzerando tutti i tool.
- **Salva progetto** — mette insieme in un **unico file `.ehub`** lo stato di *tutti* i tool
  aperti, inclusa la **planimetria condivisa** se un tool ne ha pubblicata una.
- **Apri progetto** — ripristina tutto: riprendi esattamente da dove avevi lasciato, in ogni tool.

## 8. I miei dati si salvano? Servono account o internet?

Gli strumenti lavorano sui file che apri tu (Excel, DXF, PDF, `.ehub`). Le preferenze (tema,
aspetto, utenti locali, ultimo stato) restano **sul tuo computer**: non viene inviato niente su
internet e **non serve un account** cloud per usare l'app.

## 9. "L'app dice che è danneggiata / Windows mi avvisa"

Non è rotta: è solo che l'app **non è firmata digitalmente**.
- **Mac** ("è danneggiata"): vedi la soluzione in [doc 05](05-Manutenzione-e-Troubleshooting.md#mac).
- **Windows** (avviso SmartScreen): clicca *Ulteriori informazioni → Esegui comunque*.

Se costruisci l'app **in locale** (vedi doc 03) il problema non compare proprio.

---

➡️ Prossimo: [03 — Build e Release](03-Build-e-Release.md)
