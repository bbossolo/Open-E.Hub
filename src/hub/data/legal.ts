/**
 * Note legali di Open E.Hub — sorgente unico del testo mostrato nel modale "Note legali"
 * del welcome (hub). NON viene riportato nei documenti tecnici esportati (computo,
 * relazione, capitolato): quelli seguono un modello tecnico e non necessitano di
 * questa nota.
 *
 * Punto chiave (indicazione utente): i nomi di software/marchi di terzi sono citati
 * SOLO a fini descrittivi e di INTEROPERABILITÀ (import/export dei formati, provenienza
 * di dati e cataloghi). Nessun plagio, nessuna affiliazione, nessuna ridistribuzione
 * dei software originali. Vedi anche l'edizione (src/shared/edition.ts): il code signing
 * è demandato all'IT aziendale.
 */
import { escHtml as esc } from '../../shared/doc/doc'

export interface ThirdPartyMark {
  /** Nome del marchio/prodotto così come citato nella suite. */
  name: string
  /** Titolare (dove noto), a scopo di corretta attribuzione. */
  owner?: string
  /** Perché è citato: la funzione di interoperabilità. */
  use: string
}

/** Software/formati/dati di terzi con cui la suite è interoperabile (import/export,
 *  provenienza dati), con la relativa finalità d'uso. Open E.Hub non include né
 *  ridistribuisce prezzari o cataloghi: l'utente porta i propri file. */
export const THIRD_PARTY_MARKS: ThirdPartyMark[] = [
  { name: 'DEI', owner: 'Tipografia del Genio Civile', use: 'formato prezzario editoriale, se l’utente lo importa in μ Prezzi' },
  { name: 'METEL', use: 'standard di codifica/interscambio del materiale elettrico, riconosciuto in μ Prezzi' },
  { name: 'PriMus', owner: 'ACCA software S.p.A.', use: 'formato di interscambio del computo metrico, in lettura e in scrittura da μ Prezzi' },
  { name: 'Ampère', owner: 'Electro Graphics S.r.l.', use: 'export della lista cavi, se l’utente lo importa in μ Prezzi per ricavarne le quantità' },
]

/** Marchi dei COSTRUTTORI/PRODUTTORI citati nei cataloghi e nei database tecnici.
 *  Elenco non esaustivo, mostrato "ad espansione" per chi fosse interessato. */
export const MANUFACTURER_BRANDS: string[] = [
  'Schneider Electric',
]

/** HTML del corpo del modale "Note legali" (riusa lo stile .cl-body). */
export function legalNoticeHTML(): string {
  const marks = THIRD_PARTY_MARKS.map(m =>
    `<li><b>${esc(m.name)}</b>${m.owner ? ` <span class="lg-owner">(${esc(m.owner)})</span>` : ''} — ${esc(m.use)}.</li>`
  ).join('')
  const brands = MANUFACTURER_BRANDS.map(b => `<li>${esc(b)}</li>`).join('')
  return `
    <p>Open E.Hub è uno <b>strumento di supporto e verifica</b> per la progettazione impiantistica: <b>non è un
    software di calcolo</b>. È distribuito <b>senza alcuna garanzia</b> (vedi la licenza MIT nel repository): gli
    elaborati prodotti sono un <b>ausilio al progettista</b>, le scelte progettuali, il dimensionamento e la
    responsabilità dell’elaborato firmato restano del <b>progettista abilitato</b>.</p>

    <h4>Marchi e software di terzi</h4>
    <p>I nomi di prodotti, formati e marchi eventualmente citati appartengono ai <b>rispettivi proprietari</b>.
    Open E.Hub li richiama <b>unicamente a fini descrittivi e di interoperabilità</b> (riconoscimento di formati,
    indicazione della provenienza di dati): ciò <b>non implica</b> alcuna affiliazione, sponsorizzazione
    o approvazione da parte dei titolari. La suite <b>non include né ridistribuisce</b> prezzari, cataloghi o
    software di terzi: è l’utente a importare i propri file.</p>
    <ul class="hub-guide-ul">${marks}</ul>
    <p>Allo stesso modo, i <b>marchi dei costruttori e produttori</b> di apparecchiature e materiali eventualmente
    richiamati nel riconoscimento di simboli/blocchi DXF appartengono ai <b>rispettivi proprietari</b> e sono
    citati a soli fini descrittivi.</p>
    <details class="lg-details">
      <summary>Aziende citate</summary>
      <ul class="hub-guide-ul">${brands}</ul>
      <p class="lg-note">Elenco non esaustivo, a titolo informativo.</p>
    </details>

    <h4>Prezzari e banche dati</h4>
    <p>I prezzari regionali e le opere editoriali di prezzo sono dei <b>rispettivi enti ed editori</b>; l’utente è
    tenuto a rispettarne le condizioni di licenza. Open E.Hub non ne include alcuno: fornisce solo lo strumento
    per consultare quelli che l’utente importa.</p>

    <h4>Dati di progetto</h4>
    <p>Open E.Hub gira <b>interamente in locale</b>: nessun dato lascia il computer dell’utente. I dati di
    progetto sono salvati in file di progetto (<code>.ehub</code>) <b>sotto il controllo esclusivo dell’utente</b>.</p>`
}
