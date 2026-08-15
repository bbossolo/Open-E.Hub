/**
 * Estrazione della versione dal filename / URL del tool. Condivisa tra hub e
 * tool (prima era duplicata: hub engine + un parseVersionFromURL inline per tool).
 *   phi_v6_12.html           → "6.12"
 *   PriceList_v2_4.html      → "2.4"
 *   LightCalc_Road_v0_4.html → "0.4"
 */

/** Versione da un filename; null se non c'è un segmento `vN…`. */
export function parseVersionFromFilename(filename: string): string | null {
  const base = filename.replace(/\.html$/i, '')
  const parts = base.split('_')
  const vIdx = parts.findIndex((p) => /^v\d/.test(p))
  if (vIdx === -1) return null
  return parts.slice(vIdx).join('.').replace(/^v/, '')
}

/**
 * Versione dal filename corrente (window.location). Restituisce null se aperto
 * via srcdoc / senza filename versionato (l'hub mostra la versione nella propria
 * barra).
 */
export function parseVersionFromURL(): string | null {
  try {
    const filename = window.location.href.split('/').pop()!.split('?')[0]
    return parseVersionFromFilename(filename)
  } catch {
    return null
  }
}
