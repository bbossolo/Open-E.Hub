/** Utilità condivise dai parser XML di build (fast-xml-parser). */
import { XMLParser, type X2jOptions } from 'fast-xml-parser'

/** Normalizza in array un nodo che fast-xml-parser restituisce singolo o multiplo. */
export function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

/** parseFloat tollerante (gestisce la virgola decimale), 0 di fallback. */
export function num(v: unknown): number {
  if (typeof v === 'number') return v
  return parseFloat(String(v ?? '').replace(',', '.')) || 0
}

/**
 * Decodifica le entità che fast-xml-parser lascia intatte: numeriche
 * (`&#224;`, `&#x2019;`) e quelle doppiamente escapate dai gestionali
 * regionali (`&amp;quot;` → un solo passaggio del parser dà `&quot;`, non
 * ancora l'apice vero). Doppio pass per risolvere anche il doppio escaping,
 * ma `&amp;amp;` decodifica correttamente a `&` (non oltre) perché il primo
 * pass consuma già l'`&amp;` esterno.
 */
export function decodeEntities(s: string): string {
  if (typeof s !== 'string' || s.indexOf('&') === -1) return s
  const decode = (str: string): string =>
    str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  let out = decode(s)
  if (out.indexOf('&') !== -1) out = decode(out)
  return out
}

/** Crea un parser con attributi abilitati (prefisso `@_`) e le opzioni date. */
export function makeParser(opts: Partial<X2jOptions> = {}): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    attributeValueProcessor: (_name, val) => decodeEntities(val),
    tagValueProcessor: (_name, val) => decodeEntities(val),
    ...opts,
  })
}
