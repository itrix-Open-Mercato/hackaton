export function normalizeDateTimeString(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) return trimmed

  let normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')

  // PostgreSQL can return offsets like +00, while browsers expect +00:00.
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`
  }

  return normalized
}

export function parseDateTimeValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  if (typeof value === 'string') {
    const parsed = new Date(normalizeDateTimeString(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

export function toIsoDateTimeString(value: Date | string | null | undefined): string | null {
  return parseDateTimeValue(value)?.toISOString() ?? null
}

export function createUtcDayRange(date: string): { startsAt: Date; endsAt: Date } {
  const [year, month, day] = date.split('-').map(Number)
  const startsAt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const endsAt = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
  return { startsAt, endsAt }
}

export function getDateToken(value: Date | string | null | undefined): string | null {
  return toIsoDateTimeString(value)?.slice(0, 10) ?? null
}
