import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

export const GlnSystemMode = z.enum(['cooling', 'heating', 'standby'])
export type GlnSystemMode = z.infer<typeof GlnSystemMode>

/**
 * Logical owner of a hydronic GLN installation. It is deliberately invisible:
 * physical devices reference this node through `systemId`, while runtime mode
 * has one source of truth here.
 */
export const GlnSystemNode = BaseNode.extend({
  id: objectId('gln-system'),
  type: nodeType('gln:system'),
  name: z.string().trim().min(1).max(120),
  mode: GlnSystemMode.default('standby'),
  visible: z.literal(false).default(false),
  parentId: z.null().default(null),
})

export type GlnSystemNode = z.infer<typeof GlnSystemNode>
