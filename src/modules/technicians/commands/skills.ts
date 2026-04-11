import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Technician, TechnicianSkill } from '../data/entities'
import { skillAddSchema, skillRemoveSchema } from '../data/validators'
import { ensureScope } from './technicians'

export const addSkillCommand: CommandHandler<Record<string, unknown>, TechnicianSkill> = {
  id: 'technicians.skills.add',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = skillAddSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const technician = await em.findOne(Technician, {
      id: parsed.technician_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<Technician>)
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found' })

    const existing = await em.findOne(TechnicianSkill, {
      technician: { id: parsed.technician_id },
      name: parsed.name,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<TechnicianSkill>)
    if (existing) throw new CrudHttpError(409, { error: 'Skill already exists on this technician' })

    const skill = await de.createOrmEntity({
      entity: TechnicianSkill,
      data: {
        technician,
        name: parsed.name,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return skill
  },
}

export const removeSkillCommand: CommandHandler<Record<string, unknown>, { ok: boolean }> = {
  id: 'technicians.skills.remove',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = skillRemoveSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager

    const skill = await em.findOne(TechnicianSkill, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<TechnicianSkill>)
    if (!skill) throw new CrudHttpError(404, { error: 'Skill not found' })

    em.remove(skill)
    await em.flush()

    return { ok: true }
  },
}

registerCommand(addSkillCommand)
registerCommand(removeSkillCommand)
