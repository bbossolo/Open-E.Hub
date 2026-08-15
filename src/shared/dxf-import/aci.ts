/**
 * Colori ACI (AutoCAD Color Index) → hex.
 *
 * I 9 colori base e i grigi 250-255 sono la tavola canonica; la fascia 10-249
 * è ricostruita col criterio con cui AutoCAD la organizza (24 tinte a passi di
 * 15°, 5 livelli di luminosità, saturazione piena/dimezzata alternata): è
 * un'APPROSSIMAZIONE fedele all'occhio, non la tavola byte-per-byte — per
 * colorare i layer di una planimetria è ciò che serve.
 */

const BASE: Record<number, string> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff',
  6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0',
}

const GRIGI: Record<number, string> = {
  250: '#333333', 251: '#505050', 252: '#696969', 253: '#828282', 254: '#bebebe', 255: '#ffffff',
}

const hex2 = (v: number): string => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')

function hsvHex(hDeg: number, s: number, v: number): string {
  const c = v * s
  const hp = ((hDeg % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) { r = c; g = x } else if (hp < 2) { r = x; g = c } else if (hp < 3) { g = c; b = x }
  else if (hp < 4) { g = x; b = c } else if (hp < 5) { r = x; b = c } else { r = c; b = x }
  const m = v - c
  return `#${hex2((r + m) * 255)}${hex2((g + m) * 255)}${hex2((b + m) * 255)}`
}

/** Colore ACI (1-255) → '#rrggbb'. Fuori intervallo → grigio neutro. */
export function aciToHex(aci: number): string {
  if (BASE[aci]) return BASE[aci]
  if (GRIGI[aci]) return GRIGI[aci]
  if (aci >= 10 && aci <= 249) {
    const idx = aci - 10
    const hue = Math.floor(idx / 10) * 15
    const r = idx % 10
    const v = [1, 0.8, 0.6, 0.48, 0.3][r >> 1]
    const s = (r & 1) ? 0.55 : 1
    return hsvHex(hue, s, v)
  }
  return '#888888'
}
