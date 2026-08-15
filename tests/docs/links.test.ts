import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { ROOT, allDocs, linkedPaths } from './_links'

/**
 * Nessun documento può linkare un file che non esiste.
 *
 * Generalizza a TUTTI i .md la guardia che esisteva solo per Docs/14: era proprio
 * spostando dei doc in Docs/archivio/ che si sarebbero rotti in silenzio i link
 * entranti dagli altri documenti. Un link rotto è la forma più concreta di
 * documentazione che mente, ed è anche la più facile da verificare.
 */
describe('link fra documenti (nessun riferimento rotto)', () => {
  const docs = allDocs()

  it('ci sono documenti da controllare', () => {
    expect(docs.length).toBeGreaterThan(5)
  })

  for (const rel of docs) {
    it(`${rel} — ogni link punta a un file esistente`, () => {
      const from = dirname(resolve(ROOT, rel))
      const missing = linkedPaths(readFileSync(resolve(ROOT, rel), 'utf8'))
        .filter((dest) => !existsSync(resolve(from, dest)))
      expect(missing, `link rotti in ${rel}: ${missing.join(', ')}`).toEqual([])
    })
  }
})
