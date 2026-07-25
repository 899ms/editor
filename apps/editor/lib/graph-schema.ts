import { safeParseRegisteredNode } from '@pascal-app/core/registry'
import { z } from 'zod'

/**
 * Validates a SceneGraph at an untrusted API boundary. Re-runs
 * `safeParseRegisteredNode` on every node, which uses a registered plugin
 * schema when available and otherwise falls back to the built-in `AnyNode`
 * union. The built-in path retains the core `AssetUrl` allowlist.
 *
 * Shared between `POST /api/scenes` and `PUT /api/scenes/[id]` so neither
 * route can silently accept malicious URLs via the `graph` payload.
 *
 * Phase 8 P4 found the POST bypass; Phase 10 A2 found the PUT bypass.
 */
export const apiGraphSchema = z
  .object({
    nodes: z.record(z.string(), z.unknown()),
    rootNodeIds: z.array(z.string()),
    collections: z.unknown().optional(),
    installedPlugins: z.array(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    for (const [nodeId, node] of Object.entries(value.nodes)) {
      const res = safeParseRegisteredNode(node)
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({
            code: 'custom',
            path: ['nodes', nodeId, ...issue.path],
            message: issue.message,
          })
        }
      }
    }
  })
