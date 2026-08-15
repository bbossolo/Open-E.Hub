/**
 * MARCHIO Open E.Hub (ε) come GOLDEN STANDARD, unica fonte.
 *
 * L'ε NON è un font: è un LOGO vettoriale **tracciato dall'immagine dell'utente**.
 * Qui vive il suo path canonico + il punto rosso identitario, così da
 * essere SEMPRE FEDELE IN OGNI ISTANZA — welcome, header, e OUTPUT (PDF/CAD),
 * dove il `<text>ε</text>` di un font non renderebbe mai uguale.
 *
 * `src/hub/index.html` tiene lo stesso path inline (per evitare il flash a caricamento):
 * un test di guardia (tests/shared/brand-mark) verifica che NON divergano da qui.
 */

export const EHUB_MARK_VIEWBOX = '-18 -18 986.5 744'

/** Tracciato golden dell'ε (fill:currentColor). */
export const EHUB_MARK_PATH =
  'M348.3 707.5 L280.3 708.0 L244.3 705.8 L226.3 697.7 L186.3 694.8 L173.3 685.9 L148.3 682.2 L140.3 674.4 L123.4 670.5 L115.3 662.1 L99.3 657.0 L94.3 650.3 L85.3 645.5 L68.0 627.5 L60.2 622.5 L44.9 603.5 L38.2 598.5 L33.4 589.5 L26.1 583.5 L21.4 567.5 L13.8 559.5 L9.5 534.5 L1.8 521.5 L0.0 486.5 L2.3 454.5 L10.2 440.5 L14.5 418.5 L22.2 407.5 L25.5 398.5 L33.5 391.5 L39.3 376.8 L63.3 351.0 L77.4 344.5 L92.3 332.8 L93.7 329.5 L82.5 314.5 L74.3 309.7 L69.3 302.3 L62.3 298.0 L57.5 290.5 L50.3 285.4 L46.0 277.5 L39.3 272.3 L33.5 255.5 L25.4 246.5 L22.0 211.5 L21.8 181.5 L25.6 142.5 L34.3 130.5 L40.3 113.1 L50.8 99.5 L58.3 93.7 L62.3 86.5 L69.3 81.7 L86.3 63.2 L94.9 58.5 L101.3 50.9 L115.7 45.5 L123.3 37.3 L138.3 34.2 L147.3 26.0 L166.3 22.7 L182.3 13.2 L221.3 10.3 L232.3 3.0 L242.3 1.3 L340.3 1.2 L355.3 9.8 L393.3 13.3 L407.3 22.2 L428.3 25.8 L436.3 33.2 L452.3 37.0 L460.3 44.8 L467.3 46.1 L475.8 43.5 L482.3 28.5 L490.5 22.5 L495.3 15.3 L512.3 9.7 L520.3 2.0 L539.3 0.0 L561.3 1.8 L570.3 8.6 L586.3 14.3 L598.8 26.5 L609.9 43.5 L612.8 80.5 L612.8 193.5 L611.1 217.5 L608.8 224.5 L585.3 249.1 L568.3 254.2 L560.3 261.8 L538.3 264.0 L520.3 261.6 L512.3 254.0 L495.3 249.0 L452.3 207.0 L437.3 201.0 L430.3 193.6 L421.3 189.5 L415.3 182.3 L398.3 178.8 L383.3 169.2 L362.3 166.2 L349.3 157.8 L325.3 156.0 L224.3 157.3 L219.3 159.1 L212.3 165.9 L194.3 169.7 L187.3 177.5 L173.3 183.7 L169.1 191.5 L167.9 210.5 L170.3 223.7 L177.8 229.5 L183.3 237.5 L199.3 242.1 L208.8 250.5 L239.3 253.8 L254.3 262.2 L268.3 263.8 L412.3 264.2 L419.2 267.5 L420.9 275.5 L420.8 409.5 L418.3 417.5 L409.3 420.0 L260.3 421.1 L255.0 422.5 L245.3 429.8 L208.3 434.1 L200.3 441.9 L182.3 446.1 L176.3 453.1 L168.6 457.5 L157.0 469.5 L149.2 484.5 L158.2 511.5 L167.0 517.5 L172.3 524.3 L188.3 530.1 L196.3 537.9 L222.3 542.0 L235.3 550.7 L365.3 552.0 L390.3 550.4 L404.3 541.9 L450.3 538.6 L461.3 530.3 L496.3 526.1 L510.3 517.3 L547.3 516.6 L558.3 518.4 L567.3 526.2 L583.6 530.5 L589.6 538.5 L596.9 543.5 L609.6 560.5 L612.8 585.5 L610.0 618.5 L584.3 645.2 L569.3 650.9 L561.3 658.7 L545.3 662.8 L535.3 671.2 L518.3 673.9 L508.3 681.9 L472.3 686.0 L461.3 694.4 L399.3 698.2 L390.3 700.3 L379.3 706.6 L348.3 707.5 Z'

/** Punto rosso identitario del marchio. */
export const EHUB_MARK_DOT = { cx: 841.5, cy: 576.6, r: 109, fill: '#e5484d' }

/** SVG inline del marchio ε (path a currentColor + punto rosso). */
export function ehubMarkSvg(cls = ''): string {
  const cl = cls ? ` ${cls}` : ''
  const d = EHUB_MARK_DOT
  return `<svg class="ehb-mark-svg${cl}" viewBox="${EHUB_MARK_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${EHUB_MARK_PATH}" fill="currentColor"/><circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.fill}"/></svg>`
}
