import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export const serviceProtocolTag = 'Service Protocols'

export const protocolOkSchema = z.object({ ok: z.literal(true) })

export const protocolCreatedSchema = z.object({
  id: z.string().uuid(),
  protocolNumber: z.string(),
  status: z.string(),
  serviceTicketId: z.string().uuid(),
})

export const protocolListItemSchema = z
  .object({
    id: z.string(),
    protocolNumber: z.string(),
    serviceTicketId: z.string(),
    status: z.string(),
    type: z.string(),
    customerEntityId: z.string().nullable().optional(),
    contactPersonId: z.string().nullable().optional(),
    machineAssetId: z.string().nullable().optional(),
    workDescription: z.string().nullable().optional(),
    technicianNotes: z.string().nullable().optional(),
    customerNotes: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    closedAt: z.string().nullable().optional(),
    createdByUserId: z.string().nullable().optional(),
    tenantId: z.string().nullable().optional(),
    organizationId: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough()

export function createProtocolPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildProtocolCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: serviceProtocolTag,
  defaultCreateResponseSchema: protocolCreatedSchema,
  defaultOkResponseSchema: protocolOkSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} in the current tenant scope.`,
})

export function createProtocolCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildProtocolCrudOpenApi(options)
}
