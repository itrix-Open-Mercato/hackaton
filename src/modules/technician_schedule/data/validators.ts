import { z } from 'zod'

export const technicianReservationTypeSchema = z.enum(['client_visit', 'internal_work', 'leave', 'training'])
export const technicianReservationStatusSchema = z.enum(['auto_confirmed', 'confirmed', 'cancelled'])
export const technicianReservationSourceTypeSchema = z.enum(['service_ticket', 'service_order', 'manual'])
export const technicianReservationEntryKindSchema = z.enum(['reservation', 'availability'])
export const technicianAvailabilityTypeSchema = z.enum(['trip', 'unavailable', 'holiday'])

const reservationTimeSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .refine(
    (value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    },
  )

export const technicianReservationCreateSchema = z
  .object({
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    title: z.string().min(1).max(255).optional(),
    reservationType: technicianReservationTypeSchema.optional(),
    entryKind: technicianReservationEntryKindSchema.optional().default('reservation'),
    availabilityType: technicianAvailabilityTypeSchema.nullable().optional(),
    allDay: z.boolean().optional().default(false),
    status: technicianReservationStatusSchema.optional().default('confirmed'),
    sourceType: technicianReservationSourceTypeSchema.optional().default('manual'),
    sourceTicketId: z.string().uuid().nullable().optional(),
    sourceOrderId: z.string().uuid().nullable().optional(),
    technicianIds: z.array(z.string().uuid()).min(1),
    vehicleId: z.string().uuid().nullable().optional(),
    vehicleLabel: z.string().max(255).nullable().optional(),
    customerName: z.string().max(255).nullable().optional(),
    address: z.string().max(1000).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .merge(reservationTimeSchema)
  .superRefine((value, ctx) => {
    if (value.entryKind === 'reservation' && !value.reservationType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reservationType is required for timed reservations',
        path: ['reservationType'],
      })
    }

    if (value.entryKind === 'availability' && !value.availabilityType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'availabilityType is required for availability markers',
        path: ['availabilityType'],
      })
    }
  })

export const technicianReservationUpdateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(255).optional(),
    reservationType: technicianReservationTypeSchema.nullable().optional(),
    entryKind: technicianReservationEntryKindSchema.optional(),
    availabilityType: technicianAvailabilityTypeSchema.nullable().optional(),
    allDay: z.boolean().optional(),
    status: technicianReservationStatusSchema.optional(),
    sourceType: technicianReservationSourceTypeSchema.optional(),
    sourceTicketId: z.string().uuid().nullable().optional(),
    sourceOrderId: z.string().uuid().nullable().optional(),
    technicianIds: z.array(z.string().uuid()).min(1).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    vehicleId: z.string().uuid().nullable().optional(),
    vehicleLabel: z.string().max(255).nullable().optional(),
    customerName: z.string().max(255).nullable().optional(),
    address: z.string().max(1000).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      })
    }
  })

export const cancelReservationSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(4000).nullable().optional(),
})

export type TechnicianReservationCreateInput = z.infer<typeof technicianReservationCreateSchema>
export type TechnicianReservationUpdateInput = z.infer<typeof technicianReservationUpdateSchema>
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>
