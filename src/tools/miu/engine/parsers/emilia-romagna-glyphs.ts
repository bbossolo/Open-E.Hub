/**
 * Fix mirato per Emilia-Romagna 2026: il gestionale regionale ("Alice") ha
 * esportato più simboli tipografici diversi — apostrofo, virgolette attorno
 * a termini tecnici/stranieri, trattino separatore, simbolo di pollice (″),
 * simbolo di euro — tutti collassati sullo stesso carattere errato `&#191;`
 * (¿, decodificato correttamente da decodeEntities ma sbagliato alla fonte).
 * Non è un problema di XML/parsing: nessun'altra regione ne è affetta.
 *
 * Classificazione per contesto, verificata a campione su tutte le occorrenze
 * reali del prezzario 2026 (ambiguo per costruzione: lo stesso carattere
 * rappresenta cose diverse a seconda del contesto, quindi non esiste
 * un'unica regex sicura — l'ordine delle regole conta).
 */
export function fixEmiliaRomagnaGlyph(text: string): string {
  if (!text || text.indexOf('¿') === -1) return text
  let s = text
  // 0) prefissi elisi noti (priorità: evita che l'accoppiamento a virgolette
  //    sotto inghiotta "l¿accesso dall¿esterno" come se fosse un termine tra virgolette)
  s = s.replace(/\b(l|d|un|dall|all|dell|nell|sull|quell|quest|quant)¿(?=[a-zàèéìòù])/gi, "$1'")
  // 1) coppie ¿termine¿ (o ¿termine" quando la chiusura era già corretta) SENZA
  //    spazio subito dentro i delimitatori → virgolette attorno a un termine tecnico
  s = s.replace(/¿([^\s¿"][^¿"\n]{0,148}[^\s¿"]|[^\s¿"])¿/g, '"$1"')
  s = s.replace(/¿([^\s¿"][^¿"\n]{0,148}[^\s¿"]|[^\s¿"])"/g, '"$1"')
  // 2) soglie in euro ("importo oltre ¿ 20.000,00")
  s = s.replace(/(oltre|fino a|pari a)\s*¿(?=\s*\d[\d.]*,\d{2})/gi, '$1 €')
  // 3) apostrofo generico: lettera¿lettera (qualunque maiuscola/minuscola)
  s = s.replace(/([a-zàèéìòùA-ZÀÈÉÌÒÙ])¿([a-zàèéìòùA-ZÀÈÉÌÒÙ])/g, "$1'$2")
  // 4) apostrofo a fine parola tutta maiuscola (accento mancante, es. "SOMMITA¿:")
  s = s.replace(/([A-ZÀÈÉÌÒÙ])¿(?![a-zà-ù0-9])/g, "$1'")
  // 5) pollici (Ø 4¿) o range numerico stretto (+5°¿+55°C)
  s = s.replace(/([\d°])¿(?=[+-]?\d)/g, '$1-')
  s = s.replace(/(\d)¿(?!\d)/g, '$1″')
  // 6) separatore residuo tra token (spec elettriche, codici normativa, liste)
  s = s.replace(/\s¿\s/g, ' - ')
  s = s.replace(/\s¿(?=\S)/g, ' - ')
  return s
}
