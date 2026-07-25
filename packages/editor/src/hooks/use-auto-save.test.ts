import { describe, expect, test } from 'bun:test'
import { isSuspiciousNodeDrop, shouldFlushAutosaveOnCleanup } from './use-auto-save'

describe('isSuspiciousNodeDrop', () => {
  test('blocks populated scenes from being flushed as empty skeletons', () => {
    expect(isSuspiciousNodeDrop(12, 0)).toBe(true)
    expect(isSuspiciousNodeDrop(12, 4)).toBe(true)
  })

  test('allows ordinary edits and intentionally empty starting scenes', () => {
    expect(isSuspiciousNodeDrop(12, 11)).toBe(false)
    expect(isSuspiciousNodeDrop(4, 0)).toBe(false)
  })
})

describe('shouldFlushAutosaveOnCleanup', () => {
  test('does not flush a transient empty graph while a scene is loading', () => {
    expect(
      shouldFlushAutosaveOnCleanup({
        hasDirtyChanges: true,
        isLoadingScene: true,
      }),
    ).toBe(false)
  })

  test('flushes real dirty changes after loading has completed', () => {
    expect(
      shouldFlushAutosaveOnCleanup({
        hasDirtyChanges: true,
        isLoadingScene: false,
      }),
    ).toBe(true)
  })
})
