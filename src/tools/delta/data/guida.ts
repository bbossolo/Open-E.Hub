/** δ Copertine — sezione della guida unica condivisa (copertine degli elaborati). */
import type { GuideSection } from '../../../shared/ui/guide'

export const DELTA_GUIDE: GuideSection = {
  id: 'delta',
  title: 'δ Copertine — Copertine degli elaborati',
  tool: 'delta',
  order: 70,
  updatedAt: '2026-08-06',
  chapters: [
    {
      id: 'panoramica',
      title: 'Panoramica',
      bodyHtml: `<p class="ehb-guide__lead">δ genera le <b>copertine</b> (frontespizi) degli elaborati di progetto: parti dal <b>cartiglio</b> già impaginato (il tuo, o quello imposto dal capo commessa), importi l'<b>elenco elaborati</b>, δ <b>riconosce da solo le celle</b> del cartiglio e vi mette i campi, e ottieni <b>un PDF per ogni elaborato</b> — tutti in uno ZIP — al posto di compilarli a mano uno per uno.</p>
      <p>I tre passi (in alto): <b>1 Template</b> per caricare il cartiglio e posizionarne i campi (senza scrivere sintassi), <b>2 Elenco</b> per importare gli elaborati, <b>3 Genera</b> per l'anteprima e l'export (PDF o DXF).</p>
      <p>Due modi di lavorare, a seconda del cartiglio:</p>
      <ul>
        <li><b>Commessa nuova, cartiglio diverso</b> (la norma): lo carichi, δ <b>riconosce i campi</b>, compili, generi. Il cartiglio resta nel <b>Progetto Open E.Hub</b> (.ehub) sul tuo PC.</li>
        <li><b>Cartiglio ricorrente</b> (i pochi che si ripetono, studio + collaboratori): lo salvi una volta come <b>Modello dello studio</b> e lo riapplichi con un click.</li>
      </ul>`,
    },
    {
      id: 'template',
      title: '1 · Scegli e prepara il template',
      bodyHtml: `<p>Il template è il cartiglio già impaginato, che δ usa come <b>sfondo</b> — non lo ridisegna. Caricalo come <b>PDF</b> (si usa la 1ª pagina) o come <b>immagine</b> (PNG/JPG) dalla schermata <b>Home</b>: qui vivono il caricamento, l'anteprima 🔒 di sola lettura e i <b>Modelli/Storico</b> dello studio. Per posizionare o modificare i campi apri <b>✎ Editor campi</b> (in alto, o «✎ Sblocca nell'editor» sopra l'anteprima): solo lì compaiono le 3 colonne — lista campi a sinistra, canvas al centro, proprietà a destra.</p>
      <ul>
        <li>Il PDF viene rasterizzato per l'editor; nel PDF finale lo sfondo è alle <b>dimensioni fisiche reali</b> della pagina, e i campi sono vero testo vettoriale, sempre nitido.</li>
        <li>Se il PDF incorpora i propri <b>font</b> (il caso comune per i cartigli da CAD/BIM), δ li rileva ed esporta i campi con quel font vero. Se ne trova più di uno, scegli quale usare.</li>
        <li><b>Modelli/Storico dello studio</b> (in Home, sotto il caricamento): se il cartiglio è uno dei pochi ricorrenti, applicalo da qui invece di ricaricarlo — vedi il capitolo «Modelli dello studio». L'anteprima resta di sola lettura finché non apri l'Editor campi.</li>
      </ul>
      <p>Un cartiglio diverso per ogni commessa è la norma — δ non impone un layout, rispetta il tuo.</p>
      <p><b>Rileva e posiziona i campi.</b> Il modo più veloce: <b>⌖ Rileva campi dal cartiglio</b>. δ legge le etichette stampate sul cartiglio (Committente, Commessa n°, scala, Titolo, Tavola N°, Stato…) e crea <b>ogni campo già nella cella giusta</b>, con la sorgente pre-assegnata; ti resta solo da rifinire col trascinamento. Riconosce anche le diciture di altri studi (Cliente, Stazione Appaltante, Elaborato/Foglio, Redatto/Verificato…).</p>
      <p>In alternativa aggiungi i campi a mano:</p>
      <ul>
        <li><b>Campo fisso</b> — stesso valore su tutte le copertine (intestazione studio, firme come testo).</li>
        <li><b>Campo variabile</b> — un valore <b>diverso per elaborato</b>, da una colonna dell'elenco.</li>
        <li><b>▭ Disegna campo</b> — traccia un rettangolo sul cartiglio: nasce un campo in quel riquadro, da assegnare a testo fisso o a una colonna.</li>
        <li><b>✨ Standard</b> — aggiunge in un colpo solo i campi tipici del cartiglio, impilati; poi usa «Rileva» o il trascinamento per posizionarli.</li>
      </ul>
      <p>Il tipo (Fisso/Variabile) non è definitivo: nel pannello proprietà del campo selezionato si cambia in qualsiasi momento, senza perdere posizione, ancoraggio o dimensione.</p>
      <p><b>Sorgente e Formato, senza sintassi.</b> Per un campo variabile scegli la colonna da un <b>menu a tendina</b> (niente testo da scrivere) e, se serve, un formato pronto: <b>MAIUSCOLO</b>, <b>solo l'ultima parte</b> (es. il codice tavola dopo il codice commessa), <b>solo la prima parte</b>, <b>mese e anno</b> («APRILE 2026») o <b>stato per esteso</b> (E→ESECUTIVO, B→BOZZA). Chi ha bisogno di comporre più colonne o un formato particolare trova il pannello <b>Avanzate</b> (collassato) con l'espressione testuale — i cartigli già preparati con espressioni continuano a funzionare invariati.</p>
      <p>Il <b>Titolo Tavola</b> (il nome dell'elaborato, dalla colonna «TITOLO CARTIGLIO») viene creato <b>sempre</b>, anche quando il cartiglio non stampa l'etichetta «Titolo»: lo trovi sotto l'Oggetto, da trascinare nella sua cella.</p>
      <p><b>Ogni campo è una casella di testo.</b> Il testo <b>va a capo da solo</b> quando è lungo e <b>mantiene il corpo</b> che hai impostato: non si rimpicciolisce per stare su una riga. La <b>Casella (%)</b> nelle proprietà lascia stare il testo dentro la sua cella: vuota = automatica (dal campo al bordo pagina), altrimenti stringila alla larghezza/altezza della cella. Il corpo si riduce solo quando serve per farcelo stare: una <b>parola singola</b> più larga della casella, oppure un blocco già andato a capo che supera l'<b>altezza</b> della casella.</p>
      <p><b>Editing a schermo.</b> Sul campo selezionato compaiono le maniglie: <b>×</b> per eliminarlo, l'<b>angolo</b> (⤢/⤡) per ridimensionare la <b>casella di testo</b> trascinando — larghezza e altezza insieme (decide dove va a capo e quanto testo entra, non quanto è grande il carattere — sono due cose separate, come in un editor: la dimensione del testo si cambia a parte, nel pannello proprietà); doppio clic sulla casella azzera larghezza e altezza, tornando automatica. Il tasto <b>Canc</b> elimina, le <b>frecce</b> spostano (Shift = passo largo). Quel che vedi qui è quel che esce nel PDF, a qualsiasi formato.</p>
      <p>Quando è tutto a posto, <b>✓ Applica e continua</b> (in alto) porta al passo successivo — le modifiche sono già salvate, l'azione serve solo a proseguire.</p>`,
    },
    {
      id: 'elenco',
      title: '2 · Importa l\'elenco elaborati',
      bodyHtml: `<p>Importa il file con <b>un elaborato per riga</b> (CSV o Excel). Si genererà <b>una copertina per riga</b> — mai un unico documento unito.</p>
      <ul>
        <li>δ trova da solo la riga di intestazione vera anche se il foglio ha righe di preambolo (Commessa/Cliente/Impianto): non serve ripulire il file a mano.</li>
        <li>Se l'Excel ha <b>più fogli</b> (es. uno per disciplina), δ propone quali importare — i fogli riconosciuti come tabella elaborati sono preselezionati, e le copie identiche non vengono duplicate. Puoi sceglierne più d'uno: le righe si uniscono in un solo elenco.</li>
        <li>Dal <b>foglio iniziale</b> (frontespizio) δ legge i metadati di progetto (Committente, Oggetto): li puoi usare nei campi.</li>
      </ul>
      <p>L'elenco è <b>opzionale</b>: senza, δ genera una sola copertina coi soli campi fissi. Fallo comunque per primo, se ce l'hai: nel passo successivo i campi si collegano da soli alle sue colonne.</p>
      <p><b>Verifica intestazione.</b> Dopo l'import compare sempre un passo di controllo: δ mostra dove pensa che siano le etichette delle colonne (Codice Commessa, Disciplina, Tavola N°…) — anche se sono disposte su <b>colonne</b> anziché su righe (un elenco "trasposto", un elaborato per colonna) δ prova a riconoscerlo da solo. Se la riga evidenziata non è quella giusta, clicca direttamente la riga corretta nell'anteprima, o cambia orientamento coi due pulsanti in alto; poi <b>✓ Conferma importazione</b>. Le colonne non riconosciute (sigle interne, codifiche di commessa come fase/lotto/comparto) restano comunque importate, con un menu per assegnarle a mano a una delle chiavi standard; la casella <b>«🎓 ricorda per lo studio»</b> (riservata al titolare) insegna l'alias in modo permanente, così i prossimi elenchi con la stessa intestazione si riconoscono da soli.</p>
      <p><b>Mappatura colonne.</b> Dopo la verifica, un blocco dedicato collega i campi del template alle colonne dell'elenco; <b>✨ Rileva colonne automaticamente</b> prova a farlo da solo — resta comunque libero di correggere il collegamento a mano, colonna per colonna.</p>`,
    },
    {
      id: 'genera',
      title: '3 · Anteprima ed export',
      bodyHtml: `<p>La vista <b>Genera</b> mostra l'anteprima di ogni copertina coi valori reali; con l'elenco caricato, le frecce ‹ › scorrono elaborato per elaborato, e scegli da quale colonna prendere il <b>nome dei file</b> (di norma il codice elaborato/tavola, rilevato in automatico).</p>
      <ul>
        <li><b>⎙ Genera copertine (ZIP)</b> — un <b>PDF vero e separato per ogni elaborato</b> (mai un unico multipagina), tutti in un solo ZIP da estrarre. Funziona anche offline, nessuna app esterna.</li>
        <li><b>⎘ Esporta DXF (ZIP)</b> — gli stessi cartigli come <b>DXF vettoriale</b> (cornice + testo editabile), per lavorarli in CAD. Serve il cartiglio caricato come PDF in questa sessione.</li>
        <li><b>🖶 Stampa anteprima corrente</b> — stampa/salva <b>solo</b> la copertina in anteprima, per un controllo visivo rapido.</li>
      </ul>
      <details><summary>La copertina esce leggermente stirata?</summary><div>Il template viene adattato alle sue proporzioni originali (per i PDF, alle dimensioni fisiche reali della pagina). Verifica che il template caricato non sia già stato deformato altrove.</div></details>
      <details><summary>Il mio template è un PDF di più pagine.</summary><div>δ usa la <b>1ª pagina</b> come cartiglio. Il supporto multipagina è previsto in una versione successiva.</div></details>`,
    },
    {
      id: 'modelli',
      title: '4 · Modelli dello studio',
      bodyHtml: `<p>La maggior parte dei cartigli è <b>diversa per ogni commessa</b> (spesso imposta a monte dal capo commessa) e resta nel <b>Progetto Open E.Hub</b> (.ehub) <b>sul tuo PC</b>: è dato tuo, non va su nessun server.</p>
      <p>Pochi cartigli invece <b>si ripetono</b> — quelli dello studio con i collaboratori più frequenti. Questi li salvi una volta come <b>Modelli dello studio</b> (template + campi già posizionati) e li riapplichi con un click: l'accordion <b>«Modelli cartiglio dello studio»</b> (nella Home del passo 1) li elenca, ricercabili per nome.</p>
      <ul>
        <li><b>Applica</b> un modello — lo può fare ogni collega dell'azienda: ricarica il cartiglio e i suoi campi in <b>anteprima di sola lettura</b> (🔒), pronti per la nuova commessa. Per ritoccarli apri <b>✎ Editor campi</b> (o «✎ Sblocca nell'editor» sopra l'anteprima): non serve ricreare i campi, restano quelli del modello.</li>
        <li><b>💾 Salva come modello</b>, <b>✎ Rinomina</b>, <b>⟳ Aggiorna col cartiglio corrente</b>, <b>✕ Elimina</b> — riservati al <b>titolare</b> dello studio (curazione).</li>
        <li><b>⇪ Importa / ⭳ Esporta</b> un modello come file, per condividerlo.</li>
      </ul>
      <p>La libreria è <b>dell'azienda</b> (edizione con login): la vedono i colleghi della stessa azienda, la cura il titolare. È <b>attiva</b>: i modelli caricati compaiono con nome e anteprima; gli slot ancora vuoti restano in grigio finché il titolare non carica anche i ~5 modelli ricorrenti dello studio.</p>
      <p>Sotto la libreria c'è lo <b>Storico commesse</b>: qui <b>ogni collega</b> (non solo il titolare) può salvare il template del cartiglio di una commessa (max <b>4 per commessa</b>, ~1 MB l'uno), indicandone il codice. A differenza del cartiglio della commessa corrente — che resta nel file .ehub sul tuo PC — lo storico è salvato sul <b>cloud</b> e condiviso con tutta l'azienda: serve a ritrovare i cartigli delle commesse passate.</p>`,
    },
  ],
  footNote: 'Il cartiglio di ogni commessa resta nel Progetto Open E.Hub (.ehub) sul tuo PC: «Nuovo progetto» azzera, «Salva progetto» conserva. Sul cloud condiviso vivono solo i modelli ricorrenti della Libreria e lo Storico commesse.',
}
