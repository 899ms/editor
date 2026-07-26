import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

const Tuple3 = z.tuple([z.number(), z.number(), z.number()])

export const GlnGlbReviewReason = z.enum([
  'ambiguous-geometry',
  'degenerate-geometry',
  'unsupported-semantic',
])

export const GlnGlbConversionReport = z.object({
  version: z.literal(1),
  source: z.object({
    path: z.string().trim().min(1).max(2048),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().nonnegative(),
  }),
  status: z.enum(['draft-ready', 'report-only']),
  minimumStructure: z.object({
    satisfied: z.boolean(),
    missing: z.array(z.enum(['wall', 'zone'])),
  }),
  geometry: z.object({
    bounds: z.object({ min: Tuple3, max: Tuple3 }),
    meshCount: z.number().int().nonnegative(),
    triangleCount: z.number().int().nonnegative(),
  }),
  nodeCounts: z.object({
    source: z.number().int().nonnegative(),
    highConfidence: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
  }),
  generated: z.object({
    zones: z.number().int().nonnegative(),
    ceilings: z.number().int().nonnegative(),
  }),
  reviewItems: z.array(
    z.object({
      meshId: z.string().min(1),
      name: z.string().min(1),
      reason: GlnGlbReviewReason,
    }),
  ),
})

export const GlnGlbImportNode = BaseNode.extend({
  id: objectId('gln-glb-import'),
  type: nodeType('gln:glb-import'),
  parentId: z.null().default(null),
  report: GlnGlbConversionReport,
  referenceVisible: z.boolean().default(false),
})

export type GlnGlbImportNode = z.infer<typeof GlnGlbImportNode>
