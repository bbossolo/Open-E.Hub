import { describe, it, expect } from 'vitest'
import { computeAdminStats } from '../../src/hub/engine/admin-stats'
import { emptyHubProjectState, emptySharedPlan } from '../../src/hub/engine/project-state'
import type { AppDef } from '../../src/hub/data/registry'
import type { HubUser } from '../../src/hub/data/users'

const app = (over: Partial<AppDef> & { id: string }): AppDef => ({
  name: 'X', tagline: '', file: 'x.html', srcDir: 'x', logoType: 'x', tags: [],
  status: 'stable', category: 'progettazione', ...over,
})
const user = (over: Partial<HubUser> & { id: string }): HubUser => ({
  username: over.id, name: over.id, companyId: 'studio-a', role: 'user', active: true, ...over,
})

const registry: AppDef[] = [
  app({ id: 'a', category: 'progettazione', status: 'stable' }),
  app({ id: 'b', category: 'progettazione', status: 'beta' }),
  app({ id: 'c', category: 'documenti-commessa', status: 'stable' }),
  app({ id: 'd', category: 'amministrazione', status: 'stable', adminOnly: true }),
]

const users: HubUser[] = [
  user({ id: 'u1', active: true, role: 'user' }),
  user({ id: 'u2', active: false, role: 'user' }),
  user({ id: 'u3', active: true, role: 'admin' }),
  user({ id: 'u4', active: true, role: 'user' }),
]

describe('computeAdminStats', () => {
  it('conta i tool per stato e per admin-only', () => {
    const s = computeAdminStats({ registry, users: [], hubProjectState: null, storageEntries: [], storagePrefixes: [] })
    expect(s.tools.total).toBe(4)
    expect(s.tools.stable).toBe(3)
    expect(s.tools.beta).toBe(1)
    expect(s.tools.adminOnly).toBe(1)
  })

  it('raggruppa i tool per categoria, omettendo le categorie vuote', () => {
    const s = computeAdminStats({ registry, users: [], hubProjectState: null, storageEntries: [], storagePrefixes: [] })
    expect(s.tools.perCategory.map(c => c.category)).toEqual(['documenti-commessa', 'progettazione', 'amministrazione'])
    const prog = s.tools.perCategory.find(c => c.category === 'progettazione')!
    expect(prog.total).toBe(2); expect(prog.stable).toBe(1); expect(prog.beta).toBe(1)
  })

  it('conta gli utenti per attivi/ruolo', () => {
    const s = computeAdminStats({ registry: [], users, hubProjectState: null, storageEntries: [], storagePrefixes: [] })
    expect(s.users.total).toBe(4)
    expect(s.users.active).toBe(3)
    expect(s.users.admin).toBe(1)
  })

  it('nessun progetto aperto → riepilogo vuoto', () => {
    const s = computeAdminStats({ registry: [], users: [], hubProjectState: null, storageEntries: [], storagePrefixes: [] })
    expect(s.project.name).toBeNull()
    expect(s.project.toolsWithState).toBe(0)
    expect(s.project.hasSharedPlan).toBe(false)
  })

  it('progetto con stato salvato per due tool e planimetria condivisa', () => {
    const st = emptyHubProjectState()
    st.name = 'Progetto Demo'
    st.tools = { a: { foo: 1 }, c: { bar: 2 } }
    st.sharedPlan = { ...emptySharedPlan(), dxf: { ref: 'x.dxf', name: 'x.dxf', ts: 0 }, cavidotti: [{ id: '1' } as never], circuiti: [] }
    const s = computeAdminStats({ registry: [], users: [], hubProjectState: st, storageEntries: [], storagePrefixes: [] })
    expect(s.project.name).toBe('Progetto Demo')
    expect(s.project.toolsWithState).toBe(2)
    expect(s.project.hasSharedPlan).toBe(true)
    expect(s.project.cavidottiCount).toBe(1)
  })

  it('breakdown storage per prefisso + totale in KB', () => {
    const storageEntries: Array<[string, number]> = [
      ['hub:users', 2048], ['hub:tool-flags', 100], ['hub:auth', 200], ['altro', 500],
    ]
    const s = computeAdminStats({ registry: [], users: [], hubProjectState: null, storageEntries, storagePrefixes: ['hub:users', 'hub:tool-flags'] })
    expect(s.storageBreakdownKB['hub:users']).toBe(2)
    expect(s.storageBreakdownKB['hub:tool-flags']).toBe(0)
    expect(s.storageTotalKB).toBe(Math.round(2848 / 1024))
  })
})
