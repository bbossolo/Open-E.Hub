/**
 * Database della struttura delle categorie del Computo Metrico — 3 livelli
 * (Supercategoria / Categoria / Sottocategoria).
 *
 * Vocabolario di partenza minimo per suggerimenti/ricerca/drag&drop nella
 * vista Categorie di μ: a runtime si fonde con le categorie dell'utente
 * (localStorage) e con quelle già usate nel computo corrente, che sono la
 * fonte primaria — ogni studio costruisce il proprio vocabolario usando l'app.
 */

/** Nomi per livello. `sp`/`cat`/`sb` = Supercategoria/Categoria/Sottocategoria. */
export interface CategorieDb {
  sp: string[]
  cat: string[]
  sb: string[]
}

/** Riga di computo con un percorso di categoria a 3 livelli ("Liv1 · Liv2 · Liv3"). */
export interface CategoriaRow { categoria?: string }

/** Separatore del percorso — stesso di `CartItem.categoria` e `CAT_SEP` in μ. */
const CAT_SEP = ' · '

/**
 * Normalizza il nome di una Supercategoria (AMBITO) togliendo un eventuale
 * numero/intervallo finale di edificio-istanza — "Comparto 10"/"Comparto 11"
 * → "Comparto", "Avancorpo 8-9" → "Avancorpo", "Cabina elettrica 4" →
 * "Cabina elettrica". Voluto dall'utente: l'ambito è un TIPO di zona
 * riusabile fra progetti, non l'edificio specifico di un progetto — i
 * suggerimenti restano generici invece di moltiplicarsi per ogni numero
 * civico/comparto incontrato. Si applica SOLO al livello Supercategoria
 * (`sp`); Categoria e Sottocategoria restano testo libero invariato.
 */
export function normalizzaAmbito(nome: string): string {
  return (nome || '').trim().replace(/\s+\d+([-–]\d+)?$/, '').trim()
}

/** Vocabolario minimo di partenza — pochi esempi generici, non un catalogo
 *  completo: lo studio lo espande usando l'app sui propri computi. */
export const CATEGORIE_GOLDEN: CategorieDb = {
  sp: ['Cabina elettrica', 'Esterni', 'Edificio principale'],
  cat: ['Impianti Bassa Tensione', 'Impianti Speciali'],
  sb: ['Impianto Fotovoltaico', 'Quadri Elettrici', 'Illuminazione'],
}

/**
 * Estrae la struttura categorie da righe di computo già parsate: livelli
 * posizionali del percorso "Liv1 · Liv2 · Liv3", deduplicati, in ordine
 * alfabetico italiano.
 */
export function estraiCategorieDaVcRows(rows: Array<Pick<CategoriaRow, 'categoria'>>): CategorieDb {
  const liv: [Set<string>, Set<string>, Set<string>] = [new Set(), new Set(), new Set()]
  for (const row of rows) {
    const parts = (row.categoria || '').split(CAT_SEP).map(s => s.trim()).filter(Boolean)
    parts.slice(0, 3).forEach((nome, i) => liv[i].add(i === 0 ? normalizzaAmbito(nome) : nome))
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, 'it'))
  return { sp: sorted(liv[0]), cat: sorted(liv[1]), sb: sorted(liv[2]) }
}

/** Fonde più database (golden + utente + computo corrente): dedup per livello,
 *  ordine alfabetico italiano. */
export function mergeCategorieDb(...dbs: CategorieDb[]): CategorieDb {
  const out: CategorieDb = { sp: [], cat: [], sb: [] }
  for (const lv of ['sp', 'cat', 'sb'] as const) {
    const seen = new Set<string>()
    for (const db of dbs) for (const nome of db[lv] || []) {
      const n = nome.trim()
      if (n && !seen.has(n)) { seen.add(n); out[lv].push(n) }
    }
    out[lv].sort((a, b) => a.localeCompare(b, 'it'))
  }
  return out
}
