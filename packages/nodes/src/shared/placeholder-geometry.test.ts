import { describe, expect, it } from 'bun:test'
import { createPlaceholderGeometry } from './placeholder-geometry'

describe('createPlaceholderGeometry', () => {
  it('creates an invisible plane with complete, bindable vertex attributes', () => {
    const geometry = createPlaceholderGeometry(2)

    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const uv = geometry.getAttribute('uv')
    const uv2 = geometry.getAttribute('uv2')

    expect(position.count).toBeGreaterThanOrEqual(4)
    expect(normal.count).toBe(position.count)
    expect(uv.count).toBe(position.count)
    expect(uv2.count).toBe(position.count)
    expect(geometry.index?.count).toBeGreaterThanOrEqual(6)
    expect(
      Array.from({ length: normal.count }, (_, index) =>
        Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index)),
      ).some((length) => length > 0),
    ).toBe(true)
    expect(geometry.groups).toEqual([
      { start: 0, count: 0, materialIndex: 0 },
      { start: 0, count: 0, materialIndex: 1 },
    ])

    geometry.dispose()
  })
})
