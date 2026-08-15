import { describe, it, expect, vi, beforeEach } from 'vitest'
import { famigliaDaLayer, risolviFamiglia, chiaveDizionario } from '../../src/shared/blocchi/da-layer'
import { disciplinaDiLayer } from '../../src/shared/blocchi/capitoli'

/**
 * Il motore di riconoscimento guidato dal LAYER.
 *
 * La regola che governa tutto, imparata sui progetti veri: **il nome del blocco non è
 * un'informazione affidabile, il layer sì.** I casi qui sotto NON sono inventati — sono
 * presi tali e quali da due tavole reali:
 *
 * - Tavola dello studio: blocchi con nomi parlanti (`PL_SOFFITTO`) MA anche blocchi dei
 *   costruttori (`ZS55_SCHUKO`, `FRAME_2MOD`, `Z35`) che nessun catalogo può conoscere.
 *   Riconoscimento per solo nome: 39%. Col layer: 100%.
 * - Tavola di un ALTRO studio, altra convenzione: blocchi chiamati `CY17`, `CG8`,
 *   `FA12`, `QUAD14` — codici interni, zero significato. Riconoscimento per solo nome: 0%
 *   su 944 blocchi. Col layer: 100%. È il banco di prova più severo che abbiamo.
 */

describe('famigliaDaLayer · il layer porta il significato che il nome non ha', () => {
  it('legge i layer dello studio (prefisso ELE-)', () => {
    expect(famigliaDaLayer('ELE-ILLUMINAZIONE_NORMALE')).toMatchObject({ famigliaId: 'punto-luce' })
    expect(famigliaDaLayer('ELE-ILLUMINAZIONE_EMERGENZA')).toMatchObject({ famigliaId: 'lampada-emergenza' })
    expect(famigliaDaLayer('ELE-RILEVAZIONE_FUMO')).toMatchObject({ famigliaId: 'rivelatore-incendio' })
    expect(famigliaDaLayer('ELE-QUADRI_ELETTRICI')).toMatchObject({ famigliaId: 'centralino' })
    expect(famigliaDaLayer('ELE-IMPIANTO_TERRA')).toMatchObject({ famigliaId: 'impianto-di-terra' })
  })

  it('legge i layer di un ALTRO studio (prefisso IE-), senza sapere niente di lui', () => {
    expect(famigliaDaLayer('IE-ILLUMINAZIONE')).toMatchObject({ famigliaId: 'punto-luce' })
    expect(famigliaDaLayer('IE-FM')).toMatchObject({ famigliaId: 'punto-presa' })
    expect(famigliaDaLayer('IE-PLACCHE')).toMatchObject({ famigliaId: 'punto-presa' })
    expect(famigliaDaLayer('IE-ALLARME')).toMatchObject({ famigliaId: 'avvisatore-ottico-acustico' })
    expect(famigliaDaLayer('IE-DISTRIBUZIONE')).toMatchObject({ famigliaId: 'allaccio-utenza-elettrica' })
  })

  it('l\'underscore è un separatore, non una lettera', () => {
    // `\bFM\b` NON matcha `FM_NORMALE` (per una regex l'underscore è un carattere di
    // parola) — ed `ELE-FM_NORMALE` è il layer di forza motrice più popolato della tavola:
    // sbagliarlo significava perdere 191 blocchi su 336.
    expect(famigliaDaLayer('ELE-FM_NORMALE')).toMatchObject({ famigliaId: 'punto-presa' })
    expect(famigliaDaLayer('ELE-FM-ZENNIO')).toMatchObject({ famigliaId: 'punto-presa' })
    expect(famigliaDaLayer('ELE-DIFF_SONORA')).toMatchObject({ famigliaId: 'allaccio-segnale' })
  })

  it('l\'emergenza vince sull\'illuminazione (le regole più specifiche vanno prima)', () => {
    expect(famigliaDaLayer('ELE-ILLUMINAZIONE_EMERGENZA')!.famigliaId).toBe('lampada-emergenza')
    expect(famigliaDaLayer('ELE-ILLUMINAZIONE_NORMALE')!.famigliaId).toBe('punto-luce')
  })

  it('un layer che non è d\'impianto non inventa nulla', () => {
    expect(famigliaDaLayer('MURI')).toBeNull()
    expect(famigliaDaLayer('cartiglio')).toBeNull()
  })

  it('ELE-VENTILCONVETTORI: riconosciuto dalla regola curata (FANCOIL|VENTILCONV|CLIMA|CONDIZ)', () => {
    expect(famigliaDaLayer('ELE-VENTILCONVETTORI')).toMatchObject({ famigliaId: 'ventilconvettore' })
  })
})

/**
 * IL PUNTO: il motore si alimenta ANCHE dal thesaurus, non solo dalle regole curate sopra.
 * Domanda dell'utente: «ogni volta che espanderemo il thesaurus alimenterà anche questo?».
 * Sì — il capitolo del layer viene confrontato direttamente con gli alias/sinonimi delle
 * famiglie del compositore (`famigliaDalThesaurus`, in da-layer.ts): una famiglia SENZA
 * regola curata viene comunque riconosciuta se esiste nel thesaurus. Open E.Hub non porta
 * dati di catalogo reali (thesaurus vuoto, vedi catalog-data-empty.ts) → qui il thesaurus
 * si mocka con fixture inline per testare il MOTORE, non un vocabolario proprietario.
 */
