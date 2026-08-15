/**
 * Open E.Hub è offline-first: nessuna telemetria, nessuna rete esterna.
 * `track`/`initAnalytics` restano come no-op per non richiedere modifiche
 * ai chiamanti (hub/main.js, tool main.*) che li invocano all'avvio.
 */
export function track(_event: string, _props?: Record<string, unknown>): void {}

export function initAnalytics(): void {}
