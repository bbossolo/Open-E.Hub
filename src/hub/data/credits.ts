/**
 * Crediti di Open E.Hub — sorgente del testo mostrato nel modale "Crediti" del
 * welcome (hub). Comprende autore/originatore del progetto, nota sullo sviluppo
 * assistito da AI e i termini della licenza open source (MIT).
 *
 * Il nome/link dell'autore arrivano da versions.js (V.developer); anno e versione
 * sono passati dall'app così il testo resta aggiornato senza toccare questo file.
 */
import { escHtml as esc } from '../../shared/doc/doc'

export interface DeveloperInfo {
  name: string
  github?: string
}

/** HTML del corpo del modale "Crediti" (riusa lo stile .cl-body). */
export function creditsNoticeHTML(dev: DeveloperInfo, opts: { year: number }): string {
  const gh = dev.github
    ? `<a href="${esc(dev.github)}" target="_blank" rel="noopener">${esc(dev.github.replace(/^https?:\/\//, ''))}</a>`
    : ''
  return `
    <p><b>Open E.Hub</b> — suite open source di strumenti per la progettazione impiantistica.</p>
    <p>Progetto avviato da <b>${esc(dev.name)}</b>${gh ? ` · ${gh}` : ''}.</p>
    <p>Sviluppato con il <b>supporto di strumenti di intelligenza artificiale</b>, usati come ausilio in fase
    di sviluppo. L’applicazione <b>non integra funzioni di AI</b> e <b>non invia dati a servizi di AI</b>.</p>

    <h4>Licenza</h4>
    <p>© ${esc(String(opts.year))} <b>${esc(dev.name)}</b> e collaboratori. Distribuito sotto <b>licenza MIT</b>
    (vedi il file <code>LICENSE</code> nel repository): puoi usare, copiare, modificare, distribuire e
    rivendere il software liberamente, anche a fini commerciali, senza garanzia, mantenendo l'avviso di
    copyright e la licenza originali.</p>`
}
