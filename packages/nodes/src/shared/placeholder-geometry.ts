import { type BufferGeometry, PlaneGeometry } from 'three'

/**
 * Placeholder geometry for a mesh whose real geometry is filled in later by a
 * system (wall / roof / roof-segment / ceiling / stair-segment). These meshes
 * are mounted *visible*, so the WebGPU renderer draws them on the first
 * frame(s) before the owning system runs — and the system passes are
 * rate-limited, so several meshes can still hold the placeholder across
 * multiple frames.
 *
 * It uses a zero-area `PlaneGeometry` rather than an empty or hand-written
 * triangle. The built-in plane supplies an index plus initialized position,
 * normal and UV buffers, so WebGPU can bind every slot compiled by front/back
 * sided node materials during the first frame. The previous three-zero-vertex
 * triangle intermittently left the normal slot unbound, poisoning the command
 * encoder before the owning system replaced it with real geometry. The
 * `groupCount` count-0 groups keep nothing drawn while matching the mesh's
 * material-array length so raycasts / BVH never index past the materials.
 */
export function createPlaceholderGeometry(groupCount = 0): BufferGeometry {
  const geometry = new PlaneGeometry(0, 0)
  geometry.setAttribute('uv2', geometry.getAttribute('uv').clone())
  for (let group = 0; group < groupCount; group++) {
    geometry.addGroup(0, 0, group)
  }
  return geometry
}
