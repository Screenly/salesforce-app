import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  readCachedCredentials,
  writeCachedCredentials,
  readCachedContent,
  writeCachedContent,
} from './cache'
import type { DashboardResults, ReportResult } from './types'

class FakeStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

const originalLocalStorage = globalThis.localStorage

function useFakeStorage(): FakeStorage {
  const storage = new FakeStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
  return storage
}

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  })
})

describe('credentials cache', () => {
  beforeEach(() => {
    useFakeStorage()
  })

  test('round-trips read/write', () => {
    const value = {
      accessToken: 'abc',
      instanceUrl: 'https://na1.salesforce.com',
    }
    writeCachedCredentials(value)

    expect(readCachedCredentials()).toEqual(value)
  })

  test('returns null when nothing is cached', () => {
    expect(readCachedCredentials()).toBeNull()
  })

  test('returns null on invalid JSON', () => {
    globalThis.localStorage.setItem(
      'salesforce-edge-app:v1:credentials',
      'not json'
    )

    expect(readCachedCredentials()).toBeNull()
  })
})

describe('content cache', () => {
  beforeEach(() => {
    useFakeStorage()
  })

  test('round-trips read/write for a report', () => {
    const value = { factMap: {} } as ReportResult
    writeCachedContent('report', 'abc123', value)

    expect(readCachedContent('report', 'abc123')).toEqual(value)
  })

  test('round-trips read/write for a dashboard', () => {
    const value = {
      dashboardMetadata: { name: 'Dashboard', id: 'abc123', components: [] },
      componentData: [],
    } as DashboardResults
    writeCachedContent('dashboard', 'abc123', value)

    expect(readCachedContent('dashboard', 'abc123')).toEqual(value)
  })

  test('returns null when nothing is cached', () => {
    expect(readCachedContent('report', 'missing')).toBeNull()
  })

  test('returns null on invalid JSON', () => {
    globalThis.localStorage.setItem(
      'salesforce-edge-app:v1:content:report:abc123',
      '{not valid json'
    )

    expect(readCachedContent('report', 'abc123')).toBeNull()
  })

  test('does not collide across content types for the same content id', () => {
    const reportValue = { factMap: {} } as ReportResult
    const dashboardValue = {
      dashboardMetadata: { name: 'Dashboard', id: 'shared-id', components: [] },
      componentData: [],
    } as DashboardResults

    writeCachedContent('report', 'shared-id', reportValue)
    writeCachedContent('dashboard', 'shared-id', dashboardValue)

    expect(readCachedContent('report', 'shared-id')).toEqual(reportValue)
    expect(readCachedContent('dashboard', 'shared-id')).toEqual(dashboardValue)
  })
})

describe('graceful degradation', () => {
  test('read/write are no-ops when localStorage is undefined', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    expect(() =>
      writeCachedCredentials({ accessToken: 'a', instanceUrl: 'b' })
    ).not.toThrow()
    expect(readCachedCredentials()).toBeNull()
    expect(readCachedContent('report', 'abc')).toBeNull()
  })

  test('read/write are no-ops when localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('storage disabled')
        },
        setItem: () => {
          throw new Error('quota exceeded')
        },
      },
      writable: true,
      configurable: true,
    })

    expect(() =>
      writeCachedCredentials({ accessToken: 'a', instanceUrl: 'b' })
    ).not.toThrow()
    expect(readCachedCredentials()).toBeNull()
  })
})