describe('famigliaDaLayer · il motore si alimenta ANCHE dal thesaurus (fixture inline)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('un layer senza regola curata, ma il cui capitolo combacia con un alias/sinonimo del thesaurus, viene riconosciuto', async () => {
    vi.doMock('../../src/shared/compositore/thesaurus', () => ({
      FAMIGLIE: [
        { id: 'pompa-di-calore', alias: ['pompa di calore'], sinonimi: ['pompa calore'], accessori: [] },
        { id: 'naspo', alias: ['naspi'], sinonimi: ['idrante a naspo'], accessori: [] },
        { id: 'estintore', alias: ['estintori'], sinonimi: [], accessori: [] },
      ],
    }))
    const { famigliaDaLayer: famigliaDaLayerMocked } = await import('../../src/shared/blocchi/da-layer')
    expect(famigliaDaLayerMocked('MEC-POMPA_DI_CALORE')).toMatchObject({ famigliaId: 'pompa-di-calore' })
    expect(famigliaDaLayerMocked('ANT-NASPI')?.famigliaId).toBe('naspo')
    expect(famigliaDaLayerMocked('ANT-ESTINTORI')?.famigliaId).toBe('estintore')
    // → aggiungere domani una famiglia nuova al thesaurus la rende riconoscibile da un
    //   layer omonimo SENZA toccare il motore.
    vi.doUnmock('../../src/shared/compositore/thesaurus')
  })
})

describe('risolviFamiglia · l\'ordine delle fonti, dalla più certa alla più debole', () => {
  it('il DIZIONARIO dello studio vince su tutto: è una decisione già presa', () => {
    // Caso vero: `ZS55_RJ45` sta sul layer `ELE-FM_NORMALE`, che direbbe «presa».
    // Ma è una presa DATI. È esattamente qui che il dizionario si guadagna il pane:
    // l'utente lo dice una volta, e da lì in poi vale su tutti i progetti.
    const diz = { [chiaveDizionario('ZS55_RJ45', 'ELE-FM_NORMALE')]: 'presa-dati-rj45' }
    const e = risolviFamiglia('ZS55_RJ45', 'ELE-FM_NORMALE', { dizionario: diz })
    expect(e).toMatchObject({ famigliaId: 'presa-dati-rj45', fonte: 'dizionario' })
  })

  it('poi il NOME, se il blocco ha un nome parlante (catalogo dello studio)', () => {
    const e = risolviFamiglia('PL_SOFFITTO', 'ELE-ILLUMINAZIONE_NORMALE', { daNome: 'punto-luce' })
    expect(e).toMatchObject({ famigliaId: 'punto-luce', fonte: 'nome' })
  })

  it('infine il LAYER — ed è ciò che salva i progetti dove i blocchi si chiamano CY17', () => {
    const e = risolviFamiglia('CY17', 'IE-PLACCHE')
    expect(e).toMatchObject({ famigliaId: 'punto-presa', fonte: 'layer' })
    expect(risolviFamiglia('CG8', 'IE-ILLUMINAZIONE')).toMatchObject({ famigliaId: 'punto-luce', fonte: 'layer' })
    expect(risolviFamiglia('QUAD14', 'IE-ILLUMINAZIONE')).toMatchObject({ famigliaId: 'punto-luce', fonte: 'layer' })
  })

  it('se nemmeno il layer aiuta, lo DICE — non tira a indovinare', () => {
    const e = risolviFamiglia('TUY', 'fine 0.5')
    expect(e).toMatchObject({ famigliaId: null, fonte: 'ignoto' })
  })

  it('la chiave del dizionario è NOME + LAYER, non il solo nome', () => {
    // lo stesso blocco su due layer diversi può essere due cose diverse: `CB4` sta sia su
    // `IE-FM` (presa) sia su `IE-SP-TP-TD-FONO` (segnale). Il nome da solo non basta.
    expect(chiaveDizionario('CB4', 'IE-FM')).not.toBe(chiaveDizionario('CB4', 'IE-SP-TP-TD-FONO'))
    const diz = {
      [chiaveDizionario('CB4', 'IE-FM')]: 'punto-presa',
      [chiaveDizionario('CB4', 'IE-SP-TP-TD-FONO')]: 'allaccio-segnale',
    }
    expect(risolviFamiglia('CB4', 'IE-FM', { dizionario: diz }).famigliaId).toBe('punto-presa')
    expect(risolviFamiglia('CB4', 'IE-SP-TP-TD-FONO', { dizionario: diz }).famigliaId).toBe('allaccio-segnale')
  })
})

describe('disciplinaDiLayer · i domini sono SINONIMI, non un prefisso solo', () => {
  it('ogni studio (e ogni epoca) abbrevia a modo suo — sbagliarne uno costa il disegno intero', () => {
    // Detto dall'utente, che è del settore: ele/ie/el = elettrico · mc/mecc/im = meccanico
    // · is = idrico-sanitario · ve = ventilazione. Col riconoscimento guidato dal layer,
    // non riconoscere un dominio significa non riconoscere NIENTE di quella tavola.
    for (const d of ['ELE', 'IE', 'EL']) {
      expect(disciplinaDiLayer(`${d}-ILLUMINAZIONE`)).toBe('Impianti elettrici')
    }
    for (const d of ['MC', 'MECC', 'IM', 'MEC']) {
      expect(disciplinaDiLayer(`${d}-CANALI`)).toBe('Impianti meccanici')
    }
    expect(disciplinaDiLayer('IS-SCARICHI')).toBe('Impianti idrico-sanitari')
    expect(disciplinaDiLayer('VE-ESTRAZIONE')).toBe('Impianti di ventilazione')
  })

  it('un dominio sconosciuto resta sé stesso, e un layer senza dominio non ha disciplina', () => {
    expect(disciplinaDiLayer('HVAC-UTA')).toBe('HVAC') // meglio dire «HVAC» che niente
    expect(disciplinaDiLayer('MURI')).toBe('')
  })
})
