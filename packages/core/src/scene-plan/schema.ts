import { z } from 'zod'

const scenePlanNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
  })
  .loose()

export const ScenePlanOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create'),
    node: scenePlanNodeSchema,
    parentId: z.string().min(1).optional(),
  }),
  z.object({
    op: z.literal('update'),
    id: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal('delete'),
    id: z.string().min(1),
    cascade: z.boolean().optional(),
  }),
])

export const ScenePlanSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  baseVersion: z.number().int().nonnegative(),
  operations: z.array(ScenePlanOperationSchema).min(1),
  warnings: z.array(z.string()).optional(),
})
