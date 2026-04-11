import { createCrudOpenApiFactory, createPagedListResponseSchema as coreCreatePagedListResponseSchema } from '@open-mercato/shared/lib/openapi/crud'

export const buildFieldTechniciansCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'FieldTechnicians',
})

export const createPagedListResponseSchema = coreCreatePagedListResponseSchema
