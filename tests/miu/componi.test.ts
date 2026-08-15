import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  FRASARIO, frasarioFor, componiDescrizione, verificaCoerenza, normUm, suggerisciFamiglia,
  type FrasarioFamiglia,
} from '../../src/shared/compositore/componi'
import { FAMIGLIE, type Famiglia } from '../../src/shared/compositore/thesaurus'

/**
 * Compositore di descrizioni per voci di computo metrico.
 * Motore PURO: frasario per le famiglie del thesaurus, componiDescrizione
 * (breve + estesa, regola «se non c'è non si menziona») e verificaCoerenza
 * con la voce di prezzario agganciata.
 *
 * Open E.Hub non distribuisce il catalogo reale (FRASARIO/FAMIGLIE arrivano
 * vuoti dallo stub `compositore-catalog:*`, vedi vite.config.ts): il motore
 * si esercita qui con una famiglia SINTETICA, senza dati proprietari.
 */

const FAMIGLIA_TEST: Famiglia = {
  id: '__test-componente__',
  alias: ['componente di prova'],
  sinonimi: ['componente di prova'],
  accessori: [],
}

const FRASARIO_TEST: FrasarioFamiglia = {
  famigliaId: '__test-componente__',
  nome: 'componente di prova',
  soggettoBreve: 'Componente di prova',
  soggettoEsteso: 'componente di prova',
  umTipiche: ['m', 'cad'],
  misura: { etichetta: 'diametro', valori: ['⌀ 20 mm', '⌀ 32 mm'] },
  materiale: ['acciaio zincato', 'PVC'],
  posa: ['a vista', 'incassata'],
  opzioni: ['con coperchio', 'con setto separatore'],
  normativa: 'UNI EN 12345',
  compresi: ['staffe di fissaggio', 'minuterie di montaggio'],
  macro: ['IMPIANTI ELETTRICI'],
}

beforeAll(() => {
  FAMIGLIE.push(FAMIGLIA_TEST)
  FRASARIO.push(FRASARIO_TEST)
})

afterAll(() => {
  const iF = FAMIGLIE.indexOf(FAMIGLIA_TEST)
  if (iF !== -1) FAMIGLIE.splice(iF, 1)
  const iR = FRASARIO.indexOf(FRASARIO_TEST)
  if (iR !== -1) FRASARIO.splice(iR, 1)
})

