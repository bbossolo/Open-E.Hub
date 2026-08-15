// @vitest-environment jsdom
/** Open E.Hub è offline-first: nessuna telemetria, nessuna rete esterna.
    src/shared/analytics.ts espone track()/initAnalytics() come no-op, per non
    richiedere modifiche ai chiamanti (hub/main.js, tool main.*) che li invocano
    all'avvio. Questo test asserisce ESATTAMENTE questo: nessuna rete, nessun
    sendBeacon, nessuno stato interno che si accumula. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('analytics — no-op (Open E.Hub è offline-first, niente telemetria)', () => {
  it('track() non fa mai rete, quante volte lo si chiami', async () => {
    const { track } = await import('../../src/shared/analytics')
    for (let i = 0; i < 15; i++) track('tool_open')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('initAnalytics() non fa mai rete e non lega listener che poi la fanno', async () => {
    const beacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const { initAnalytics } = await import('../../src/shared/analytics')
    initAnalytics()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(beacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
