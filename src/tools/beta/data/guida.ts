/**
 * β Contabilità — GUIDA alla contabilità dei lavori pubblici + FAQ. Contenuto
 * informativo di riferimento (registro formale) esposto in un pannello
 * flottante. NON è consulenza legale: per gli atti ufficiali si verifica sempre
 * il testo vigente del Codice dei contratti (D.Lgs. 36/2023) e dell'Allegato II.14.
 */

import type { GuideSection } from '../../../shared/ui/guide'

export interface GuidaBlocco {
  titolo: string
  /** Paragrafi (HTML inline consentito: <b>, <i>). */
  paragrafi: string[]
  /** Elenco puntato opzionale. */
  punti?: string[]
}

export interface FaqItem {
  domanda: string
  risposta: string
}

/** Sezioni della guida, in ordine di lettura. */
export const GUIDA: GuidaBlocco[] = [
  {
    titolo: 'Oggetto e finalità',
    paragrafi: [
      'La contabilità dei lavori è il complesso degli atti con cui la direzione dei lavori accerta le lavorazioni eseguite e ne determina il corrispettivo maturato dall\'esecutore, ai fini della liquidazione degli acconti in corso d\'opera e del saldo finale.',
      'Gli atti sono disciplinati dall\'<b>Allegato II.14 del D.Lgs. 36/2023</b>. Tutti gli importi contabili si intendono al netto dell\'IVA, che è esposta separatamente nel certificato di pagamento.',
    ],
  },
  {
    titolo: 'Modalità di contabilizzazione',
    paragrafi: [
      'Il contratto individua la modalità di contabilizzazione del corrispettivo. Da essa dipende il contenuto del libretto delle misure e la determinazione degli importi.',
    ],
    punti: [
      '<b>A misura</b> — il corrispettivo è variabile e si determina applicando i prezzi unitari di contratto alle quantità effettivamente eseguite, rilevate in contraddittorio. Il rischio economico è in capo alla stazione appaltante.',
      '<b>A corpo</b> — il corrispettivo è fisso e invariabile; a ciascuno stato di avanzamento si registra la quota percentuale dell\'aliquota di ciascun gruppo di categorie omogenee. Il computo metrico ha funzione ausiliaria e non consente la revisione del prezzo.',
      '<b>Misto</b> — nello stesso appalto coesistono lavorazioni a corpo e a misura, contabilizzate distintamente e ricondotte a un totale unitario.',
    ],
  },
  {
    titolo: 'Gli atti contabili e la loro successione',
    paragrafi: [
      'Gli atti sono tra loro collegati: ciascuno deriva i propri importi dall\'atto che lo precede. La successione prevista dall\'Allegato II.14 è la seguente:',
    ],
    punti: [
      '<b>Giornale dei lavori</b> (art. 12) — registrazione progressiva delle attività di cantiere.',
      '<b>Libretto delle misure</b> (art. 13) — accertamento delle lavorazioni eseguite: quantità (a misura) o quote percentuali (a corpo).',
      '<b>Registro di contabilità</b> (art. 14) — trascrizione delle partite in ordine cronologico e determinazione del credito progressivo; sede di iscrizione delle riserve.',
      '<b>Sommario del registro</b> (art. 15) — sintesi per gruppi di categorie omogenee.',
      '<b>Stato di avanzamento lavori</b> (art. 16) — riepilogo delle lavorazioni eseguite dall\'inizio dell\'appalto e determinazione dell\'importo dell\'acconto.',
      '<b>Certificato di pagamento</b> (art. 17) — emesso dal RUP entro sette giorni dallo stato di avanzamento, previa verifica della regolarità contributiva.',
      '<b>Conto finale e relazione</b> (art. 18) — redatti dopo l\'ultimazione dei lavori.',
    ],
  },
  {
    titolo: 'Determinazione dell\'importo dello stato di avanzamento',
    paragrafi: [
      'L\'importo da liquidare a ciascuno stato di avanzamento si ottiene per differenze progressive:',
    ],
    punti: [
      'dal <b>totale eseguito</b> a tutto lo stato (lavori a misura, lavori a corpo e quota degli oneri della sicurezza)',
      'si detraggono le eventuali <b>lavorazioni non conformi</b>, ottenendo il totale contabilizzato',
      'si applica la <b>ritenuta di garanzia dello 0,50%</b> (art. 125), svincolata in sede di conto finale o collaudo',
      'si detrae l\'<b>importo dei precedenti stati di avanzamento</b> già liquidati',
      'il risultato è l\'<b>importo del presente stato</b>, al netto dell\'IVA.',
    ],
  },
  {
    titolo: 'Verbali e comunicazioni del Direttore dei Lavori',
    paragrafi: [
      'In parallelo agli atti contabili, il direttore dei lavori redige i verbali e le comunicazioni con cui dialoga con l\'esecutore, il RUP e la stazione appaltante. Sono atti pubblici datati che si collocano sulla cronologia di cantiere e costituiscono <b>allegati obbligatori del conto finale</b>. Si creano dal pannello «Cronologia del cantiere» con «＋ Verbale / atto del DL».',
    ],
    punti: [
      '<b>Verbale di consegna dei lavori</b> — presa in consegna del cantiere, accertamento in contraddittorio dello stato dei luoghi (aree libere, tracciamenti, capisaldi); nelle forme unica, parziale o in via d\'urgenza.',
      '<b>Ordine di servizio</b> — disposizione impartita dal direttore dei lavori all\'esecutore, che la controfirma per presa visione.',
      '<b>Verbale di sospensione</b> e <b>di ripresa</b> — interruzione dei lavori (causa e durata) e successiva ripresa, con proroga del termine pari alla durata della sospensione.',
      '<b>Verbale di concordamento nuovi prezzi</b> — determinazione in contraddittorio dei prezzi di lavorazioni non previste in contratto.',
      '<b>Processo verbale di accertamento</b> — documentazione di fatti, prove e anomalie riscontrate.',
      '<b>Certificato di ultimazione dei lavori</b> — attesta la fine dei lavori; da esso decorrono i termini per il conto finale.',
      '<b>Relazione al RUP</b> — comunicazione del direttore dei lavori sull\'andamento e sulle circostanze rilevanti.',
    ],
  },
  {
    titolo: 'Lavori in economia (liste settimanali)',
    paragrafi: [
      'Le lavorazioni disposte dal direttore dei lavori e non contabilizzabili a misura o a corpo si computano <b>in economia</b>, per risorse effettivamente impiegate (art. 181 D.Lgs. 36/2023). Lo strumento è la <b>lista settimanale</b>: operai (ore × tariffa), mezzi d\'opera e noli (ore × tariffa), provviste (quantità × prezzo). La lista si redige in duplice copia — una in bollo — e si firma in contraddittorio con l\'esecutore.',
      'In β le liste si creano da «＋ Lista in economia», si valorizzano voce per voce e <b>confluiscono automaticamente</b> nel libretto, nel registro e nel SAL del loro SAL di competenza, entrando così nella cascata e nel conto finale.',
    ],
  },
  {
    titolo: 'Correzioni e storni: niente cancellazioni',
    paragrafi: [
      'I documenti contabili sono atti pubblici: le registrazioni non si cancellano. Il libretto delle misure si compila con le misure di dettaglio (lunghezza × larghezza × altezza × numero), come nel computo metrico; le <b>detrazioni</b> sono righe con quantità negativa. Le quantità sono <b>progressive</b> a tutto lo stato di avanzamento.',
    ],
    punti: [
      'Una voce <b>mai contabilizzata</b> (introdotta nel SAL corrente, senza libretti precedenti già prodotti) si può correggere o eliminare liberamente.',
      'Una voce <b>già contabilizzata</b> non si cancella: si <b>sopprime con storno</b>: viene portata in detrazione dal SAL corrente e resta a verbale negli atti precedenti che l\'hanno computata.',
      'Un <b>nuovo prezzo</b> compare solo dal SAL in cui lo si introduce: non retroagisce sui libretti già prodotti.',
    ],
  },
  {
    titolo: 'Principi di corretta tenuta',
    paragrafi: [],
    punti: [
      'Ogni valore deriva da un documento sottoscritto; i dati non disponibili sono indicati come tali e non sono integrati d\'ufficio.',
      'Le quote percentuali e le quantità costituiscono attestazione del direttore dei lavori: lo strumento le riporta come dato di ingresso e non le stima autonomamente.',
      'Si contabilizzano le sole lavorazioni eseguite a regola d\'arte; quelle la cui conformità è verificabile solo a fine lavori non si portano a completamento anticipatamente.',
    ],
  },
]

