import { describe, it, expect } from 'vitest'
import {
  emptyHubProjectState,
  migrateHubState,
  setToolProject,
  projectStateMessages,
  sourceForApp,
  ensureProjectId,
  setProjectIdentity,
  emptySharedPlan,
  normalizeSharedPlan,
  normalizeSharedDxf,
  dxfForDisk,
  setSharedDxf,
  upsertShared,
  sharedPlanMessage,
} from '../../src/hub/engine/project-state'

/**
 * PROGETTO E.HUB A ISTANZA UNICA: stato per-appId GENERICO (niente più campi
 * hard-coded phiProject/pricelistComputo/tauComputo; inclusi pi/lambda), identità id/name,
 * relay con `source` derivato da mappa di configurazione. Reducer PURO.
 */
describe('hub project-state', () => {
  it('source per appId: storici mappati, nuovi = appId stesso', () => {
    expect(sourceForApp('miu-price-list')).toBe('pricelist')
    // tool senza alias storico: l'appId È il source, nessun hard-code
    expect(sourceForApp('beta-contabilita')).toBe('beta-contabilita')
    expect(sourceForApp('delta-pages')).toBe('delta-pages')
  })

  it('migra il VECCHIO shape {pricelistComputo,...} → mappa per appId', () => {
    const st = migrateHubState({ pricelistComputo: { a: 1 }, tauComputo: { b: 2 } })
    expect(st.tools['miu-price-list']).toEqual({ a: 1 })
    expect(st.tools['tau-documenti']).toEqual({ b: 2 })
    expect(st.id).toBeNull()
  })

  it('migra il NUOVO shape {id,name,tools} preservandolo', () => {
    const st = migrateHubState({ id: 'p-1', name: 'Casa', tools: { pi: { x: 1 } } })
    expect(st.id).toBe('p-1')
    expect(st.name).toBe('Casa')
    expect(st.tools.pi).toEqual({ x: 1 })
  })

  it('input non valido → stato vuoto', () => {
    expect(migrateHubState(null)).toEqual(emptyHubProjectState())
    expect(migrateHubState('x')).toEqual(emptyHubProjectState())
  })

  it('setToolProject è generico e immutabile (incluso pi/lambda)', () => {
    const a = emptyHubProjectState()
    const b = setToolProject(a, 'pi', { fronte: 1 })
    expect(a.tools.pi).toBeUndefined() // input non mutato
    expect(b.tools.pi).toEqual({ fronte: 1 })
    const c = setToolProject(b, 'lightcalc-road', { lux: 2 })
    expect(c.tools['lightcalc-road']).toEqual({ lux: 2 })
    // project null rimuove la voce
    const d = setToolProject(c, 'pi', null)
    expect(d.tools.pi).toBeUndefined()
    expect(d.tools['lightcalc-road']).toEqual({ lux: 2 })
  })

  it('projectStateMessages: un relay per tool con source corretto, marcato REPLAY', () => {
    const st = setToolProject(setToolProject(emptyHubProjectState(), 'gamma', { d: 1 }), 'pi', { f: 2 })
    const msgs = projectStateMessages(st)
    expect(msgs).toHaveLength(2)
    const gamma = msgs.find(m => m.appId === 'gamma')!
    expect(gamma.type).toBe('hub:project-state')
    expect(gamma.source).toBe('gamma')
    expect(gamma.project).toEqual({ d: 1 })
    const pi = msgs.find(m => m.appId === 'pi')!
    expect(pi.source).toBe('pi')
    // I messaggi di replica sono REPLAY → i consumatori non li applicano in automatico.
    expect(msgs.every(m => m.replay === true)).toBe(true)
  })

  it('ensureProjectId genera un id stabile solo se mancante', () => {
    const a = ensureProjectId(emptyHubProjectState(), () => 'ID1')
    expect(a.id).toBe('ID1')
    const b = ensureProjectId(a, () => 'ID2') // già presente → invariato
    expect(b.id).toBe('ID1')
  })

  it('setProjectIdentity aggiorna id/name senza toccare i tool', () => {
    const st = setToolProject(emptyHubProjectState(), 'pi', { f: 1 })
    const out = setProjectIdentity(st, 'p-9', 'Villa')
    expect(out.id).toBe('p-9')
    expect(out.name).toBe('Villa')
    expect(out.tools.pi).toEqual({ f: 1 })
  })
})

