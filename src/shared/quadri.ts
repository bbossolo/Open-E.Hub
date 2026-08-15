/**
 * Logica «Quadri» — i QUADRI (switchboard) come elemento distinto dalle
 * linee. Funzioni pure, senza DOM, testabili.
 *
 * In Ampère il quadro NON è una riga dell'export «Utenze del progetto»: le righe
 * sono le LINEE (partenze con la loro protezione — es. Q.MT.0 = magnetotermico,
 * Q.SF.0 = sezionatore fusibile). I quadri sono i contenitori, referenziati dalle
 * linee tramite i campi «Quadro» (`<$0003>`) e «Quadro monte» (`<$0706>`). Qui li
 * deriviamo da quei campi e ne ricostruiamo l'albero (padre = «Quadro monte»).
 *
 * Un quadro è «posizionato» quando esiste un nodo C&C di tipo quadro (QE/QF) che lo
 * rappresenta per nome (`quadroName`, con fallback `label` per i progetti pregressi).
 */

export interface QuadroLine { quadro?: string; quadroMonte?: string }
export interface QuadroNodeRef { id?: string; type?: string; quadroName?: string | null; label?: string }

export interface Switchboard {
  name: string
  /** quadro a monte (padre nell'albero), '' se radice. */
  parent: string
  placed: boolean
  nodeId: string | null
}

/** Tipo di nodo C&C che rappresenta un quadro (QF resta una scelta manuale). */
export function nodeTypeForQuadro(): 'QE' | 'QF' {
  return 'QE'
}

/** Nome-quadro effettivo di un nodo (nuovo `quadroName`, fallback `label`). */
function nodeQuadroName(n: QuadroNodeRef): string {
  return (n.quadroName || n.label || '').trim()
}

/**
 * Estrae i quadri (switchboard) dalle linee: i valori distinti di «Quadro» e
 * «Quadro monte», con padre = «Quadro monte» condiviso dalle linee del quadro
 * (il più frequente, robusto ai quadri a più ingressi). Ordinati con le radici
 * prima, poi per nome, così l'albero si legge dall'alto.
 */
export function switchboardsFromLines(lines: QuadroLine[]): { name: string; parent: string }[] {
  const names = new Set<string>()
  const parentVotes = new Map<string, Map<string, number>>()
  for (const l of lines || []) {
    const q = (l.quadro || '').trim()
    const qm = (l.quadroMonte || '').trim()
    if (q) {
      names.add(q)
      if (qm) {
        const m = parentVotes.get(q) || new Map<string, number>()
        m.set(qm, (m.get(qm) || 0) + 1)
        parentVotes.set(q, m)
      }
    }
    if (qm) names.add(qm) // il quadro a monte (es. la barra) è anch'esso un quadro
  }
  const out: { name: string; parent: string }[] = []
  for (const name of names) {
    let parent = ''
    const votes = parentVotes.get(name)
    if (votes) {
      let best = -1
      for (const [p, c] of votes) if (c > best && p !== name) { best = c; parent = p }
    }
    out.push({ name, parent })
  }
  out.sort((a, b) => (a.parent === '' ? 0 : 1) - (b.parent === '' ? 0 : 1) || a.name.localeCompare(b.name))
  return out
}

/**
 * Stato dei quadri del progetto: per ogni switchboard indica se ha già un nodo
 * QE/QF che lo rappresenta (`placed`) e quale (`nodeId`).
 */
export function quadriStatus(lines: QuadroLine[], nodes: QuadroNodeRef[]): Switchboard[] {
  const nodeByName = new Map<string, QuadroNodeRef>()
  for (const n of nodes || []) {
    if (n.type !== 'QE' && n.type !== 'QF') continue
    const key = nodeQuadroName(n)
    if (key) nodeByName.set(key, n)
  }
  return switchboardsFromLines(lines).map((s) => {
    const n = nodeByName.get(s.name)
    return { name: s.name, parent: s.parent, placed: !!n, nodeId: n?.id ?? null }
  })
}

/** Conteggio dei quadri ancora da posizionare. */
export function quadriDaPosizionare(status: Switchboard[]): number {
  return status.filter((q) => !q.placed).length
}
