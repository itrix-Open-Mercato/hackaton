import { createCrudOpenApiFactory, createPagedListResponseSchema as coreCreatePagedListResponseSchema } from '@open-mercato/shared/lib/openapi/crud'

export const buildTechnicianScheduleCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'TechnicianSchedule',
})

export const createPagedListResponseSchema = coreCreatePagedListResponseSchema