describe('planimetria UNICA di Progetto — sharedPlan (DXF + cavidotti/circuiti)', () => {
  const geom = (id: string, origin: string) => ({ id: `${origin}:${id}`, origin, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })

  it('stato vuoto ha una planimetria condivisa vuota; migrate la default se assente', () => {
    expect(emptyHubProjectState().sharedPlan).toEqual({ dxf: null, cavidotti: [], circuiti: [], scale: null })
    // file/localStorage legacy senza il campo → default vuoto, mai undefined
    expect(migrateHubState({ tools: {} }).sharedPlan).toEqual(emptySharedPlan())
  })

  it('normalizeSharedPlan tollera input parziale/sporco', () => {
    expect(normalizeSharedPlan(null)).toEqual(emptySharedPlan())
    expect(normalizeSharedPlan({ dxf: { ref: '/a.dxf', name: 'a.dxf', ts: 5 }, cavidotti: [geom('c1', 'phi-condotti')] }))
      .toEqual({ dxf: { ref: '/a.dxf', name: 'a.dxf', ts: 5 }, cavidotti: [geom('c1', 'phi-condotti')], circuiti: [], scale: null })
  })

  it('setSharedDxf imposta lo sfondo condiviso (immutabile)', () => {
    const st = emptyHubProjectState()
    const out = setSharedDxf(st, { ref: '/p.dxf', name: 'p.dxf', ts: 1 })
    expect(out.sharedPlan.dxf).toEqual({ ref: '/p.dxf', name: 'p.dxf', ts: 1 })
    expect(st.sharedPlan.dxf).toBeNull() // input non mutato
  })

  it('upsertShared: UPSERT per id (unione cross-tool, aggiorna in place)', () => {
    let st = emptyHubProjectState()
    st = upsertShared(st, { cavidotti: [geom('CC01', 'omega-schemes')], circuiti: [geom('loop-1', 'omega-schemes')] })
    st = upsertShared(st, { cavidotti: [geom('C01', 'phi-condotti')] })
    expect(st.sharedPlan.cavidotti.map(g => g.id).sort()).toEqual(['omega-schemes:CC01', 'phi-condotti:C01'])
    expect(st.sharedPlan.circuiti.map(g => g.id)).toEqual(['omega-schemes:loop-1'])
    // ri-upsert dello stesso id aggiorna in place (niente duplicati), mantiene l'ordine
    const moved = { ...geom('CC01', 'omega-schemes'), pts: [{ x: 9, y: 9 }] }
    st = upsertShared(st, { cavidotti: [moved] })
    expect(st.sharedPlan.cavidotti).toHaveLength(2)
    expect(st.sharedPlan.cavidotti[0].pts).toEqual([{ x: 9, y: 9 }])
  })

  it('upsertShared: un update PARZIALE non azzera il resto del pool (no clobber)', () => {
    let st = emptyHubProjectState()
    st = upsertShared(st, { cavidotti: [geom('CC01', 'omega-schemes'), geom('C01', 'phi-condotti')] })
    // ogni tool pubblica solo i SUOI: quelli dell'altro restano
    st = upsertShared(st, { cavidotti: [geom('C01', 'phi-condotti')] })
    expect(st.sharedPlan.cavidotti.map(g => g.id).sort()).toEqual(['omega-schemes:CC01', 'phi-condotti:C01'])
  })

  it('upsertShared: `deleted` rimuove per id, solo quelli indicati', () => {
    let st = emptyHubProjectState()
    st = upsertShared(st, { cavidotti: [geom('CC01', 'omega-schemes'), geom('CC02', 'omega-schemes')] })
    st = upsertShared(st, { deleted: { cavidotti: ['omega-schemes:CC01'] } })
    expect(st.sharedPlan.cavidotti.map(g => g.id)).toEqual(['omega-schemes:CC02'])
  })

  it('upsertShared: `scale` è UNICA per la planimetria — chi calibra per ultimo vale per tutti', () => {
    let st = emptyHubProjectState()
    expect(st.sharedPlan.scale).toBeNull()
    // il primo tool calibra: la scala compare nel pool condiviso
    st = upsertShared(st, { cavidotti: [geom('CC01', 'omega-schemes')], scale: 42 })
    expect(st.sharedPlan.scale).toBe(42)
    // un update SENZA scala (non ancora calibrata lì) non la azzera
    st = upsertShared(st, { cavidotti: [geom('C01', 'phi-condotti')] })
    expect(st.sharedPlan.scale).toBe(42)
    // l'altro ricalibra: il nuovo valore sostituisce il precedente
    st = upsertShared(st, { scale: 100 })
    expect(st.sharedPlan.scale).toBe(100)
    // valori non validi (0, negativi, non numerici) sono ignorati
    st = upsertShared(st, { scale: 0 })
    expect(st.sharedPlan.scale).toBe(100)
  })

  it('sharedPlanMessage è un replay project-global', () => {
    const st = setSharedDxf(emptyHubProjectState(), { ref: '/a.dxf', name: 'a', ts: 0 })
    const msg = sharedPlanMessage(st)
    expect(msg.type).toBe('hub:shared-plan')
    expect(msg.replay).toBe(true)
    expect(msg.plan).toBe(st.sharedPlan)
  })

  it('normalizeSharedDxf: tiene solo l\'IDENTITÀ della planimetria, e butta il DXF grezzo dei file vecchi', () => {
    expect(normalizeSharedDxf({ ref: '/p.dxf', name: 'p', ts: 1, size: 9 })).toEqual({ ref: '/p.dxf', name: 'p', ts: 1, size: 9 })
    // .ehub salvato da una versione vecchia: il campo `text` col DXF grezzo si scarta
    expect(normalizeSharedDxf({ text: 'X'.repeat(1000), name: 'p', ts: 1 })).toEqual({ name: 'p', ts: 1 })
    expect(normalizeSharedDxf({ ts: 1 })).toBeNull() // né ref né nome → nessuna planimetria
    expect(normalizeSharedDxf(null)).toBeNull()
  })

  it('dxfForDisk: salva il riferimento, non lo stato di sessione', () => {
    expect(dxfForDisk({ ref: '/p.dxf', name: 'p', ts: 1, size: 9, missing: true })).toEqual({ ref: '/p.dxf', name: 'p', ts: 1, size: 9 })
    expect(dxfForDisk(null)).toBeNull()
  })
})
