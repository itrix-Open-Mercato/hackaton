"use client"

import * as React from 'react'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  fetchCompanyById,
  fetchCompanyPeople,
  fetchPersonById,
  mergeEntityOptions,
  searchCompanies,
  type EntityOption,
} from './customerOptions'

type CustomerCascadeSelectProps = {
  companyId?: string | null
  personId?: string | null
  companyLabel: string
  personLabel: string
  companyPlaceholder: string
  personPlaceholder: string
  companyError?: string
  personError?: string
  setCompanyId: (value: string) => void
  setPersonId: (value: string) => void
}

export default function CustomerCascadeSelect({
  companyId,
  personId,
  companyLabel,
  personLabel,
  companyPlaceholder,
  personPlaceholder,
  companyError,
  personError,
  setCompanyId,
  setPersonId,
}: CustomerCascadeSelectProps) {
  const [companyOptions, setCompanyOptions] = React.useState<EntityOption[]>([])
  const [personOptions, setPersonOptions] = React.useState<EntityOption[]>([])

  React.useEffect(() => {
    let cancelled = false

    async function ensureCompanyLabel() {
      if (!companyId || companyOptions.some((option) => option.value === companyId)) return
      try {
        const option = await fetchCompanyById(companyId)
        if (!cancelled && option) {
          setCompanyOptions((current) => mergeEntityOptions(current, [option]))
        }
      } catch {
        // Keep the raw id as a fallback label inside ComboboxInput.
      }
    }

    void ensureCompanyLabel()

    return () => {
      cancelled = true
    }
  }, [companyId, companyOptions])

  React.useEffect(() => {
    let cancelled = false

    async function ensurePersonLabel() {
      if (!personId || personOptions.some((option) => option.value === personId)) return
      try {
        const option = await fetchPersonById(personId)
        if (!cancelled && option) {
          setPersonOptions((current) => mergeEntityOptions(current, [option]))
        }
      } catch {
        // Keep the raw id as a fallback label inside ComboboxInput.
      }
    }

    void ensurePersonLabel()

    return () => {
      cancelled = true
    }
  }, [personId, personOptions])

  React.useEffect(() => {
    let cancelled = false

    async function loadPeople() {
      if (!companyId) {
        setPersonOptions([])
        return
      }

      try {
        const nextOptions = await fetchCompanyPeople(companyId)
        if (!cancelled) {
          setPersonOptions((current) => mergeEntityOptions(current, nextOptions))
        }
      } catch {
        if (!cancelled) {
          setPersonOptions((current) => current.filter((option) => option.value === personId))
        }
      }
    }

    void loadPeople()

    return () => {
      cancelled = true
    }
  }, [companyId, personId])

  const handleCompanyChange = React.useCallback(
    (nextValue: string) => {
      const normalized = nextValue.trim()
      const companyChanged = normalized !== (companyId ?? '')

      setCompanyId(normalized)

      if (companyChanged) {
        setPersonId('')
      }
    },
    [companyId, setCompanyId, setPersonId],
  )

  const loadCompanySuggestions = React.useCallback(async (query?: string) => {
    const nextOptions = await searchCompanies(query ?? '')
    setCompanyOptions((current) => mergeEntityOptions(current, nextOptions))
    return nextOptions
  }, [])

  const loadPersonSuggestions = React.useCallback(async (query?: string) => {
    if (!companyId) return []

    const trimmedQuery = (query ?? '').trim().toLowerCase()
    if (!trimmedQuery) return personOptions

    return personOptions.filter((option) => option.label.toLowerCase().includes(trimmedQuery))
  }, [companyId, personOptions])

  const resolveCompanyLabel = React.useCallback(
    (value: string) => companyOptions.find((option) => option.value === value)?.label ?? value,
    [companyOptions],
  )

  const resolvePersonLabel = React.useCallback(
    (value: string) => personOptions.find((option) => option.value === value)?.label ?? value,
    [personOptions],
  )

  const companyDisplayValue = companyId ? resolveCompanyLabel(companyId) : ''
  const personDisplayValue = personId ? resolvePersonLabel(personId) : ''

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2" data-testid="service-ticket-company-field">
        <Label htmlFor="service-ticket-company">{companyLabel}</Label>
        <div id="service-ticket-company">
          <ComboboxInput
            key={`company:${companyId ?? ''}:${companyDisplayValue}`}
            value={companyId ?? ''}
            onChange={handleCompanyChange}
            placeholder={companyPlaceholder}
            suggestions={companyOptions}
            loadSuggestions={loadCompanySuggestions}
            resolveLabel={resolveCompanyLabel}
            allowCustomValues={false}
          />
        </div>
        {companyError ? <div className="text-sm text-destructive">{companyError}</div> : null}
      </div>

      <div className="space-y-2" data-testid="service-ticket-contact-field">
        <Label htmlFor="service-ticket-contact">{personLabel}</Label>
        <div id="service-ticket-contact">
          <ComboboxInput
            key={`person:${personId ?? ''}:${personDisplayValue}:${companyId ?? ''}`}
            value={personId ?? ''}
            onChange={(nextValue) => setPersonId(nextValue.trim())}
            placeholder={personPlaceholder}
            suggestions={personOptions}
            loadSuggestions={loadPersonSuggestions}
            resolveLabel={resolvePersonLabel}
            allowCustomValues={false}
            disabled={!companyId}
          />
        </div>
        {personError ? <div className="text-sm text-destructive">{personError}</div> : null}
      </div>
    </div>
  )
}
