/**
 * Formattatori numerici/valuta CONDIVISI (italiano). Prima duplicati dentro i
 * motori dei singoli tool (es. computo, contabilità): accentrati qui perché
 * β è fittamente monetario e non serviva una terza copia. Modulo PURO (no DOM),
 * deterministico via `Intl` sul locale 'it-IT'.
 */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Numero con 2 decimali all'italiana ("1.234,50"); null/NaN → stringa vuota. */
export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Importo in euro ("€ 1.234,50"); null → em dash. */
export function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return '€ ' + num(n)
}

/** Percentuale all'italiana; `decimals` cifre decimali (default 2). null → em dash. */
export function pct(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%'
}

/** Percentuale con segno esplicito (+/−) — utile per scarti/variazioni. */
export function pctSigned(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return (n > 0 ? '+' : '') + pct(n, decimals)
}

export { round2 }
