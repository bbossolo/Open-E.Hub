/** μ Prezzi — sezione della guida unica condivisa (prezzari + computo metrico). */
import type { GuideSection } from '../../../shared/ui/guide'

export const MIU_GUIDE: GuideSection = {
  id: 'miu',
  title: 'μ Prezzi — Prezzari e computo metrico',
  tool: 'miu',
  order: 40,
  updatedAt: '2026-08-02',
  chapters: [
    {
      id: 'come-funziona',
      title: 'Come funziona',
      bodyHtml: `<p class="ehb-guide__lead">I prezzari servono a <b>consultare</b> e a pescare le voci. Il <b>Computo Metrico è del tuo progetto</b> e ha il suo <b>Elenco Prezzi</b>: le voci che aggiungi ci restano, indipendenti dalla ricerca, e le puoi modificare.</p>
      <p>In testa alla barra filtri c'è il toggle <b>Rapida / Completa</b>: <b>Rapida</b> (default) è la
        sola consultazione — cerca, seleziona, copia l'Elenco Prezzi, un solo passo; il
        dock <b>Da copiare</b> mostra conteggio, totale e la mini-lista delle voci scelte,
        con la ✕ per togliere quella sbagliata senza ricercarla, e una maniglia per regolarne
        l'altezza. <b>Completa</b> è il flusso di computo intero, coi 4 passi sotto. Passare da una
        all'altra non perde nulla: la Rapida nasconde soltanto, il computo resta popolato. Se il
        computo è già popolato — sessione ripresa, .ehub, distinta importata — μ si apre in Completa,
        finché non scegli tu.</p>
      <p><b>Il binario in alto sono i 4 passi del lavoro</b> (modalità Completa) — cliccabili, o coi tasti <b>1–4</b>:<br>
      <b>1 · Cerca o componi</b> → <b>2 · Misura</b> → <b>3 · Categorizza</b> → <b>4 · Esporta</b>. <b>Esc</b> torna a Cerca.</p>`,
    },
    {
      id: 'cerca-componi',
      title: '1 · Cerca o componi',
      bodyHtml: `<ul>
        <li><b>Porta il tuo prezzario</b>: trascinalo <b>ovunque nella finestra</b> (o usa <b>⋯ Altro → Trascina file</b> per sfogliare). Se è disponibile in più formati scegli l'<b>.xml</b>: μ ha un parser dedicato per ogni famiglia di prezzario e ne legge i campi veri (codice, articolazione, unità di misura). Dell'<b>.xlsx</b> legge il <b>primo foglio</b> deducendo le colonne dalle intestazioni — funziona, ma perde di più. I listini <b>METEL .txt</b> dei fornitori di materiale elettrico entrano allo stesso modo.</li>
        <li><b>Carica</b> uno o più prezzari dalla lista a sinistra: restano in cache, ma quello <b>APERTO</b> (che consulti, e su cui cercano i motori di match dell'import) è <b>sempre uno solo alla volta</b>. Clicca un altro prezzario nella lista per passare a quello.</li>
        <li><b>Cerca in linguaggio naturale</b>: scrivi come lo chiami tu — «passerella a filo», «tubo corrugato», «valvola a sfera» — non serve la dicitura esatta del prezzario. Le più pertinenti salgono in alto. La ricerca per <b>codice</b> funziona come sempre. I <b>chip macrocategoria</b> (Elettrici / Speciali / Meccanici / Antincendio) e i <b>filtri</b> restringono il campo; <b>✕ Reset filtri</b> azzera tutto.</li>
        <li><b>Aggiungi le voci al computo</b> con <b>＋ Aggiungi al computo</b>. Seleziona prima le righe (<b>clic</b>, <b>Shift+clic</b> per un intervallo, <b>trascina</b> per un blocco; da tastiera <b>↑↓</b> + <b>Spazio</b>, <b>Ctrl/⌘+A</b> tutte), oppure apri il dettaglio con <b>doppio clic</b>. <b>Importante</b>: la selezione serve solo a scegliere — <b>deselezionare o rifare la ricerca NON toglie nulla dal computo</b>. Un <b>✓</b> accanto al codice segnala le voci già dentro.</li>
        <li><b>✎ Componi descrizione</b> (accanto alla ricerca): quando il prezzario non ha la voce che ti serve, scegli una famiglia e le sue caratteristiche a chip — o crea una <b>famiglia personalizzata</b> — e ottieni una descrizione breve+estesa in stile computo. Con <b>Σ Analisi Prezzi</b> componi il prezzo unitario (manodopera + materiale + noli, Spese Generali e Utile d'Impresa): la riga manodopera propone da sola una <b>tariffa CCNL pertinente</b> in base alla macrocategoria della voce, e il fascicolo mostra l'<b>incidenza % manodopera</b> sul prezzo unitario. Puoi anche importare una <b>scheda tecnica PDF</b> — il riconoscimento è ottimizzato per produttori raggruppati per comparto (illuminazione, meccanica/frigo, elettrogeni, UPS, ACS, elettrico/EV, TVCC…).</li>
        <li><b>Catalogo dello studio</b>: la prima volta che decidi come tradurre un blocco/famiglia in una voce di prezzario (o in una voce composta), μ se lo ricorda — la volta successiva quella scelta compare come «✓ DAL CATALOGO» ancora prima di cercare. La <b>Libreria voci</b> è diversa: dal Compositore/Analisi Prezzi puoi salvare esplicitamente una voce composta in libreria (personale, o «di studio» condivisa in azienda) e riusarla senza ricomporla — priorità in caso di sovrapposizione: <b>Catalogo studio</b> &gt; <b>Libreria</b> &gt; ricerca nel prezzario.</li>
      </ul>`,
    },
    {
      id: 'misura',
      title: '2 · Misura',
      bodyHtml: `<ul>
        <li>Qui c'è il <b>Computo Metrico</b> con il suo <b>Elenco Prezzi</b> in fondo. Scrivi la quantità, o apri <b>▸ Misure</b> sulla riga per le misure articolate (L×L×H×N su più righe, con detrazioni). C'è una <b>ricerca ⌕ nel computo</b> per ritrovare una voce al volo. Il toggle vista in alto passa da <b>Elenco</b> (righe) a <b>Tabella</b>: nella vista Tabella un clic apre subito il dettaglio della voce, invece di limitarsi a selezionarla.</li>
        <li>Nel popover <b>⋯ Visualizzazione</b>, «Voci: <b>Compatte</b> / Espanse» — Compatte (default)
          mostra ogni voce su una riga sola con gli stessi campi (codice, descrizione, U.M., misura,
          prezzo, MDO%), Espanse resta la card multi-riga; si combina con la Densità e resta impostata
          fra una sessione e l'altra.</li>
        <li><b>✎ modifica</b> una voce del computo: si apre un editor rapido per <b>descrizione, prezzo e U.M.</b>, con <b>Salva modifiche</b>. Modifichi la <b>tua copia</b> nel computo — il prezzario resta intatto. Serve rifare la voce da capo? Il pulsante <b>Compositore…</b> è lì in fondo.</li>
        <li><b>⧉ Duplica</b> (tasto destro su una voce): serve quando la stessa voce va in <b>più sottocategorie</b> — es. un allaccio che ricade in discipline diverse. Duplichi e dai a ogni copia la sua categoria.</li>
      </ul>`,
    },
    {
      id: 'categorizza',
      title: '3 · Categorizza',
      bodyHtml: `<p>Assegna alle voci <b>Supercategoria</b> (ambito: Esterni, Cabina…), <b>Categoria</b> (disciplina: Impianti Elettrici…) e <b>Sottocategoria</b> (voce della disciplina). Trascina i nomi dal <b>Database categorie</b> sulla voce, o scrivili a mano. <b>Ogni livello è indipendente</b>: puoi assegnare la Sottocategoria anche senza aver messo le altre. Col <b>tasto destro</b> assegni a tutta la selezione. <b>✕</b> toglie la categoria dalla voce (o un nome dal database).</p>`,
    },
    {
      id: 'import-tool',
      title: 'Import da Ampère e altri tool',
      bodyHtml: `<ul>
        <li><b>⇪ Ampère</b> (nell'header, o trascina il file): importa una <b>lista cavi da Ampère</b>. Le <b>lunghezze Lc</b> del file diventano le quantità e μ aggancia ogni cavo alla voce di prezzario giusta (per sigla e sezione). I <b>cavi unipolari</b> sono già moltiplicati per il numero di conduttori (100 m con 6 conduttori = 600 m). Ogni linea <b>eredita il quadro</b> da cui deriva: diventa la sua <b>Sottocategoria</b>, così il computo è già raggruppato per quadro. Serve un prezzario caricato.</li>
      </ul>`,
    },
    {
      id: 'esporta',
      title: '4 · Esporta',
      bodyHtml: `<p><b>Elenco Prezzi</b> (copia-incolla, sempre raggiungibile anche dalla barra di Cerca), <b>Report PDF</b> e i <b>fascicoli Σ Analisi Prezzi</b>.</p>
      <details><summary>Perché una voce non si trova nella ricerca?</summary><div>O è nel prezzario <b>chiuso</b> (carica quello giusto prima), oppure il termine cercato è troppo di nicchia per il match naturale — prova col <b>codice</b> esatto, oppure componila da zero con <b>✎ Componi descrizione</b>.</div></details>
      <details><summary>Qual è la differenza tra una voce di prezzario e una voce di computo?</summary><div>La voce di prezzario è nel catalogo consultabile, sola lettura. Aggiungendola al computo ne crei una <b>copia indipendente</b> nel tuo Elenco Prezzi: modificarla (prezzo, descrizione, U.M.) non tocca l'originale, e resta tua anche se cambi o chiudi il prezzario di partenza.</div></details>
      <details><summary>Cambiando prezzario perdo le voci già aggiunte al computo?</summary><div>No: l'Elenco Prezzi contiene copie, non collegamenti alla ricerca — il computo resta invariato qualunque prezzario tu apra o chiuda dopo.</div></details>`,
    },
  ],
  footNote: 'Il computo resta tuo anche cambiando prezzario: l\'Elenco Prezzi contiene <b>copie</b> delle voci, non collegamenti alla ricerca. Salvi tutto nel progetto Open E.Hub (o come «Computo» a parte, dal pulsante <b>Computi</b>).',
}