/** Domande frequenti. */
export const FAQ: FaqItem[] = [
  {
    domanda: 'Come si stabilisce se l\'appalto è a corpo o a misura?',
    risposta: 'La modalità è indicata dal contratto e dal capitolato. Alla presenza di prezzi unitari da applicare alle quantità eseguite corrisponde la contabilizzazione <b>a misura</b>; alla presenza di un corrispettivo complessivo fisso ripartito in aliquote percentuali per gruppi di categorie corrisponde la contabilizzazione <b>a corpo</b>. La compresenza di entrambe configura l\'appalto <b>misto</b>.',
  },
  {
    domanda: 'Il computo metrico vincola il prezzo?',
    risposta: 'Negli appalti <b>a misura</b> i prezzi unitari del computo si applicano alle quantità realmente eseguite. Negli appalti <b>a corpo</b> il computo ha funzione ausiliaria alla formazione del prezzo e della offerta: il corrispettivo resta fisso e non è soggetto a ricalcolo per effetto di difformità nelle quantità.',
  },
  {
    domanda: 'In che cosa consiste la ritenuta dello 0,50%?',
    risposta: 'È la ritenuta di garanzia prevista dall\'art. 125 del D.Lgs. 36/2023: su ciascun pagamento in acconto si trattiene lo 0,50% dell\'importo progressivo. La somma è svincolata in sede di conto finale o collaudo, previa verifica della regolarità contributiva. È l\'unica ritenuta tipizzata: ogni ulteriore trattenuta richiede un titolo (clausola di capitolato, ordine di servizio).',
  },
  {
    domanda: 'Quando si iscrivono le riserve?',
    risposta: 'Le riserve dell\'esecutore si iscrivono sul registro di contabilità all\'atto della sottoscrizione immediatamente successiva al fatto che le determina, <b>a pena di decadenza</b> (art. 115, comma 2, e art. 7 dell\'Allegato II.14). Il direttore dei lavori vi contrappone le proprie motivate deduzioni.',
  },
  {
    domanda: 'A chi competono la redazione e la sottoscrizione degli atti?',
    risposta: 'Il <b>direttore dei lavori</b> redige e sottoscrive libretto, registro, stato di avanzamento e conto finale. L\'<b>esecutore</b> sottoscrive il registro a ciascuno stato di avanzamento, per accettazione o con riserva. Il <b>RUP</b> emette e sottoscrive il certificato di pagamento, previa verifica della regolarità contributiva.',
  },
  {
    domanda: 'Quali sono i termini per il pagamento?',
    risposta: 'Il certificato di pagamento è emesso dal RUP entro <b>sette giorni</b> dall\'adozione dello stato di avanzamento; il mandato di pagamento è disposto dalla stazione appaltante nei termini di contratto. I termini puntuali sono fissati dal contratto d\'appalto.',
  },
  {
    domanda: 'La sostituzione di un materiale con uno equivalente incide sulla contabilità?',
    risposta: 'La sostituzione con prodotto di prestazioni pari o migliorative si formalizza con <b>verbale di equivalenza</b> sottoscritto dal progettista o dal direttore dei lavori, corredato della documentazione tecnica, e non incide su prezzo, aliquote o computo. La modifica della prestazione configura invece una <b>variante</b>, con concordamento di nuovi prezzi e atto di sottomissione.',
  },
  {
    domanda: 'Una lavorazione contestata sospende la contabilità?',
    risposta: 'No. Si contabilizza la parte conforme; la parte contestata non si contabilizza (riduzione della quota) oppure si trattiene con titolo formale, impregiudicata la facoltà dell\'esecutore di iscrivere riserva alla sottoscrizione del registro.',
  },
  {
    domanda: 'È prevista una contabilità semplificata?',
    risposta: 'Per i lavori di importo inferiore a <b>40.000 euro</b> è ammessa la tenuta semplificata; il certificato di regolare esecuzione può essere sostituito dal visto del direttore dei lavori sulle fatture. Si verifichi in ogni caso quanto prescritto dal contratto.',
  },
]

/** Sezione di β nel manuale unico condiviso, costruita da GUIDA + FAQ.
 *  La usano sia β (registrazione locale) sia l'hub (manuale completo). */
export const BETA_GUIDE: GuideSection = {
  id: 'beta',
  title: 'β Contabilità — Contabilità dei lavori pubblici',
  tool: 'beta',
  order: 70,
  updatedAt: '2026-07-18',
  chapters: [
    ...GUIDA.map((b, i) => ({
      id: `cap-${i}`,
      title: b.titolo,
      bodyHtml: `${b.paragrafi.map((p) => `<p>${p}</p>`).join('')}${b.punti ? `<ul>${b.punti.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}`,
    })),
    {
      id: 'faq',
      title: 'Domande frequenti',
      bodyHtml: FAQ.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${f.domanda}</summary><div>${f.risposta}</div></details>`).join(''),
    },
  ],
  footNote: 'β è un ausilio alla redazione, non consulenza legale. Per gli atti ufficiali si verifica sempre il testo vigente del D.Lgs. 36/2023 e dell\'Allegato II.14.',
}
