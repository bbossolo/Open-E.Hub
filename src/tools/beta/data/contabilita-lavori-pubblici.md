# Contabilità dei lavori pubblici — base di conoscenza di β Contabilità

Riferimento operativo del tool. Copre la contabilizzazione **a corpo**, **a misura**
e **mista** ai sensi del **D.Lgs. 36/2023** e del suo **Allegato II.14**. Tutti gli
importi degli atti contabili sono **al netto di IVA** (l'IVA compare solo nel
certificato di pagamento e a titolo informativo nel SAL).

> ⚠️ **Nota normativa da verificare.** La bozza iniziale citava «art. 184-194»; le
> fonti autorevoli (BibLus/ACCA) collocano gli atti contabili nell'**Allegato II.14,
> art. 12-18**. β usa i riferimenti verificati (art. 12-18) e li espone; prima
> dell'uso in atti ufficiali va sempre riscontrato il **testo vigente** del Codice e
> dell'Allegato.

## 1. Le due modalità

- **A misura** — il corrispettivo **varia** con le quantità realmente eseguite:
  `importo = prezzo unitario × quantità misurata`. Le quantità si rilevano con righe
  di misura L×L×H×n (con detrazioni), esattamente come nel computo di μ.
- **A corpo** — il corrispettivo è **fisso e invariabile**: il computo ha funzione
  ausiliaria (forma il prezzo), la sua presenza non trasforma l'appalto «in misura».
  A ogni SAL si registra la **quota % dell'aliquota** del corpo d'opera eseguita.
- **Misto** — partite a corpo e a misura **convivono** nello stesso appalto; il
  Registro/SAL le espongono distinte e ne sommano i totali.

## 2. Catena documentale (Allegato II.14)

```
Giornale dei lavori (art.12)
   ↓
Libretti di misura (art.13) → Registro di contabilità (art.14) → Sommario (art.15, se previsto)
                                      ↓
                                SAL (art.16) → Certificato di pagamento (art.17, RUP entro 7 gg)
                                      ↓
                                Conto finale (art.18) → Relazione finale (art.18)
```
Regola d'oro: **ogni atto a valle deriva i propri importi dall'atto a monte** (mai
reinserimento manuale).

## 3. Struttura colonne (minata da BibLus/ACCA)

