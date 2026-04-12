"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { searchCatalogProducts } from '../../../components/catalogProductOptions'

type ProfileFormValues = {
  id: string
  catalogProductId: string | null
  machineFamily: string | null
  modelCode: string | null
  preventiveMaintenanceIntervalDays: number | null
  defaultWarrantyMonths: number | null
  isActive: boolean
}

type ProfileRecord = Record<string, unknown>

// ─── Service Type types ───────────────────────────────────────────────────────

type ServiceType = {
  id: string
  serviceType: string
  defaultTeamSize: number | null
  defaultServiceDurationMinutes: number | null
  startupNotes: string | null
  serviceNotes: string | null
  sortOrder: number
  skills: string[]
  certifications: string[]
  parts: ServiceTypePart[]
}

type ServiceTypePart = {
  id: string
  catalogProductId: string
  productLabel: string | null
  quantity: number
  sortOrder: number
}

type ProductSuggestion = {
  id: string
  label: string
}

// ─── ServiceTypeCard ──────────────────────────────────────────────────────────

function ServiceTypeCard({
  profileId,
  serviceType: initial,
  onDeleted,
}: {
  profileId: string
  serviceType: ServiceType
  onDeleted: (id: string) => void
}) {
  const t = useT()
  const [expanded, setExpanded] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // Form state
  const [serviceTypeName, setServiceTypeName] = React.useState(initial.serviceType)
  const [teamSize, setTeamSize] = React.useState(initial.defaultTeamSize?.toString() ?? '')
  const [duration, setDuration] = React.useState(initial.defaultServiceDurationMinutes?.toString() ?? '')
  const [startupNotes, setStartupNotes] = React.useState(initial.startupNotes ?? '')
  const [serviceNotes, setServiceNotes] = React.useState(initial.serviceNotes ?? '')

  // Skills
  const [skills, setSkills] = React.useState<string[]>(initial.skills)
  const [skillInput, setSkillInput] = React.useState('')
  const [skillSuggestions, setSkillSuggestions] = React.useState<string[]>([])
  const [showSkillSuggestions, setShowSkillSuggestions] = React.useState(false)

  // Certifications
  const [certs, setCerts] = React.useState<string[]>(initial.certifications)
  const [certInput, setCertInput] = React.useState('')
  const [certSuggestions, setCertSuggestions] = React.useState<string[]>([])
  const [showCertSuggestions, setShowCertSuggestions] = React.useState(false)

  // Parts
  const [parts, setParts] = React.useState<ServiceTypePart[]>(initial.parts)
  const [newPartQty, setNewPartQty] = React.useState('1')
  const [productQuery, setProductQuery] = React.useState('')
  const [productSuggestions, setProductSuggestions] = React.useState<ProductSuggestion[]>([])
  const [showProductSuggestions, setShowProductSuggestions] = React.useState(false)
  const [selectedProduct, setSelectedProduct] = React.useState<ProductSuggestion | null>(null)

  // Autosuggest skills
  React.useEffect(() => {
    if (!skillInput.trim()) { setSkillSuggestions([]); return }
    const t = setTimeout(async () => {
      const res = await apiCall<{ items: string[] }>(
        `/api/machine_catalog/service-type-skills/suggest?q=${encodeURIComponent(skillInput)}`,
        undefined,
        { fallback: { items: [] } },
      )
      setSkillSuggestions(res.result?.items ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [skillInput])

  // Autosuggest certs
  React.useEffect(() => {
    if (!certInput.trim()) { setCertSuggestions([]); return }
    const t = setTimeout(async () => {
      const res = await apiCall<{ items: string[] }>(
        `/api/machine_catalog/service-type-certifications/suggest?q=${encodeURIComponent(certInput)}`,
        undefined,
        { fallback: { items: [] } },
      )
      setCertSuggestions(res.result?.items ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [certInput])

  // Autosuggest catalog products
  React.useEffect(() => {
    if (!productQuery.trim()) { setProductSuggestions([]); return }
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ search: productQuery.trim(), pageSize: '10', productType: 'simple' })
      const res = await apiCall<{ items: Array<Record<string, unknown>> }>(
        `/api/catalog/products?${params.toString()}`,
        undefined,
        { fallback: { items: [] } },
      )
      const items = (res.result?.items ?? []).map((p) => {
        const title = String(p['title'] ?? p['name'] ?? '')
        const sku = String(p['sku'] ?? '')
        const label = sku ? `${title} (${sku})` : title
        return { id: String(p['id']), label }
      }).filter((p) => p.label.length > 0)
      setProductSuggestions(items)
    }, 250)
    return () => clearTimeout(timer)
  }, [productQuery])

  const addSkill = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || skills.includes(trimmed)) { setSkillInput(''); setShowSkillSuggestions(false); return }
    await apiCall(`/api/machine_catalog/service-type-skills`, {
      method: 'POST',
      body: JSON.stringify({ machineServiceTypeId: initial.id, skillName: trimmed }),
    }, { fallback: null })
    setSkills((prev) => [...prev, trimmed])
    setSkillInput('')
    setShowSkillSuggestions(false)
  }

  const removeSkill = async (name: string) => {
    // Fetch skill id by name to delete
    const res = await apiCall<{ items: Array<{ id: string; skill_name: string }> }>(
      `/api/machine_catalog/service-type-skills?machineServiceTypeId=${encodeURIComponent(initial.id)}&pageSize=100`,
      undefined,
      { fallback: { items: [] } },
    )
    const row = (res.result?.items ?? []).find((s) => s.skill_name === name)
    if (row) {
      await apiCall(`/api/machine_catalog/service-type-skills?id=${encodeURIComponent(row.id)}`, { method: 'DELETE', body: JSON.stringify({ id: row.id }) }, { fallback: null })
    }
    setSkills((prev) => prev.filter((s) => s !== name))
  }

  const addCert = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || certs.includes(trimmed)) { setCertInput(''); setShowCertSuggestions(false); return }
    await apiCall(`/api/machine_catalog/service-type-certifications`, {
      method: 'POST',
      body: JSON.stringify({ machineServiceTypeId: initial.id, certificationName: trimmed }),
    }, { fallback: null })
    setCerts((prev) => [...prev, trimmed])
    setCertInput('')
    setShowCertSuggestions(false)
  }

  const removeCert = async (name: string) => {
    const res = await apiCall<{ items: Array<{ id: string; certification_name: string }> }>(
      `/api/machine_catalog/service-type-certifications?machineServiceTypeId=${encodeURIComponent(initial.id)}&pageSize=100`,
      undefined,
      { fallback: { items: [] } },
    )
    const row = (res.result?.items ?? []).find((c) => c.certification_name === name)
    if (row) {
      await apiCall(`/api/machine_catalog/service-type-certifications?id=${encodeURIComponent(row.id)}`, { method: 'DELETE', body: JSON.stringify({ id: row.id }) }, { fallback: null })
    }
    setCerts((prev) => prev.filter((c) => c !== name))
  }

  const addPart = async (product?: ProductSuggestion) => {
    const prod = product ?? selectedProduct
    if (!prod) return
    const qty = parseFloat(newPartQty) || 1
    if (!Number.isFinite(qty) || qty <= 0) return
    // Prevent duplicate
    if (parts.some((p) => p.catalogProductId === prod.id)) {
      flash(t('machine_catalog.service_type.parts.duplicate', 'This product is already added.'), 'error')
      return
    }
    const res = await apiCall<{ id: string }>(`/api/machine_catalog/service-type-parts`, {
      method: 'POST',
      body: JSON.stringify({ machineServiceTypeId: initial.id, catalogProductId: prod.id, quantity: qty }),
    }, { fallback: null })
    if (res.result?.id) {
      setParts((prev) => [...prev, { id: res.result!.id, catalogProductId: prod.id, productLabel: prod.label, quantity: qty, sortOrder: 0 }])
      setSelectedProduct(null)
      setProductQuery('')
      setNewPartQty('1')
      setShowProductSuggestions(false)
    }
  }

  const removePart = async (partId: string) => {
    await apiCall(`/api/machine_catalog/service-type-parts?id=${encodeURIComponent(partId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ id: partId }),
    }, { fallback: null })
    setParts((prev) => prev.filter((p) => p.id !== partId))
  }

  const save = async () => {
    setSaving(true)
    try {
      await apiCall(`/api/machine_catalog/service-types`, {
        method: 'PUT',
        body: JSON.stringify({
          id: initial.id,
          serviceType: serviceTypeName.trim() || initial.serviceType,
          defaultTeamSize: teamSize ? parseInt(teamSize, 10) : null,
          defaultServiceDurationMinutes: duration ? parseInt(duration, 10) : null,
          startupNotes: startupNotes || null,
          serviceNotes: serviceNotes || null,
        }),
      }, { fallback: null })
      flash(t('machine_catalog.service_type.saved', 'Service type saved.'), 'success')
    } catch {
      flash(t('machine_catalog.service_type.saveError', 'Failed to save service type.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteServiceType = async () => {
    if (!confirm(t('machine_catalog.service_type.deleteConfirm', 'Delete this service type?'))) return
    setDeleting(true)
    try {
      await apiCall(`/api/machine_catalog/service-types?id=${encodeURIComponent(initial.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ id: initial.id }),
      }, { fallback: null })
      onDeleted(initial.id)
    } catch {
      flash(t('machine_catalog.service_type.deleteError', 'Failed to delete service type.'), 'error')
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {serviceTypeName}
          </span>
          {initial.defaultTeamSize != null && (
            <span className="text-xs text-muted-foreground">Team: {initial.defaultTeamSize}</span>
          )}
          {initial.defaultServiceDurationMinutes != null && (
            <span className="text-xs text-muted-foreground">{initial.defaultServiceDurationMinutes} min</span>
          )}
          {skills.length > 0 && <span className="text-xs text-muted-foreground">{skills.length} skill(s)</span>}
          {certs.length > 0 && <span className="text-xs text-muted-foreground">{certs.length} cert(s)</span>}
          {parts.length > 0 && <span className="text-xs text-muted-foreground">{parts.length} part(s)</span>}
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('machine_catalog.service_type.fields.serviceType', 'Service Type')}
              </label>
              <input
                type="text"
                value={serviceTypeName}
                onChange={(e) => setServiceTypeName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. regular, commissioning, warranty"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('machine_catalog.service_type.fields.defaultTeamSize', 'Team Size')}
              </label>
              <input
                type="number"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('machine_catalog.service_type.fields.defaultServiceDurationMinutes', 'Duration (min)')}
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                placeholder="e.g. 120"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('machine_catalog.service_type.fields.startupNotes', 'Startup Notes')}
              </label>
              <textarea
                value={startupNotes}
                onChange={(e) => setStartupNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('machine_catalog.service_type.fields.serviceNotes', 'Service Notes')}
              </label>
              <textarea
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Required Skills */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {t('machine_catalog.service_type.fields.requiredSkills', 'Required Skills')}
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {s}
                  <button type="button" onClick={() => void removeSkill(s)} className="text-blue-500 hover:text-blue-700">×</button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => { setSkillInput(e.target.value); setShowSkillSuggestions(true) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addSkill(skillInput) } }}
                onFocus={() => setShowSkillSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSkillSuggestions(false), 150)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('machine_catalog.service_type.skills.placeholder', 'Type skill name, press Enter to add')}
              />
              {showSkillSuggestions && skillSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg">
                  {skillSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => void addSkill(s)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Required Certifications */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {t('machine_catalog.service_type.fields.requiredCertifications', 'Required Certifications')}
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {certs.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {c}
                  <button type="button" onClick={() => void removeCert(c)} className="text-amber-500 hover:text-amber-700">×</button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={certInput}
                onChange={(e) => { setCertInput(e.target.value); setShowCertSuggestions(true) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addCert(certInput) } }}
                onFocus={() => setShowCertSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCertSuggestions(false), 150)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('machine_catalog.service_type.certifications.placeholder', 'Type certification name, press Enter to add')}
              />
              {showCertSuggestions && certSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg">
                  {certSuggestions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={() => void addCert(c)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Service Parts */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              {t('machine_catalog.service_type.fields.serviceParts', 'Service Parts')}
            </label>
            {parts.length > 0 && (
              <div className="space-y-1 mb-3">
                {parts.map((part) => (
                  <div key={part.id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                    <span className="flex-1 truncate font-medium">
                      {part.productLabel || part.catalogProductId}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      x{part.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removePart(part.id)}
                      className="text-destructive hover:text-destructive/80 text-xs shrink-0"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={selectedProduct ? selectedProduct.label : productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value)
                    setSelectedProduct(null)
                    setShowProductSuggestions(true)
                  }}
                  onFocus={() => { if (productQuery.trim()) setShowProductSuggestions(true) }}
                  onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('machine_catalog.service_type.parts.searchPlaceholder', 'Search products by name or SKU...')}
                />
                {showProductSuggestions && productSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                    {productSuggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedProduct(p)
                          setProductQuery('')
                          setShowProductSuggestions(false)
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-accent truncate"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                value={newPartQty}
                onChange={(e) => setNewPartQty(e.target.value)}
                className="w-16 rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-center"
                placeholder={t('machine_catalog.service_type.parts.quantityPlaceholder', 'Qty')}
                min="0.001"
                step="0.001"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void addPart()}
                disabled={!selectedProduct}
              >
                {t('machine_catalog.service_type.parts.add', '+ Part')}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void deleteServiceType()}
              disabled={deleting}
            >
              {deleting ? t('common.deleting', 'Deleting…') : t('machine_catalog.service_type.delete', 'Delete')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? t('common.saving', 'Saving…') : t('machine_catalog.service_type.save', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ServiceTypesSection ──────────────────────────────────────────────────────

function ServiceTypesSection({ profileId }: { profileId: string }) {
  const t = useT()
  const [serviceTypes, setServiceTypes] = React.useState<ServiceType[]>([])
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [newServiceTypeName, setNewServiceTypeName] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const stRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
        `/api/machine_catalog/service-types?machineProfileId=${encodeURIComponent(profileId)}&pageSize=50&sortField=sortOrder&sortDir=asc`,
        undefined,
        { fallback: { items: [] } },
      )
      const stItems = stRes.result?.items ?? []

      // Load skills, certifications, parts for each service type in parallel
      const enriched: ServiceType[] = await Promise.all(
        stItems.map(async (st) => {
          const stId = String(st['id'])
          const [skillsRes, certsRes, partsRes] = await Promise.all([
            apiCall<{ items: Array<{ skill_name: string }> }>(
              `/api/machine_catalog/service-type-skills?machineServiceTypeId=${encodeURIComponent(stId)}&pageSize=100`,
              undefined,
              { fallback: { items: [] } },
            ),
            apiCall<{ items: Array<{ certification_name: string }> }>(
              `/api/machine_catalog/service-type-certifications?machineServiceTypeId=${encodeURIComponent(stId)}&pageSize=100`,
              undefined,
              { fallback: { items: [] } },
            ),
            apiCall<{ items: Array<{ id: string; catalog_product_id: string; quantity: number; sort_order: number }> }>(
              `/api/machine_catalog/service-type-parts?machineServiceTypeId=${encodeURIComponent(stId)}&pageSize=100&sortField=sortOrder&sortDir=asc`,
              undefined,
              { fallback: { items: [] } },
            ),
          ])
          const toNum = (v: unknown): number | null => {
            if (v == null) return null
            const n = Number(v)
            return Number.isFinite(n) ? n : null
          }
          const toStr = (v: unknown): string | null => {
            if (v == null) return null
            const s = String(v)
            return s.length > 0 ? s : null
          }
          return {
            id: stId,
            serviceType: String(st['service_type'] ?? st['serviceType'] ?? ''),
            defaultTeamSize: toNum(st['default_team_size'] ?? st['defaultTeamSize']),
            defaultServiceDurationMinutes: toNum(st['default_service_duration_minutes'] ?? st['defaultServiceDurationMinutes']),
            startupNotes: toStr(st['startup_notes'] ?? st['startupNotes']),
            serviceNotes: toStr(st['service_notes'] ?? st['serviceNotes']),
            sortOrder: toNum(st['sort_order'] ?? st['sortOrder']) ?? 0,
            skills: (skillsRes.result?.items ?? []).map((s: Record<string, unknown>) => String(s['skill_name'] ?? s['skillName'] ?? '')),
            certifications: (certsRes.result?.items ?? []).map((c: Record<string, unknown>) => String(c['certification_name'] ?? c['certificationName'] ?? '')),
            parts: await (async () => {
              const rawParts = (partsRes.result?.items ?? []).map((p: Record<string, unknown>) => ({
                id: String(p['id']),
                catalogProductId: String(p['catalog_product_id'] ?? p['catalogProductId'] ?? ''),
                productLabel: null as string | null,
                quantity: Number(p['quantity'] ?? 0),
                sortOrder: Number(p['sort_order'] ?? p['sortOrder'] ?? 0),
              }))
              // Resolve product labels in batch
              const productIds = rawParts.map((p) => p.catalogProductId).filter(Boolean)
              if (productIds.length > 0) {
                const prodRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
                  `/api/catalog/products?id=${encodeURIComponent(productIds.join(','))}&pageSize=100`,
                  undefined,
                  { fallback: { items: [] } },
                )
                const labelMap = new Map<string, string>()
                for (const p of (prodRes.result?.items ?? [])) {
                  const pid = String(p['id'])
                  const title = String(p['title'] ?? '')
                  const sku = String(p['sku'] ?? '')
                  labelMap.set(pid, sku ? `${title} (${sku})` : title)
                }
                for (const part of rawParts) {
                  part.productLabel = labelMap.get(part.catalogProductId) ?? null
                }
              }
              return rawParts
            })(),
          }
        }),
      )
      setServiceTypes(enriched)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  React.useEffect(() => { void load() }, [load])

  const addServiceType = async () => {
    const name = newServiceTypeName.trim()
    if (!name) return
    setAdding(true)
    try {
      const res = await apiCall<{ id: string }>(`/api/machine_catalog/service-types`, {
        method: 'POST',
        body: JSON.stringify({ machineProfileId: profileId, serviceType: name }),
      }, { fallback: null })
      if (res.result?.id) {
        setServiceTypes((prev) => [...prev, {
          id: res.result!.id,
          serviceType: name,
          defaultTeamSize: null,
          defaultServiceDurationMinutes: null,
          startupNotes: null,
          serviceNotes: null,
          sortOrder: 0,
          skills: [],
          certifications: [],
          parts: [],
        }])
        setNewServiceTypeName('')
        flash(t('machine_catalog.service_type.added', 'Service type added.'), 'success')
      }
    } catch {
      flash(t('machine_catalog.service_type.addError', 'Failed to add service type.'), 'error')
    } finally {
      setAdding(false)
    }
  }

  const onDeleted = (id: string) => {
    setServiceTypes((prev) => prev.filter((st) => st.id !== id))
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">
          {t('machine_catalog.service_types.title', 'Service Types')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t('machine_catalog.service_types.hint', 'Per-service-type defaults, skills, certifications, and required parts')}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : (
        <div className="space-y-2">
          {serviceTypes.map((st) => (
            <ServiceTypeCard
              key={st.id}
              profileId={profileId}
              serviceType={st}
              onDeleted={onDeleted}
            />
          ))}
          {serviceTypes.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              {t('machine_catalog.service_types.empty', 'No service types configured yet.')}
            </p>
          )}
        </div>
      )}

      {/* Add new service type */}
      <div className="flex gap-2 mt-4">
        <input
          type="text"
          value={newServiceTypeName}
          onChange={(e) => setNewServiceTypeName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addServiceType() } }}
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('machine_catalog.service_types.addPlaceholder', 'New service type name (e.g. regular, commissioning)')}
        />
        <Button type="button" onClick={() => void addServiceType()} disabled={adding}>
          {adding ? t('common.adding', 'Adding…') : t('machine_catalog.service_types.add', '+ Add Service Type')}
        </Button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditMachineProfilePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<ProfileFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'catalogProductId', label: t('machine_catalog.form.fields.catalogProductId', 'Catalog Product'), type: 'combobox', placeholder: 'Search products...', loadOptions: searchCatalogProducts, allowCustomValues: false },
    { id: 'machineFamily', label: t('machine_catalog.form.fields.machineFamily', 'Machine Family'), type: 'text' },
    { id: 'modelCode', label: t('machine_catalog.form.fields.modelCode', 'Model Code'), type: 'text' },
    { id: 'preventiveMaintenanceIntervalDays', label: t('machine_catalog.form.fields.preventiveMaintenanceIntervalDays', 'PM Interval (days)'), type: 'number' },
    { id: 'defaultWarrantyMonths', label: t('machine_catalog.form.fields.defaultWarrantyMonths', 'Default Warranty (months)'), type: 'number' },
    { id: 'isActive', label: t('machine_catalog.form.fields.isActive', 'Active'), type: 'checkbox' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'identity', title: t('machine_catalog.form.groups.identity', 'Identity'), column: 1, fields: ['catalogProductId', 'machineFamily', 'modelCode'] },
    { id: 'service', title: t('machine_catalog.form.groups.service', 'Service Defaults'), column: 2, fields: ['preventiveMaintenanceIntervalDays', 'defaultWarrantyMonths'] },
    { id: 'status', title: t('machine_catalog.form.groups.status', 'Status'), column: 2, fields: ['isActive'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<ProfileRecord>('machine_catalog/machine-profiles', { ids: id, pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) throw new Error('Machine profile not found.')
        const str = (camel: string, snake: string) => {
          const v = item[camel] ?? item[snake]
          return typeof v === 'string' ? v as string : null
        }
        const num = (camel: string, snake: string) => {
          const v = item[camel] ?? item[snake]
          return typeof v === 'number' ? v as number : null
        }
        const init: ProfileFormValues = {
          id: String(item.id),
          catalogProductId: str('catalogProductId', 'catalog_product_id'),
          machineFamily: str('machineFamily', 'machine_family'),
          modelCode: str('modelCode', 'model_code'),
          preventiveMaintenanceIntervalDays: num('preventiveMaintenanceIntervalDays', 'preventive_maintenance_interval_days'),
          defaultWarrantyMonths: num('defaultWarrantyMonths', 'default_warranty_months'),
          isActive: (item.isActive ?? item.is_active) === true,
        }
        if (!cancelled) setInitial(init)
      } catch (error) {
        if (!cancelled) setErr(error instanceof Error ? error.message : 'Failed to load.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const fallback = React.useMemo<ProfileFormValues>(() => ({
    id: id ?? '',
    catalogProductId: null,
    machineFamily: null,
    modelCode: null,
    preventiveMaintenanceIntervalDays: null,
    defaultWarrantyMonths: null,
    isActive: true,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600 p-4">{err}</div>
        ) : (
          <>
            <CrudForm<ProfileFormValues>
              title={t('machine_catalog.edit.title', 'Edit Machine Profile')}
              backHref="/backend/machine-catalog"
              cancelHref="/backend/machine-catalog"
              submitLabel={t('machine_catalog.form.submit.save', 'Save')}
              fields={fields}
              groups={groups}
              initialValues={initial ?? fallback}
              isLoading={loading}
              loadingMessage={t('machine_catalog.form.loading', 'Loading...')}
              successRedirect="/backend/machine-catalog"
              onSubmit={async (vals) => { await updateCrud('machine_catalog/machine-profiles', vals) }}
              onDelete={async () => {
                await deleteCrud('machine_catalog/machine-profiles', String(id))
                pushWithFlash(router, '/backend/machine-catalog', 'Machine profile deleted.', 'success')
              }}
            />
            {!loading && <ServiceTypesSection profileId={id} />}
          </>
        )}
      </PageBody>
    </Page>
  )
}
