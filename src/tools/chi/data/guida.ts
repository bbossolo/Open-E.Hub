/** χ Refs — sezione della guida unica condivisa (basi DXF esterne). */
import type { GuideSection } from '../../../shared/ui/guide'

export const CHI_GUIDE: GuideSection = {
  id: 'chi',
  title: 'χ Refs — Normalizzazione delle basi DXF',
  tool: 'chi',
  order: 75,
  updatedAt: '2026-07-26',
  chapters: [
    {
      id: 'panoramica',
      title: 'Panoramica',
      bodyHtml: `<p class="ehb-guide__lead">χ prende un DXF esterno e ne fa l'<b>xref</b> che puoi allegare alle tue tavole: sposta i suoi layer sui tuoi layer standard, spegne quello che non serve, dichiara le unità. Quello che facevi a mano in AutoCAD a ogni consegna.</p>
      <p>Il principio è uno solo: <b>il disegno non si tocca</b>. χ non ridisegna niente e non converte niente — ricopia il file cambiando soltanto i nomi dei layer. Quote, campiture, spline, immagini e blocchi arrivano dall'altra parte esattamente come sono partiti.</p>`,
    },
    {
      id: 'apri',
      title: '1 · Apri il DXF',
      bodyHtml: `<p>Trascina il file, o usa <b>Apri</b>. χ lo legge a stream: regge senza problemi le tavole vere da centinaia di MB.</p>
      <p>Nella scheda in alto trovi cosa ha capito: quanti layer contengono davvero disegno (spesso sono meno della metà), quante entità, e soprattutto <b>la scala</b>.</p>
      <p><b>Sulla scala:</b> χ non si fida di quello che il file dichiara. I DXF mentono — capita di trovarne uno che dichiara millimetri ed è disegnato in metri, e fidarsi sbaglierebbe ogni lunghezza di mille volte. χ confronta l'ingombro del disegno con le dimensioni di un edificio credibile e ti dice cosa ha trovato. Se non riesce a decidere, te lo dice invece di indovinare.</p>`,
    },
    {
      id: 'fondi',
      title: '2 · Smista i layer',
      bodyHtml: `<p>A sinistra i layer del file, a destra quelli dello studio. In mezzo il pulsante <b>⚡ Smista automaticamente</b>.</p>
      <p><b>Il file si apre com'è.</b> Nessuna decisione è già presa: tutti i layer stanno a sinistra e i cassetti sono vuoti. Vedere il disegno prima di vederlo riordinato è metà del lavoro — e lo smistamento resta una tua scelta, non qualcosa che è già successo mentre guardavi altrove.</p>
      <p>Quando premi il pulsante, i layer <b>volano nel cassetto che li accoglie</b>, i pesanti per primi. Serve a vedere il <b>criterio</b> con cui χ ha deciso: se sbaglia, te ne accorgi mentre accade invece che alla fine. Poi il pulsante diventa <b>↻ Rismista quello che resta</b>.</p>
      <p><b>Tre modi di assegnare, scegli tu.</b></p>
      <ul>
        <li><b>Un clic sulla riga</b> apre un menù lì dove sei, con tutte le destinazioni. È il più veloce per un layer singolo.</li>
        <li><b>Maiusc+clic</b> costruisce una selezione — anche venti righe — poi clicca il cassetto o premi il suo <b>numero</b>. È il modo per smaltire in un colpo tutto quello che va spento.</li>
        <li><b>Il trascinamento</b>, se lo preferisci.</li>
      </ul>
      <p><b>Correggere costa quanto assegnare.</b> Una pastiglia già dentro un cassetto è viva quanto una riga: cliccala e il menù ti dice dov'è adesso, così la sposti in un altro cassetto <b>senza tornare a sinistra</b>. Il tasto <b>←</b> la rimanda indietro, e anche la colonna di sinistra è una zona di rilascio valida.</p>
      <p>L'elenco a sinistra è un <b>elenco da svuotare</b>: ogni layer deve finire da qualche parte, in un layer dello studio o fra gli <b>Spenti</b>. Quello che resta è lavoro non fatto, e il riepilogo in basso te lo dice.</p>
      <p><b>Cosa viene proposto.</b> Di norma <i>Solo murature e arredi</i>: su una base architettonica serve vedere dove sono i muri e cosa c'è dentro, mentre le quote, i retini e i cartigli di chi l'ha disegnata non servono. Se ti serve tenere di più, passa a <i>Mappatura completa</i>.</p>
      <p>Se ti serve un layer che nello standard non c'è — per raggruppare l'impianto altrui invece di spegnerlo — usa <b>+ Nuovo layer</b>. E la <b>matita ✎</b> su un cassetto ne cambia il nome <b>per questo file</b>: lo standard dello studio resta quello per tutti gli altri.</p>
      <p>Il <b>layer 0</b> non compare nell'elenco: si importa così com'è. È quello su cui vivono i blocchi, e rinominarlo o spegnerlo farebbe sparire i simboli dal disegno.</p>`,
    },
    {
      id: 'testi',
      title: 'I testi',
      bodyHtml: `<p>I testi vengono <b>preservati</b>: finiscono su <code>TESTI</code> qualunque sia il layer di partenza, così le scritte sopravvivono anche quando il loro layer si spegne.</p>
      <p>Se invece non li vuoi — le quote di partenza, di solito, che nelle tue tavole non servono — puoi scartarli.</p>`,
    },
    {
      id: 'esporta',
      title: '3 · Esporta',
      bodyHtml: `<p>Il file esce col nome dell'originale più <b>«— xref»</b>, pronto da allegare.</p>
      <p>Due cose che χ fa e che a mano si dimenticano sempre:</p>
      <ul>
        <li><b>I layer d'origine non si cancellano, si spengono.</b> Restano nel file, vuoti e invisibili: se un domani serve rivederli, basta riaccenderli. Cancellarli romperebbe i riferimenti dei viewport e dei filtri layer.</li>
        <li><b>Le entità spostate tornano a BYLAYER.</b> Se il file di partenza aveva il colore sulla singola linea, quella continuerebbe a disegnarsi col colore suo anche dopo la fusione, e la tavola resterebbe sporca.</li>
      </ul>`,
    },
    {
      id: 'malformati',
      title: 'Se il file è malformato',
      bodyHtml: `<p>Capita, e χ te lo dice. Il caso tipico è un DXF passato da un <b>convertitore online</b>: escono file con le righe fuori posto che nemmeno AutoCAD apre correttamente.</p>
      <p>χ li ricopia comunque fedelmente, ma la rimappatura può restare incompleta. Se lo vedi, la cosa giusta è richiedere il <b>DXF salvato direttamente dal CAD</b>.</p>`,
    },
  ],
}
