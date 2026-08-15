import { describe, it, expect } from 'vitest'
import { isToolVisible } from '../../src/hub/engine/visibility'
import type { AppDef } from '../../src/hub/data/registry'

const app = (over: Partial<AppDef> & { id: string }): AppDef => ({
  name: 'X', tagline: '', file: 'x.html', srcDir: 'x', logoType: 'x', tags: [],
  status: 'stable', category: 'progettazione', ...over,
})

describe('isToolVisible — ogni tool è visibile di default, unico gate: adminOnly', () => {
  it('un tool normale è sempre visibile, admin o no', () => {
    const a = app({ id: 'a' })
    expect(isToolVisible(a, { isAdmin: false })).toBe(true)
    expect(isToolVisible(a, { isAdmin: true })).toBe(true)
  })

  it('un tool beta è visibile come qualunque altro (nessuna gating per status)', () => {
    const a = app({ id: 'x-beta', status: 'beta' })
    expect(isToolVisible(a, { isAdmin: false })).toBe(true)
    expect(isToolVisible(a, { isAdmin: true })).toBe(true)
  })

  it('un tool adminOnly è nascosto a chi non è admin', () => {
    const a = app({ id: 'alfa-control-center', adminOnly: true })
    expect(isToolVisible(a, { isAdmin: false })).toBe(false)
  })

  it('un tool adminOnly è SEMPRE visibile per l\'admin', () => {
    const a = app({ id: 'alfa-control-center', adminOnly: true })
    expect(isToolVisible(a, { isAdmin: true })).toBe(true)
  })
})
