/**
 * Normalizzazione delle DESCRIZIONI dei prezzari verso lo standard "Lombardia":
 * ogni voce dev'essere **self-contained** (leggibile da sola, senza risalire al
 * capitolo padre). Funzioni pure e testabili, usate dai parser al build per
 * comporre `desc_short` quando la foglia è un frammento.
 */

/** Normalizza spazi/newline e taglia. */
function clean(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Una descrizione è self-contained se si legge da sola: inizia con MAIUSCOLA
 * (non è un frammento tipo "fino a kg…", "di kg…", "in opera…") ed ha lunghezza
 * ragionevole. Allineata alla metrica di baseline della roadmap.
 */
export function isSelfContained(desc: unknown): boolean {
  const s = clean(desc)
  if (s.length < 8) return false
  return /^[A-ZÀÈÉÌÒÙ]/.test(s)
}

/** "Titolo" = inizia con maiuscola (è un capo-gerarchia, non un frammento); ammette anche
 *  titoli brevi (es. "SCAVI", "Opere") che non superano la soglia di isSelfContained. */
function looksLikeHeading(s: string): boolean {
  return /^[A-ZÀÈÉÌÒÙ]/.test(s)
}

/** Un livello-padre è "rumoroso" (inusabile) se vuoto, enorme o multi-campo. */
function isNoisyParent(p: string): boolean {
  // Cap alto (200): certi prezzari, es. Emilia-Romagna, hanno il "padre" = descrizione
  // completa lunga (~100+ char), che è proprio ciò che vogliamo anteporre.
  if (!p || p.length < 3 || p.length > 200) return true
  // multi-campo tipo "Uso: … Compreso: …" (≥2 due-punti) → non è un titolo pulito
  if ((p.match(/:/g) || []).length >= 2) return true
  return false
}

/** Concatena le parti deduplicando (se una contiene la successiva non la ripete). */
function joinChain(parts: string[]): string {
  let out = ''
  for (const p of parts) {
    if (!p) continue
    if (!out) { out = p; continue }
    const lo = out.toLowerCase(), lp = p.toLowerCase()
    if (lo.includes(lp)) continue          // già contenuta
    if (lp.includes(lo)) { out = p; continue }
    out += (/[:\-–—]$/.test(out) ? ' ' : ' — ') + p
  }
  return out
}

/**
 * Compone una descrizione completa = capo-gerarchia + foglia.
 *  - se la foglia è già self-contained → invariata (Lombardia/Veneto);
 *  - altrimenti trova l'ÀNCORA: il livello self-contained più profondo, e concatena
 *    da lì in giù tutti i livelli (anche frammenti intermedi) fino alla foglia.
 *    Così descrizioni annidate (es. DEI: "Autocarro ribaltabile:" › "portata 10.000
 *    kg:" › "a caldo") diventano "Autocarro ribaltabile: portata 10.000 kg: a caldo".
 *  - i livelli rumorosi (vuoti/multi-campo) vengono scartati.
 *
 * @param levels livelli gerarchici ordinati generale→specifico
 * @param leaf   descrizione foglia (la desc_short grezza della voce)
 */
export function composeDesc(levels: Array<string | undefined>, leaf: unknown): string {
  const lf = clean(leaf)
  if (isSelfContained(lf)) return lf

  const lv = levels.map(clean).filter(p => !isNoisyParent(p))
  const chain = [...lv, lf]
  // àncora = capo-gerarchia (titolo) più profondo, escludendo la foglia
  let anchor = -1
  for (let i = chain.length - 2; i >= 0; i--) if (looksLikeHeading(chain[i])) { anchor = i; break }
  if (anchor < 0) return lf
  return joinChain(chain.slice(anchor)) || lf
}
