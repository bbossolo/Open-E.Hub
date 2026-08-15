import { describe, it, expect } from 'vitest'
import { gzipBase64, gunzipBase64, zipDisponibile } from '../../src/shared/zip'

/**
 * gzip↔base64 nativo (shared/zip): è il formato dei campi pesanti del .ehub
 * (scena DXF compressa). Il round-trip DEVE essere byte-fedele — un
 * progetto salvato che non si riapre identico è una perdita di dati.
 */
describe.skipIf(!zipDisponibile())('shared/zip · gzip base64', () => {
  it('round-trip fedele, anche con accenti e simboli', async () => {
    const testo = 'M0.00,0.00 L10.00,-5.00 · cavidotto Ø32 — «è» \n' + 'x'.repeat(10000)
    expect(await gunzipBase64(await gzipBase64(testo))).toBe(testo)
  })

  it('comprime davvero il JSON ripetitivo dei path (nonostante il +33% del base64)', async () => {
    const d = Array.from({ length: 5000 }, (_, i) => `M${i}.00,${i}.00 L${i + 1}.00,${i}.00`).join(' ')
    const json = JSON.stringify({ layersD: { MURI: d } })
    const z = await gzipBase64(json)
    expect(z.length * 2).toBeLessThan(json.length)
  })

  it('un blob corrotto rifiuta invece di restituire spazzatura', async () => {
    await expect(gunzipBase64(btoa('non-gzip'))).rejects.toThrow()
  })
})
