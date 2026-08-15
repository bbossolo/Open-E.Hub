/**
 * gzip ↔ base64 con le API native del browser (CompressionStream): zero
 * dipendenze, in linea col build single-file della suite.
 *
 * Nato per il Progetto Open E.Hub: i path `d` di una planimetria DXF sono
 * decine di MB di JSON in chiaro — compressi 10-20×. Le funzioni sono ASYNC:
 * chi ha contratti sincroni comprime in anticipo e tiene il risultato pronto.
 */

export function zipDisponibile(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

export async function gzipBase64(testo: string): Promise<string> {
  const flusso = new Blob([testo]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(flusso).arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  const PEZZO = 0x8000 // String.fromCharCode ha un tetto di argomenti
  for (let i = 0; i < bytes.length; i += PEZZO) bin += String.fromCharCode(...bytes.subarray(i, i + PEZZO))
  return btoa(bin)
}

export async function gunzipBase64(b64: string): Promise<string> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const flusso = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(flusso).text()
}
