import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

export const GlnHydronicCircuit = z.enum(['supply', 'return'])
export type GlnHydronicCircuit = z.infer<typeof GlnHydronicCircuit>

const GlnPipeEndpoint = z.object({
  nodeId: z.string().min(1),
  portId: z.string().min(1),
})

export type GlnPipeEndpoint = z.infer<typeof GlnPipeEndpoint>

/** A visible, independently editable water run. Its path is level-local metres. */
export const GlnHydronicPipeNode = BaseNode.extend({
  id: objectId('gln-hydronic-pipe'),
  type: nodeType('gln:hydronic-pipe'),
  systemId: objectId('gln-system'),
  circuit: GlnHydronicCircuit.default('supply'),
  path: z
    .array(z.tuple([z.number(), z.number(), z.number()]))
    .min(2)
    .default([
      [0, 2.5, 0],
      [1, 2.5, 0],
    ]),
  diameterIn: z.number().min(0.25).max(2).default(1),
  start: GlnPipeEndpoint.nullable().default(null),
  end: GlnPipeEndpoint.nullable().default(null),
  concealed: z.boolean().default(true),
})

export type GlnHydronicPipeNode = z.infer<typeof GlnHydronicPipeNode>
