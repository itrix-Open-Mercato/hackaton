"use client"

import * as React from 'react'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  buildMachineLabel,
  fetchMachineById,
  fetchMachinePartTemplates,
  fetchMachineProfileByCatalogProductId,
  formatMachineAddress,
  mergeMachineOptions,
  searchMachines,
  type MachineLookupRecord,
  type MachineOption,
  type MachinePartTemplateRecord,
  type MachineProfileRecord,
} from './machineOptions'

type MachineCascadeSelectMessages = {
  loading: string
  profileTitle: string
  emptyProfile: string
  machineModelLabel: string
  locationLabel: string
  serviceDurationLabel: string
  maintenanceIntervalLabel: string
  serviceNotesLabel: string
  partsTitle: string
  emptyParts: string
}

type MachineCascadeSelectProps = {
  machineId?: string | null
  customerId?: string | null
  contactPersonId?: string | null
  address?: string | null
  label: string
  placeholder: string
  error?: string
  messages: MachineCascadeSelectMessages
  setMachineId: (value: string) => void
  setCustomerId: (value: string) => void
  setContactPersonId: (value: string) => void
  setAddress: (value: string) => void
}

function formatDuration(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes)) return null
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? '1 h' : `${hours} h`
  }
  return `${minutes} min`
}

function formatInterval(days: number | null): string | null {
  if (days === null || !Number.isFinite(days)) return null
  return `${days} d`
}

function formatPartTemplate(part: MachinePartTemplateRecord): string {
  const quantity = part.quantityDefault ? `${part.quantityDefault}${part.quantityUnit ? ` ${part.quantityUnit}` : ''}` : null
  const meta = [part.kitName, part.serviceContext, part.partCode, quantity]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' • ')

  return meta ? `${part.partName} (${meta})` : part.partName
}