- **Libretto A MISURA** (art. 13): N. ordine · Codice tariffa · Data · Designazione
  (dizione dell'elenco prezzi) · **Fattori** (lunghezza, larghezza, altezza/peso) ·
  **Prodotti** (quantità eseguita) · Prezzo unitario · Importo. Contiene figure quotate,
  profili ante/post, punti di saggi/scandagli/misure.
- **Libretto A CORPO** (art. 12): per categoria, **quota % dell'aliquota** della voce
  disaggregata eseguita a ogni SAL (colonna «Prodotti» = quote %, non quantità assolute).
- **Registro** (art. 14): frontespizio (oggetto, ragione sociale impresa, n. fogli) +
  riferimento al libretto · prezzo · importo · quantità (a misura) / percentuali (a
  corpo). Iscrizioni in **ordine cronologico**; firma dell'esecutore **a ogni SAL**;
  fogli numerati e bollati (art. 2215 c.c.).
- **SAL** (art. 16): frontespizio (lavori, impresa, n. progressivo, data, dati
  contratto) + n. ordine · codice · descrizione/corpo · quantità/percentuale · prezzo ·
  importo a credito.
- **Certificato di pagamento** (art. 17): emesso dal RUP entro 7 gg dal SAL, previa
  verifica DURC; annotato nel registro.

## 4. Regole di calcolo (codificate in engine/contabilita.ts)

- `ribasso = (base_asta − offerta) / base_asta` (es. (46.517,74 − 32.301,70)/46.517,74 = 30,5605%).
- `totale_contrattuale = offerta_ribassata + oneri_sicurezza + Σ varianti_nette`.
- A misura: `importo_voce = prezzo_unitario × quantità_progressiva_misurata`.
- A corpo: `importo_maturato = importo_corpo × quota%`; `aliquota_eseguita = aliquota × quota%`.
- Quadratura corpi disaggregati: `Σ importi_voce = importo_corpo` (tolleranza 0,01 €).
- Ritenuta di garanzia: `0,005 × totale_contabilizzato_conforme` (art. 125 — unica tipizzata).
- **Cascata SAL**: totale eseguito (misura + corpo) + oneri sicurezza − detrazioni −
  ritenuta 0,5% − SAL precedenti = **importo del presente SAL** (netto IVA).
- Oneri sicurezza: **non ribassati**, liquidati per quota di avanzamento, riga autonoma.
- **SAL revisionale**: se la variazione supera la **soglia del 3%** si applica la
  clausola di revisione prezzi.
- IVA lavori pubblici tipica 10% (verificare per singolo appalto).

## 5. Regole di fedeltà del dato (vincolanti per il tool)

1. Ogni valore deriva da un **documento firmato**; nessun valore inventato.
2. I dati non disponibili restano **segnaposto espliciti** («da confermare»), mai colmati.
3. Le discrepanze (es. lordo vs netto) si **segnalano in nota**, senza sovrascrivere.
4. Le quote % di avanzamento sono **attestazioni del DL**: il tool le predispone come
   input, non le stima mai.
5. Ogni foglio riporta i riferimenti fissi: oggetto, CUP, CIG, impresa, provvedimento.

## 6. Riserve, varianti, equivalenza

- **Riserve** (art. 115 c.2 + art. 7 All. II.14): iscritte sul registro alla firma
  immediatamente successiva al fatto, **a pena di decadenza**; il DL redige motivate
  deduzioni; confluiscono nell'accordo bonario (art. 210, limite 15%).
- **Equivalenza** (prodotto pari/migliorativo): verbale di equivalenza firmato dal
  progettista/DL; non tocca prezzo/aliquote/computo.
- **Variante** (prestazione modificata): nuovi prezzi + atto di sottomissione; in
  contabilità diventa corpo d'opera separato.

## 7. Verbali e comunicazioni del DL (in parallelo alla contabilità)

Atti pubblici datati che il DL scambia con esecutore / RUP / stazione appaltante e che
sono **allegati obbligatori del conto finale** (D.M. 49/2018 artt. 5, 13; D.Lgs. 36/2023
artt. 120-121 e All. II.14). β li genera come documenti istituzionali e li colloca sulla
timeline di cantiere:

- **Verbale di consegna dei lavori** (unica / parziale / in via d'urgenza): stato dei
  luoghi in contraddittorio (aree libere, tracciamenti, capisaldi), termine per l'inizio.
- **Ordine di servizio**: disposizione del DL all'esecutore (controfirma per presa visione).
- **Verbale di sospensione** / **di ripresa**: causa e durata; alla ripresa il termine è
  prorogato di un numero di giorni pari alla sospensione.
- **Verbale di concordamento nuovi prezzi**: prezzi di lavorazioni non contrattuali,
  assoggettati al ribasso e ad approvazione della stazione appaltante.
- **Processo verbale di accertamento**: fatti, prove, anomalie.
- **Certificato di ultimazione dei lavori**: da esso decorrono i termini per il conto finale.
- **Relazione al RUP**: comunicazione sull'andamento dei lavori.

## 8. Correzioni, storni e tracciabilità (niente cancellazioni)

I documenti contabili sono **atti pubblici**: le registrazioni sono in ordine cronologico e
**non si abrasano/cancellano** (D.M. 49/2018 art. 14; All. II.14). Le correzioni si fanno per
**depennamento controfirmato** + nuova annotazione, o — quando una lavorazione già
contabilizzata non va più computata — **portando la partita in detrazione** (partita
negativa) in sede di contabilizzazione, con opportuna annotazione nel SAL (da lì decorre
l'eventuale riserva dell'esecutore). Le **partite provvisorie** (da misurazioni sommarie) si
detraggono in sede di contabilizzazione definitiva.

Come lo applica β:

- Le **quantità sono progressive per voce** a tutto il SAL (art. 194 c.2): ogni SAL porta il
  cumulativo; il sommario ne verifica la rispondenza.
- Una **voce mai contabilizzata** (introdotta nel SAL corrente, nessun libretto precedente
  prodotto) si può correggere/eliminare liberamente.
- Una **voce già contabilizzata** non si cancella: si **sopprime con storno** — una detrazione
  che ne azzera il progressivo dal SAL corrente, restando a verbale negli atti precedenti.
- Un **nuovo prezzo** compare solo dal proprio SAL in avanti: non retroagisce sui libretti già
  prodotti.
- Il **libretto delle misure** si compila con le misure di dettaglio L×L×H×n (le detrazioni
  sono righe con quantità negativa), come nel computo metrico.

## 9. Lavori in economia (liste settimanali)

Le lavorazioni disposte dal DL e non contabilizzabili a misura/corpo si computano **in
economia** per risorse impiegate (art. 181 D.Lgs. 36/2023 / All. II.14; D.M. 49/2018 art. 14).
Strumento: la **lista settimanale**, che indica per ciascun giorno:

- **operai**: qualifica/nominativo, ore, tariffa oraria (riferimento tariffario) → importo;
- **mezzi d'opera e noli**: descrizione, ore, tariffa oraria → importo;
- **provviste**: descrizione, quantità, prezzo unitario → importo.

La lista si redige **in duplice copia (una in bollo)** e si **firma in contraddittorio** con
l'esecutore. L'importo valorizzato **confluisce nel libretto/registro/SAL** del SAL di
competenza (una voce «in economia» che entra nella cascata e nel conto finale). Vale la stessa
regola di tracciabilità: una lista già confluita in un libretto prodotto non si cancella, si
**storna** con detrazione.

## 10. Contabilità semplificata

Lavori sotto **40.000 €**: tenuta semplificata; il CRE può essere sostituito dal visto
del DL sulle fatture.

## Fonti

- BibLus (ACCA): [Contabilità lavori pubblici](https://biblus.acca.it/contabilita-lavori-pubblici/) ·
  [Libretto delle misure](https://biblus.acca.it/libretto-delle-misure/) ·
  [Registro di contabilità](https://biblus.acca.it/registro-di-contabilita-lavori-pubblici/) ·
  [SAL](https://biblus.acca.it/stato-avanzamento-lavori/) ·
  [Appalto a corpo vs a misura](https://biblus.acca.it/appalto-a-corpo-differenze-con-lappalto-a-misura/) ·
  [Conto finale](https://biblus.acca.it/conto-finale-dei-lavori/).
- Studio Petrillo: [Contabilità dei lavori pubblici](https://www.studiopetrillo.com/contabilita-lavori-pubblici.html) ·
  [Art. 14 D.M. 49/2018 — documenti contabili](https://www.studiopetrillo.com/articolo-14-dm49-2018.html)
  (correzioni, partite in detrazione, quantità progressive per voce).
- INFOBUILD: [I documenti contabili utili al Direttore dei Lavori](https://www.infobuild.it/approfondimenti/direttore-dei-lavori-documenti-contabili-amministrativi/).
- BibLus (ACCA): [Contabilità di cantiere in 7 fasi](https://biblus.acca.it/contabilita-di-cantiere-in-7-fasi/).
- Pedago: [Liste settimanali degli operai, mezzi e provviste](https://www.pedago.it/blog/liste-settimanali-operai-mezzi-provviste.htm) (lavori in economia, art. 181).
- D.Lgs. 36/2023 (Codice dei contratti pubblici) e Allegato II.14 — testo vigente.

*Le fonti secondarie riflettono lo stato interpretativo alla data del documento; per
l'uso in atti verificare sempre il testo vigente.*
