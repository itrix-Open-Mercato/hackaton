import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export const technicianTag = 'Technicians'

export const technicianOkSchema = z.object({
  ok: z.literal(true),
})

export const technicianCreatedSchema = z.object({
  id: z.string().uuid(),
})

export const technicianListItemSchema = z
  .object({
    id: z.string(),
    staff_member_id: z.string(),
    is_active: z.boolean(),
    notes: z.string().nullable().optional(),
    skills: z.array(z.string()),
    certification_count: z.number(),
    tenant_id: z.string().nullable().optional(),
    organization_id: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
  })
  .passthrough()

export function createTechnicianPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildTechnicianCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: technicianTag,
  defaultCreateResponseSchema: technicianCreatedSchema,
  defaultOkResponseSchema: technicianOkSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} in the current tenant scope.`,
})

export function createTechnicianCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildTechnicianCrudOpenApi(options)
}
