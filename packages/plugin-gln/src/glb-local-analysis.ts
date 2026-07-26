import { Box3, type BufferGeometry, type Mesh, type Object3D, Vector3 } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  type GlbAnalyzedMesh,
  hashGlbSource,
  reconstructGlbResidential,
} from './glb-residential-reconstruction'

function tuple(vector: Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z]
}

function triangleCount(geometry: BufferGeometry) {
  const count = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
  return Math.floor(count / 3)
}

function worldAxesAreAligned(object: Object3D) {
  const elements = object.matrixWorld.elements
  const axes = [
    new Vector3(elements[0], elements[1], elements[2]).normalize(),
    new Vector3(elements[4], elements[5], elements[6]).normalize(),
    new Vector3(elements[8], elements[9], elements[10]).normalize(),
  ]
  return axes.every(
    (axis) => Math.max(Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z)) > 0.999,
  )
}

export function analyzeGlbObject(root: Object3D): GlbAnalyzedMesh[] {
  root.updateMatrixWorld(true)
  const meshes: GlbAnalyzedMesh[] = []
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    mesh.geometry.computeBoundingBox()
    const bounds = new Box3().setFromObject(mesh)
    if (bounds.isEmpty()) return
    meshes.push({
      id: mesh.uuid,
      name: mesh.name.trim() || `Mesh ${meshes.length + 1}`,
      bounds: { min: tuple(bounds.min), max: tuple(bounds.max) },
      triangleCount: triangleCount(mesh.geometry),
      worldAxisAligned: worldAxesAreAligned(mesh),
    })
  })
  return meshes
}

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    }
    return entities[character] ?? character
  })
}

export function buildGlbLowResolutionView(meshes: readonly GlbAnalyzedMesh[]) {
  const width = 360
  const height = 220
  const padding = 22
  const minX = Math.min(...meshes.map((mesh) => mesh.bounds.min[0]), 0)
  const maxX = Math.max(...meshes.map((mesh) => mesh.bounds.max[0]), 1)
  const minZ = Math.min(...meshes.map((mesh) => mesh.bounds.min[2]), 0)
  const maxZ = Math.max(...meshes.map((mesh) => mesh.bounds.max[2]), 1)
  const spanX = Math.max(maxX - minX, 0.1)
  const spanZ = Math.max(maxZ - minZ, 0.1)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanZ)
  const shapes = meshes
    .slice(0, 160)
    .map((mesh, index) => {
      const x = padding + (mesh.bounds.min[0] - minX) * scale
      const y = padding + (maxZ - mesh.bounds.max[2]) * scale
      const rectWidth = Math.max((mesh.bounds.max[0] - mesh.bounds.min[0]) * scale, 1.5)
      const rectHeight = Math.max((mesh.bounds.max[2] - mesh.bounds.min[2]) * scale, 1.5)
      const opacity = mesh.name.match(/wall/i) ? 0.8 : 0.28
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rectWidth.toFixed(
        1,
      )}" height="${rectHeight.toFixed(1)}" rx="1" fill="#38bdf8" fill-opacity="${opacity}" stroke="#0f172a" stroke-width="1"><title>${xmlEscape(
        mesh.name || `Mesh ${index + 1}`,
      )}</title></rect>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc"/><path d="M${padding} ${height - padding}H${width - padding}M${padding} ${height - padding}V${padding}" stroke="#cbd5e1" stroke-width="1"/>${shapes}<text x="${padding}" y="${height - 6}" fill="#475569" font-family="sans-serif" font-size="11">${meshes.length} meshes · local geometry summary</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

type GlbJson = {
  buffers?: Array<{ uri?: unknown }>
  images?: Array<{ uri?: unknown }>
}

export function assertEmbeddedGlbResources(bytes: ArrayBuffer) {
  if (bytes.byteLength < 20) throw new Error('GLB 文件头不完整。')
  const view = new DataView(bytes)
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('请选择有效的 GLB 2.0 文件。')
  }
  if (view.getUint32(16, true) !== 0x4e4f534a) {
    throw new Error('GLB 缺少 JSON 描述块。')
  }
  const jsonLength = view.getUint32(12, true)
  if (20 + jsonLength > bytes.byteLength) throw new Error('GLB JSON 描述块已损坏。')
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)),
  ) as GlbJson
  const resourceUris = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((resource) => resource.uri)
    .filter((uri): uri is string => typeof uri === 'string')
  if (resourceUris.some((uri) => !uri.startsWith('data:'))) {
    throw new Error('此 GLB 引用了外部资源。为避免自动联网，请先打包为完全内嵌的 GLB。')
  }
}

function parseGlb(bytes: ArrayBuffer) {
  assertEmbeddedGlbResources(bytes)
  return new Promise<Object3D>((resolve, reject) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)
    loader.parse(
      bytes,
      '',
      (gltf) => {
        dracoLoader.dispose()
        resolve(gltf.scene)
      },
      (error) => {
        dracoLoader.dispose()
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export async function analyzeLocalGlb(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const scene = await parseGlb(arrayBuffer)
  const meshes = analyzeGlbObject(scene)
  const source = {
    path: file.webkitRelativePath || file.name,
    sha256: await hashGlbSource(bytes),
    sizeBytes: file.size,
  }
  return {
    ...reconstructGlbResidential(meshes, source),
    lowResolutionView: buildGlbLowResolutionView(meshes),
    referenceObject: scene,
  }
}
