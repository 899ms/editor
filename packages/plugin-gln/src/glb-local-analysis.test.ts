import { describe, expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import {
  analyzeGlbObject,
  assertEmbeddedGlbResources,
  buildGlbLowResolutionView,
} from './glb-local-analysis'

function glbWithJson(json: Record<string, unknown>) {
  const encoded = new TextEncoder().encode(JSON.stringify(json))
  const paddedLength = Math.ceil(encoded.byteLength / 4) * 4
  const buffer = new ArrayBuffer(20 + paddedLength)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, paddedLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  const bytes = new Uint8Array(buffer, 20)
  bytes.fill(0x20)
  bytes.set(encoded)
  return buffer
}

describe('local GLB geometry analysis', () => {
  test('extracts world-space mesh bounds and triangle counts without upload data', () => {
    const root = new Group()
    const mesh = new Mesh(new BoxGeometry(6, 2.8, 0.12), new MeshBasicMaterial())
    mesh.name = 'Wall North'
    mesh.position.set(3, 1.4, 0.06)
    root.add(mesh)

    const analysis = analyzeGlbObject(root)

    expect(analysis).toHaveLength(1)
    expect(analysis[0]).toMatchObject({
      name: 'Wall North',
      triangleCount: 12,
      worldAxisAligned: true,
    })
    expect(analysis[0]?.bounds.min[0]).toBeCloseTo(0)
    expect(analysis[0]?.bounds.max[0]).toBeCloseTo(6)
  })

  test('creates a compact local preview data URL from geometry summaries', () => {
    const view = buildGlbLowResolutionView([
      {
        id: 'wall',
        name: 'Wall',
        bounds: { min: [0, 0, 0], max: [6, 2.8, 0.12] },
        triangleCount: 12,
        worldAxisAligned: true,
      },
    ])

    expect(view).toStartWith('data:image/svg+xml,')
    expect(view.length).toBeLessThan(10_000)
  })

  test('rejects GLB files that would fetch external buffers or images', () => {
    const embedded = glbWithJson({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 0 }],
      images: [{ uri: 'data:image/png;base64,AA==' }],
    })
    expect(() => assertEmbeddedGlbResources(embedded)).not.toThrow()

    const external = glbWithJson({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 8, uri: 'https://example.test/private.bin' }],
    })
    expect(() => assertEmbeddedGlbResources(external)).toThrow(/外部资源/)
  })
})
