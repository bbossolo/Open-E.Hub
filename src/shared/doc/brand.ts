/**
 * Brand Open E.Hub — UNICA fonte del marchio nei documenti (logo ε col punto rosso +
 * wordmark "Open E.Hub"). Usato sia dai documenti A4 (via DOC_CSS) sia dalle tavole CAD
 * (print HTML autonomo): un solo markup + un solo CSS, niente copie sparse.
 * Self-contained (classe `.ehub-brand`), neutro: NON è tinto dall'accento del tool.
 *
 * L'ε NON è più un carattere serif ma il TRACCIATO GOLDEN (vettoriale,
 * da `../ui/brand-mark`) → identico a welcome/header anche in stampa PDF, dove un
 * `<text>ε</text>` di font non renderebbe mai uguale. È un LOGO, non un font.
 */
import { ehubMarkSvg } from '../ui/brand-mark'

export const EHUB_BRAND_CSS = `
  .ehub-brand { display:inline-flex; align-items:center; gap:1.4mm; color:#15171c; }
  .ehub-brand .ehb-mark-svg { height:4.4mm; width:auto; }
  .ehub-brand .ehb-mark-svg path { fill:#15171c; }
  .ehub-brand .ehb-mark-svg circle { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .ehub-brand small { font:600 2.1mm/1 var(--mono,ui-monospace,monospace); letter-spacing:.12em; text-transform:uppercase; color:#7c8593; }
`

/** Lockup del brand Open E.Hub (marchio ε golden + wordmark). */
export function ehubBrand(): string {
  return `<span class="ehub-brand">${ehubMarkSvg()}<small>Open E.Hub</small></span>`
}
