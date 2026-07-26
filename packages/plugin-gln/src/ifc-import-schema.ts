import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

export const GlnIfcReviewReason = z.enum(['invalid-geometry', 'missing-parent', 'unsupported-kind'])

export const GlnIfcConversionReport = z.object({
  version: z.literal(1),
  source: z.object({
    path: z.string().trim().min(1).max(2048),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().nonnegative(),
  }),
  status: z.enum(['draft-ready', 'report-only']),
  minimumStructure: z.object({
    satisfied: z.boolean(),
    missing: z.array(z.enum(['building', 'level', 'wall', 'zone'])),
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
      nodeId: z.string().min(1),
      name: z.string().min(1),
      ifcType: z.string().nullable(),
      reason: GlnIfcReviewReason,
    }),
  ),
})

export const GlnIfcImportNode = BaseNode.extend({
  id: objectId('gln-ifc-import'),
  type: nodeType('gln:ifc-import'),
  parentId: z.null().default(null),
  report: GlnIfcConversionReport,
  referenceVisible: z.boolean().default(false),
})

export type GlnIfcImportNode = z.infer<typeof GlnIfcImportNode>