export default function MachineCascadeSelect({
  machineId,
  customerId,
  contactPersonId,
  address,
  label,
  placeholder,
  error,
  messages,
  setMachineId,
  setCustomerId,
  setContactPersonId,
  setAddress,
}: MachineCascadeSelectProps) {
  const [machineOptions, setMachineOptions] = React.useState<MachineOption[]>([])
  const [selectedMachine, setSelectedMachine] = React.useState<MachineLookupRecord | null>(null)
  const [profile, setProfile] = React.useState<MachineProfileRecord | null>(null)
  const [partTemplates, setPartTemplates] = React.useState<MachinePartTemplateRecord[]>([])
  const [loadingHints, setLoadingHints] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function ensureMachineLabel() {
      if (!machineId) {
        setSelectedMachine(null)
        return
      }

      const existingOption = machineOptions.find((option) => option.value === machineId)
      if (existingOption) {
        setSelectedMachine(existingOption.record)
        return
      }

      try {
        const option = await fetchMachineById(machineId)
        if (!cancelled && option) {
          setMachineOptions((current) => mergeMachineOptions(current, [option]))
          setSelectedMachine(option.record)
        }
      } catch {
        if (!cancelled) {
          setSelectedMachine(null)
        }
      }
    }

    void ensureMachineLabel()

    return () => {
      cancelled = true
    }
  }, [machineId, machineOptions])

  React.useEffect(() => {
    let cancelled = false

    async function loadHints() {
      if (!selectedMachine?.catalogProductId) {
        setProfile(null)
        setPartTemplates([])
        return
      }

      setLoadingHints(true)

      try {
        const nextProfile = await fetchMachineProfileByCatalogProductId(selectedMachine.catalogProductId)
        if (cancelled) return

        setProfile(nextProfile)

        if (!nextProfile) {
          setPartTemplates([])
          return
        }

        const nextParts = await fetchMachinePartTemplates(nextProfile.id)
        if (!cancelled) {
          setPartTemplates(nextParts)
        }
      } catch {
        if (!cancelled) {
          setProfile(null)
          setPartTemplates([])
        }
      } finally {
        if (!cancelled) setLoadingHints(false)
      }
    }

    void loadHints()

    return () => {
      cancelled = true
    }
  }, [selectedMachine])

  const loadMachineSuggestions = React.useCallback(async (query?: string) => {
    const nextOptions = await searchMachines(query ?? '')
    setMachineOptions((current) => mergeMachineOptions(current, nextOptions))
    return nextOptions
  }, [])

  const resolveMachineLabel = React.useCallback(
    (value: string) => machineOptions.find((option) => option.value === value)?.label ?? value,
    [machineOptions],
  )

  const applyMachineSelection = React.useCallback((record: MachineLookupRecord | null, nextMachineId: string) => {
    setMachineId(nextMachineId)
    setSelectedMachine(record)

    if (!record) return

    if (record.customerCompanyId && record.customerCompanyId !== customerId) {
      setCustomerId(record.customerCompanyId)
      if (contactPersonId) {
        setContactPersonId('')
      }
    }

    const nextAddress = formatMachineAddress(record)
    if ((!address || address.trim().length === 0) && nextAddress) {
      setAddress(nextAddress)
    }
  }, [
    address,
    contactPersonId,
    customerId,
    setAddress,
    setContactPersonId,
    setCustomerId,
    setMachineId,
  ])

  const handleMachineChange = React.useCallback(async (nextValue: string) => {
    const normalized = nextValue.trim()
    if (!normalized) {
      applyMachineSelection(null, '')
      return
    }

    const option = machineOptions.find((candidate) => candidate.value === normalized) ?? null
    if (option) {
      applyMachineSelection(option.record, normalized)
      return
    }

    try {
      const fetchedOption = await fetchMachineById(normalized)
      if (fetchedOption) {
        setMachineOptions((current) => mergeMachineOptions(current, [fetchedOption]))
      }
      applyMachineSelection(fetchedOption?.record ?? null, normalized)
    } catch {
      applyMachineSelection(null, normalized)
    }
  }, [applyMachineSelection, machineOptions])

  const machineModel = React.useMemo(() => {
    if (!profile) return null
    const values = [profile.machineFamily, profile.modelCode]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    return values.length > 0 ? values.join(' • ') : null
  }, [profile])

  const suggestedLocation = selectedMachine ? formatMachineAddress(selectedMachine) : null
  const duration = formatDuration(profile?.defaultServiceDurationMinutes ?? null)
  const interval = formatInterval(profile?.preventiveMaintenanceIntervalDays ?? null)
  const machineDisplayValue = machineId ? resolveMachineLabel(machineId) : ''
  const showHints = Boolean(machineId)

  return (
    <div className="space-y-3">
      <div className="space-y-2" data-testid="service-ticket-machine-field">
        <Label htmlFor="service-ticket-machine">{label}</Label>
        <div id="service-ticket-machine">
          <ComboboxInput
            key={`machine:${machineId ?? ''}:${machineDisplayValue}`}
            value={machineId ?? ''}
            onChange={handleMachineChange}
            placeholder={placeholder}
            suggestions={machineOptions}
            loadSuggestions={loadMachineSuggestions}
            resolveLabel={resolveMachineLabel}
            allowCustomValues={false}
          />
        </div>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </div>

      {showHints ? (
        <div
          className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm"
          data-testid="service-ticket-machine-hints"
        >
          <div className="font-medium">{messages.profileTitle}</div>
          <div className="mt-1 text-muted-foreground">{selectedMachine ? buildMachineLabel(selectedMachine) : machineId}</div>

          {loadingHints ? <div className="mt-3 text-muted-foreground">{messages.loading}</div> : null}

          {!loadingHints ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                {machineModel ? (
                  <div>
                    <span className="font-medium">{messages.machineModelLabel}:</span> {machineModel}
                  </div>
                ) : null}
                {suggestedLocation ? (
                  <div>
                    <span className="font-medium">{messages.locationLabel}:</span> {suggestedLocation}
                  </div>
                ) : null}
                {duration ? (
                  <div>
                    <span className="font-medium">{messages.serviceDurationLabel}:</span> {duration}
                  </div>
                ) : null}
                {interval ? (
                  <div>
                    <span className="font-medium">{messages.maintenanceIntervalLabel}:</span> {interval}
                  </div>
                ) : null}
                {profile?.serviceNotes ? (
                  <div>
                    <span className="font-medium">{messages.serviceNotesLabel}:</span> {profile.serviceNotes}
                  </div>
                ) : null}
                {!profile && <div className="text-muted-foreground">{messages.emptyProfile}</div>}
              </div>

              <div className="space-y-1">
                <div className="font-medium">{messages.partsTitle}</div>
                {partTemplates.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {partTemplates.map((part) => (
                      <li key={part.id}>{formatPartTemplate(part)}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground">{messages.emptyParts}</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
