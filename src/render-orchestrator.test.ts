import { describe, test, expect, mock } from 'bun:test'

mock.module('@screenly/edge-apps', () => ({
  getSettingWithDefault: (_key: string, defaultValue: unknown) => defaultValue,
  getCorsProxyUrl: () => 'https://cors-proxy.example.com',
}))
mock.module('@screenly/edge-apps/utils', () => ({ reportError: () => {} }))

const { BackendServerError } = await import('./credentials')
const { shouldSkipBackendError, shouldSignalReady } =
  await import('./render-orchestrator')

describe('shouldSkipBackendError', () => {
  test('skips a backend outage when display_errors is off', () => {
    expect(shouldSkipBackendError(new BackendServerError('boom'), false)).toBe(
      true
    )
  })

  test('does not skip a backend outage when display_errors is on', () => {
    expect(shouldSkipBackendError(new BackendServerError('boom'), true)).toBe(
      false
    )
  })

  test('does not skip a non-backend error', () => {
    expect(shouldSkipBackendError(new Error('not connected'), false)).toBe(
      false
    )
  })
})

describe('shouldSignalReady', () => {
  test('does not signal ready when preloading and the render was skipped', () => {
    expect(shouldSignalReady('skipped', false)).toBe(false)
  })

  test('does not signal ready again once already rendered, even if skipped again', () => {
    expect(shouldSignalReady('skipped', true)).toBe(false)
  })

  test('signals ready the first time something is shown', () => {
    expect(shouldSignalReady('shown', false)).toBe(true)
  })

  test('does not signal ready again after the first time something is shown', () => {
    expect(shouldSignalReady('shown', true)).toBe(false)
  })
})
