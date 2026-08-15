/**
 * Guida unica condivisa Open E.Hub — modello di contenuto.
 *
 * Tutti i tool registrano i propri contenuti in un unico registro (registry.ts)
 * così la guida non è più frammentata: un solo manuale organizzato per SEZIONI
 * (una per tool/area), ciascuna con i propri CAPITOLI. Il visore F1
 * (components/guide.ts) mostra l'intero registro con indice a lato.
 */

/** Un capitolo: titolo + corpo HTML (inline consentito: <b>, <i>, <ul>, <details>…). */
export interface GuideChapter {
  id: string
  title: string
  bodyHtml: string
}

/** Una sezione della guida = un'area/tool. Raggruppa i capitoli. */
export interface GuideSection {
  /** Identificatore stabile, tipicamente il nome del tool (es. 'beta'). */
  id: string
  title: string
  /** Tool di appartenenza (per focus/ordinamento); default = id. */
  tool?: string
  /** Ordine crescente nell'indice (default 100). */
  order?: number
  chapters: GuideChapter[]
  /** Data dell'ultima revisione della sezione, ISO `AAAA-MM-GG`. Il visore ne
   *  mostra la massima come «data della guida» e una piccola data per sezione,
   *  così si vede a colpo d'occhio cosa è aggiornato e cosa è da rivedere. */
  updatedAt?: string
  /** Nota a piè di sezione (es. disclaimer). HTML inline consentito. */
  footNote?: string
  /** Se presente, il visore mostra un pulsante «Rivedi il tour» che la chiama.
   *  I tool la impostano localmente (registerGuide({ ...SEZIONE, onTour })); l'hub
   *  aggrega le sezioni senza onTour, così il manuale completo resta pulito. */
  onTour?: () => void
}
