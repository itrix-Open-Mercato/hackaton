import { z } from 'zod'
import { phoneCallDirectionSchema, phoneCallStatusSchema } from '../data/validators'

export const ENTITY_TYPE = 'phone_calls:phone_call'
export const TILLIO_INTEGRATION_ID = 'phone_calls.tillio'
export const TILLIO_PROVIDER_ID = 'tillio_ringostat'
export const TILLIO_DEFAULT_API_BASE_URL = 'https://api.tillio.io'

export type PhoneCallDirection = z.infer<typeof phoneCallDirectionSchema>
export type PhoneCallStatus = z.infer<typeof phoneCallStatusSchema>

export const DIRECTION_VALUES = phoneCallDirectionSchema.options
export const STATUS_VALUES = phoneCallStatusSchema.options

export const DIRECTION_I18N_KEYS: Record<PhoneCallDirection, string> = {
  inbound: 'phone_calls.enum.direction.inbound',
  outbound: 'phone_calls.enum.direction.outbound',
  internal: 'phone_calls.enum.direction.internal',
  unknown: 'phone_calls.enum.direction.unknown',
}

export const STATUS_I18N_KEYS: Record<PhoneCallStatus, string> = {
  new: 'phone_calls.enum.status.new',
  synced: 'phone_calls.enum.status.synced',
  answered: 'phone_calls.enum.status.answered',
  missed: 'phone_calls.enum.status.missed',
  failed: 'phone_calls.enum.status.failed',
  unknown: 'phone_calls.enum.status.unknown',
}
