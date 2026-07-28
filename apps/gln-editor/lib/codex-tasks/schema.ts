import { z } from 'zod'

export const CodexTaskKindSchema = z.enum(['reconstruct-home', 'configure-gln', 'repair-gln'])

export const GlnConfigurationRequestSchema = z
  .object({
    targetSystemCount: z.number().int().min(1).max(8).default(1),
  })
  .strict()

export const CodexSourceContextSchema = z
  .object({
    kind: z.enum(['glb', 'ifc']),
    summary: z.string().trim().min(1).max(50_000),
    originalFileToken: z.string().trim().min(16).max(256).optional(),
    uploadOriginal: z.boolean().default(false),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.uploadOriginal && !source.originalFileToken) {
      context.addIssue({
        code: 'custom',
        message: 'original_upload_requires_explicit_authorization',
        path: ['originalFileToken'],
      })
    }
  })

export const CodexTaskRequestSchema = z
  .object({
    kind: CodexTaskKindSchema,
    sceneId: z.string().trim().min(1).max(256),
    brief: z.string().trim().min(1).max(8_000),
    source: CodexSourceContextSchema.optional(),
    glnConfiguration: GlnConfigurationRequestSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.glnConfiguration && request.kind !== 'configure-gln') {
      context.addIssue({
        code: 'custom',
        message: 'gln_configuration_only_for_configure_task',
        path: ['glnConfiguration'],
      })
    }
  })

export type CodexTaskKind = z.infer<typeof CodexTaskKindSchema>
export type CodexTaskRequest = z.infer<typeof CodexTaskRequestSchema>
export type CodexSourceContext = z.infer<typeof CodexSourceContextSchema>
export type GlnConfigurationRequest = z.infer<typeof GlnConfigurationRequestSchema>
