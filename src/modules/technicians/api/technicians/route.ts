import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { technicianCrudEvents, technicianCrudIndexer } from '../../commands/technicians'
import { Technician, TechnicianSkill, TechnicianCertification } from '../../data/entities'
import { ENTITY_TYPE } from '../../lib/constants'
import type { TechnicianListItem } from '../../types'
import {
  createTechnicianCrudOpenApi,
  createTechnicianPagedListResponseSchema,
  technicianCreatedSchema,
  technicianOkSchema,
  technicianListItemSchema,
} from '../openapi'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    is_active: z.enum(['true', 'false']).optional(),
    skill: z.string().optional(),
    staff_member_id: z.string().uuid().optional(),
    staff_member_ids: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>
type BaseFields = Record<string, unknown>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['technicians.view'] },
    POST: { requireAuth: true, requireFeatures: ['technicians.create'] },
    PUT: { requireAuth: true, requireFeatures: ['technicians.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['technicians.delete'] },
  },
  orm: {
    entity: Technician,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: technicianCrudEvents,
  indexer: technicianCrudIndexer,
  list: {
    schema: querySchema,
    entityId: ENTITY_TYPE,
    fields: [
      'id',
      'staff_member_id',
      'is_active',
      'notes',
      'tenant_id',
      'organization_id',
      'created_at',
    ],
    sortFieldMap: {
      id: 'id',
      staffMemberId: 'staff_member_id',
      isActive: 'is_active',
      createdAt: 'created_at',
    },
    buildFilters: async (q: Query, ctx: any): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>

      if (q.id) F.id = q.id
      if (q.ids) F.id = { $in: q.ids.split(',') }
      if (q.is_active !== undefined) F.is_active = q.is_active === 'true'
      const staffMemberIds = new Set<string>()
      if (q.staff_member_id) staffMemberIds.add(q.staff_member_id)
      if (q.staff_member_ids) {
        for (const id of q.staff_member_ids.split(',').map((value) => value.trim()).filter(Boolean)) {
          staffMemberIds.add(id)
        }
      }
      if (staffMemberIds.size === 1) F.staff_member_id = [...staffMemberIds][0]
      if (staffMemberIds.size > 1) F.staff_member_id = { $in: [...staffMemberIds] }

      if (q.skill) {
        const em = (ctx.container.resolve('em') as EntityManager).fork()
        const skillFilters: Record<string, unknown> = {
          name: { $ilike: `%${escapeLikePattern(q.skill)}%` },
        }
        const scopeTenantId = ctx.organizationScope?.tenantId ?? ctx.auth?.tenantId ?? null
        const selectedOrgId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? null
        if (scopeTenantId) skillFilters.tenantId = scopeTenantId
        if (selectedOrgId) skillFilters.organizationId = selectedOrgId
        const matchingSkills = await em.find(TechnicianSkill, skillFilters as FilterQuery<TechnicianSkill>, { fields: ['technician'] })
        const technicianIds = [...new Set(matchingSkills.map((s) => {
          const techId = typeof s.technician === 'string' ? s.technician : s.technician?.id
          return techId
        }).filter(Boolean))]
        F.id = { $in: technicianIds.length > 0 ? technicianIds : [] }
      }

      return filters
    },
    transformItem: (item: BaseFields): TechnicianListItem => {
      const source = item as Record<string, unknown>
      const str = (camelCase: string, snakeCase: string) => String(source[camelCase] ?? source[snakeCase] ?? '')
      const nullable = (camelCase: string, snakeCase: string) =>
        (source[camelCase] ?? source[snakeCase] ?? null) as string | null
      const date = (camelCase: string, snakeCase: string) => {
        const value = source[camelCase] ?? source[snakeCase]
        return value ? new Date(value as string | number).toISOString() : null
      }

      return {
        id: str('id', 'id'),
        staffMemberId: str('staffMemberId', 'staff_member_id'),
        isActive: Boolean(source.isActive ?? source.is_active ?? true),
        notes: nullable('notes', 'notes'),
        skills: [],
        certificationCount: 0,
        tenantId: (source.tenantId ?? source.tenant_id ?? '') as string,
        organizationId: (source.organizationId ?? source.organization_id ?? '') as string,
        createdAt: date('createdAt', 'created_at'),
      }
    },
  },
  hooks: {
    afterList: async (payload: any, ctx: any) => {
      const items: TechnicianListItem[] = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const em = ctx.container.resolve('em') as EntityManager
      const knex = (em as any).getConnection().getKnex()
      const technicianIds = items.map((t: any) => String(t.id))

      // Resolve staff member display names
      const staffMemberIds = items.map((t: any) => String(t.staffMemberId)).filter(Boolean)
      if (staffMemberIds.length > 0) {
        const staffRows: Array<{ id: string; display_name: string }> = await knex('staff_team_members')
          .select('id', 'display_name')
          .whereIn('id', staffMemberIds)
        const nameMap = new Map(staffRows.map((r) => [r.id, r.display_name]))
        for (const item of items) {
          ;(item as any).staffMemberName = nameMap.get(item.staffMemberId) || null
        }
      }

      // Resolve skills
      const skills = await em.find(TechnicianSkill, {
        technician: { id: { $in: technicianIds } },
      } as FilterQuery<TechnicianSkill>)

      const skillsByTech = new Map<string, string[]>()
      const skillItemsByTech = new Map<string, Array<{ id: string; name: string }>>()
      for (const s of skills) {
        const techId = typeof s.technician === 'string' ? s.technician : s.technician?.id
        if (!techId) continue
        const nameArr = skillsByTech.get(techId) || []
        nameArr.push(s.name)
        skillsByTech.set(techId, nameArr)
        const itemArr = skillItemsByTech.get(techId) || []
        itemArr.push({ id: s.id, name: s.name })
        skillItemsByTech.set(techId, itemArr)
      }

      // Resolve certifications
      const certs = await em.find(TechnicianCertification, {
        technician: { id: { $in: technicianIds } },
      } as FilterQuery<TechnicianCertification>)

      const certsByTech = new Map<string, Array<any>>()
      const certCountByTech = new Map<string, number>()
      const now = new Date()
      for (const c of certs) {
        const techId = typeof c.technician === 'string' ? c.technician : c.technician?.id
        if (!techId) continue
        certCountByTech.set(techId, (certCountByTech.get(techId) || 0) + 1)
        const arr = certsByTech.get(techId) || []
        arr.push({
          id: c.id,
          name: c.name,
          certificateNumber: c.certificateNumber ?? null,
          issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
          isExpired: c.expiresAt ? c.expiresAt < now : false,
        })
        certsByTech.set(techId, arr)
      }

      for (const item of items) {
        ;(item as any).skills = skillsByTech.get(item.id) || []
        ;(item as any).skillItems = skillItemsByTech.get(item.id) || []
        ;(item as any).certificationCount = certCountByTech.get(item.id) || 0
        ;(item as any).certifications = certsByTech.get(item.id) || []
      }
    },
  },
  actions: {
    create: {
      commandId: 'technicians.technicians.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'technicians.technicians.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'technicians.technicians.delete',
      response: () => ({ ok: true }),
    },
  },
})

const technicianDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createTechnicianCrudOpenApi({
  resourceName: 'Technician',
  pluralName: 'Technicians',
  querySchema,
  listResponseSchema: createTechnicianPagedListResponseSchema(technicianListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a technician profile.',
    responseSchema: technicianCreatedSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates a technician profile by id.',
    responseSchema: technicianOkSchema,
  },
  del: {
    schema: technicianDeleteSchema,
    description: 'Deletes a technician profile by id (soft delete).',
    responseSchema: technicianOkSchema,
  },
})