describe('frasario', () => {
  it('nessuna famigliaId duplicata; ogni famigliaId è una FK verso il thesaurus', () => {
    const ids = FRASARIO.map(f => f.famigliaId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual(FAMIGLIE.map(f => f.id).sort())
  })

  it('ogni famiglia ha soggetti non vuoti e almeno una U.M. tipica', () => {
    for (const f of FRASARIO) {
      expect(f.soggettoBreve.trim(), f.famigliaId).not.toBe('')
      expect(f.soggettoEsteso.trim(), f.famigliaId).not.toBe('')
      expect(f.umTipiche.length, f.famigliaId).toBeGreaterThan(0)
      expect(f.nome.trim(), f.famigliaId).not.toBe('')
    }
  })

  it('anti-leak: nessun dato identificativo di progetto nel frasario', () => {
    const src = readFileSync(resolve(__dirname, '../../src/shared/compositore/componi.ts'), 'utf8').toLowerCase()
    for (const leak of ['tecnofire', 'palazzina', 'commessa']) expect(src).not.toContain(leak)
  })
})

describe('arricchimento del frasario per le famiglie esistenti', () => {
  it('ogni slot valorizzato ha almeno 2 varianti (niente elenchi demo da una sola voce)', () => {
    for (const f of FRASARIO) {
      if (f.misura) expect(f.misura.valori.length, `${f.famigliaId}.misura`).toBeGreaterThanOrEqual(2)
      if (f.materiale) expect(f.materiale.length, `${f.famigliaId}.materiale`).toBeGreaterThanOrEqual(2)
      if (f.posa) expect(f.posa.length, `${f.famigliaId}.posa`).toBeGreaterThanOrEqual(2)
      if (f.opzioni) expect(f.opzioni.length, `${f.famigliaId}.opzioni`).toBeGreaterThanOrEqual(2)
      if (f.compresi) expect(f.compresi.length, `${f.famigliaId}.compresi`).toBeGreaterThanOrEqual(2)
    }
  })

  it('nessun valore duplicato entro lo stesso slot di una famiglia', () => {
    for (const f of FRASARIO) {
      for (const list of [f.misura?.valori, f.materiale, f.posa, f.opzioni, f.compresi]) {
        if (!list) continue
        expect(new Set(list).size, f.famigliaId).toBe(list.length)
      }
    }
  })
})

describe('componiDescrizione', () => {
  it('genera breve + estesa non vuote per TUTTE le famiglie, con e senza slot', () => {
    for (const f of FRASARIO) {
      // solo famiglia: nessuno slot ⇒ frasi comunque complete
      const nudo = componiDescrizione({ famigliaId: f.famigliaId })
      expect(nudo.breve, f.famigliaId).toBe(f.soggettoBreve)
      expect(nudo.estesa, f.famigliaId).toMatch(/^Fornitura e posa in opera di /)
      expect(nudo.estesa, f.famigliaId).toMatch(/a regola d'arte\.$/)
      // tutti gli slot tipici valorizzati
      const pieno = componiDescrizione({
        famigliaId: f.famigliaId,
        misura: f.misura?.valori[0],
        materiale: f.materiale?.[0],
        posa: f.posa?.[0],
        opzioni: f.opzioni ? [f.opzioni[0]] : undefined,
      })
      if (f.misura) expect(pieno.estesa, f.famigliaId).toContain(`${f.misura.etichetta} ${f.misura.valori[0]}`)
      if (f.materiale) expect(pieno.estesa, f.famigliaId).toContain(`in ${f.materiale[0]}`)
      if (f.posa) expect(pieno.estesa, f.famigliaId).toContain(`posa ${f.posa[0]}`)
      if (f.opzioni) expect(pieno.breve, f.famigliaId).toContain(f.opzioni[0])
    }
  })

  it('compone breve ed estesa con tutti gli slot valorizzati (famiglia sintetica)', () => {
    const d = componiDescrizione({
      famigliaId: '__test-componente__',
      misura: '⌀ 32 mm', materiale: 'acciaio zincato',
      posa: 'a vista', opzioni: ['con coperchio'],
    })
    expect(d.breve).toBe('Componente di prova ⌀ 32 mm in acciaio zincato, con coperchio, posa a vista')
    expect(d.estesa).toBe(
      'Fornitura e posa in opera di componente di prova, in acciaio zincato, diametro ⌀ 32 mm, ' +
      'con coperchio, posa a vista, conforme a UNI EN 12345, ' +
      "compresi staffe di fissaggio, minuterie di montaggio e quanto necessario per dare il lavoro finito a regola d'arte.",
    )
  })

  it('regola «se non c\'è non si menziona»: slot vuoti ⇒ segmenti ASSENTI', () => {
    const d = componiDescrizione({ famigliaId: '__test-componente__', misura: '⌀ 20 mm' })
    // niente materiale/posa/opzioni non impostati
    expect(d.breve).toBe('Componente di prova ⌀ 20 mm')
    expect(d.estesa).not.toContain(' in acciaio')
    expect(d.estesa).not.toContain(', posa ')
    // niente virgole orfane, doppi spazi o «undefined»
    for (const t of [d.breve, d.estesa]) {
      expect(t).not.toMatch(/undefined|null/)
      expect(t).not.toMatch(/,\s*,|\(\)|  /)
      expect(t).not.toMatch(/,\s*\./)
    }
  })

  it('slot con soli spazi o opzioni vuote = non impostati', () => {
    const d = componiDescrizione({ famigliaId: '__test-componente__', misura: '  ', materiale: '', opzioni: ['', '  '] })
    expect(d.breve).toBe('Componente di prova')
    expect(d.estesa).toBe(
      "Fornitura e posa in opera di componente di prova, conforme a UNI EN 12345, " +
      "compresi staffe di fissaggio, minuterie di montaggio e quanto necessario per dare il lavoro finito a regola d'arte.",
    )
  })

  it('opzioni multiple: tutte presenti, in ordine', () => {
    const d = componiDescrizione({ famigliaId: '__test-componente__', opzioni: ['con coperchio', 'con setto separatore'] })
    expect(d.breve).toContain('con coperchio, con setto separatore')
    expect(d.estesa.indexOf('con coperchio')).toBeLessThan(d.estesa.indexOf('con setto separatore'))
  })

  it('famiglia sconosciuta ⇒ errore esplicito; frasarioFor ⇒ undefined', () => {
    expect(() => componiDescrizione({ famigliaId: 'famiglia-inventata' })).toThrow(/sconosciuta/)
    expect(frasarioFor('famiglia-inventata')).toBeUndefined()
    expect(frasarioFor('__test-componente__')?.nome).toBe('componente di prova')
  })

  it('la chiusura senza "compresi" ripiega sulla dicitura generica', () => {
    const senzaCompresi: FrasarioFamiglia = { ...FRASARIO_TEST, famigliaId: '__test-senza-compresi__', compresi: undefined }
    FRASARIO.push(senzaCompresi)
    try {
      const d = componiDescrizione({ famigliaId: '__test-senza-compresi__' })
      expect(d.estesa).toContain("inclusi accessori di fissaggio e quota parte di sfridi, in opera a regola d'arte")
    } finally {
      FRASARIO.splice(FRASARIO.indexOf(senzaCompresi), 1)
    }
  })

  it('ogni famiglia ha almeno un macrotema valido, per il picker a scomparsa', () => {
    const VALID = ['IMPIANTI ELETTRICI', 'ILLUMINAZIONE', 'IMPIANTI SPECIALI', 'IMPIANTI MECCANICI', 'IMPIANTI ANTINCENDIO', 'OPERE EDILI']
    for (const f of FRASARIO) {
      expect(f.macro.length, f.famigliaId).toBeGreaterThan(0)
      for (const m of f.macro) expect(VALID, f.famigliaId).toContain(m)
    }
  })
})

describe('verificaCoerenza', () => {
  const input = { famigliaId: '__test-componente__', misura: '⌀ 32 mm', materiale: 'PVC' }

  it('nessuna voce agganciata ⇒ ok, nessun avviso', () => {
    expect(verificaCoerenza(input)).toEqual({ ok: true, avvisi: [] })
    expect(verificaCoerenza(input, null)).toEqual({ ok: true, avvisi: [] })
  })

  it('U.M. compatibile e misura coerente ⇒ ok', () => {
    const esito = verificaCoerenza({ ...input, misura: '⌀ 20 mm' },
      { codice: 'X.01', um: 'm', desc: 'Componente di prova in PVC ⌀ 20 mm, posato a vista' })
    expect(esito.ok).toBe(true)
    expect(esito.avvisi).toEqual([])
  })

  it('U.M. estranea alla famiglia ⇒ avviso motivato (mai bloccante)', () => {
    const esito = verificaCoerenza(input, { um: 'kg', desc: '' })
    expect(esito.ok).toBe(false)
    expect(esito.avvisi.join(' ')).toMatch(/U\.M\..*kg.*componente di prova/i)
  })

  it('U.M. equivalenti normalizzate: ml=m, cadauno=cad, mq=m²', () => {
    expect(normUm('ml')).toBe('m')
    expect(normUm('Cadauno')).toBe('cad')
    expect(normUm('mq')).toBe('m²')
    expect(verificaCoerenza(input, { um: 'ml' }).ok).toBe(true)
    expect(verificaCoerenza({ famigliaId: '__test-componente__' }, { um: 'Cadauno' }).ok).toBe(true)
  })

  it('misura in contraddizione: ⌀ 20 nella voce vs ⌀ 32 composto ⇒ avviso', () => {
    const esito = verificaCoerenza(input,
      { um: 'm', desc: 'Componente di prova in PVC, ⌀ 20 mm, posato a vista' })
    expect(esito.ok).toBe(false)
    expect(esito.avvisi.join(' ')).toContain('20')
    expect(esito.avvisi.join(' ')).toContain('32')
  })

  it('dimensioni n×m in contraddizione ⇒ avviso; coincidenti ⇒ ok', () => {
    const pass = { famigliaId: '__test-componente__', misura: '200×60 mm' }
    const ko = verificaCoerenza(pass, { um: 'm', desc: 'Componente asolato 300×60 mm' })
    expect(ko.ok).toBe(false)
    expect(ko.avvisi.join(' ')).toContain('300x60')
    const okE = verificaCoerenza(pass, { um: 'm', desc: 'Componente asolato 200×60 mm' })
    expect(okE.ok).toBe(true)
  })

  it('voce senza misure nella descrizione ⇒ nessun falso allarme', () => {
    const esito = verificaCoerenza(input, { um: 'm', desc: 'Componente di prova in PVC' })
    expect(esito.ok).toBe(true)
  })
})

describe('suggerisciFamiglia (pre-aggancio dal dettaglio)', () => {
  it('propone la famiglia dai sinonimi del thesaurus nella descrizione voce', () => {
    expect(suggerisciFamiglia('Fornitura di componente di prova varie misure')).toBe('__test-componente__')
  })
  it('descrizione fuori thesaurus ⇒ null', () => {
    expect(suggerisciFamiglia('Sedia impilabile in legno di faggio')).toBeNull()
    expect(suggerisciFamiglia('')).toBeNull()
  })
})
