"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { TillioSettingsView } from '../types'

type FormValues = {
  api_base_url: string
  plugin: string
  system: string
  tenant: string
  tenant_domain: string
  api_key: string
  provider_key: string
  token: string
}

function emptyValues(): FormValues {
  return {
    api_base_url: 'https://api.tillio.io',
    plugin: 'Ringostat',
    system: '',
    tenant: '',
    tenant_domain: '',
    api_key: '',
    provider_key: '',
    token: '',
  }
}

function valuesFromSettings(settings: TillioSettingsView | null): FormValues {
  const values = emptyValues()
  if (!settings) return values
  return {
    ...values,
    api_base_url: settings.apiBaseUrl || values.api_base_url,
    plugin: settings.plugin || values.plugin,
    system: settings.system || '',
    tenant: settings.tenant || '',
    tenant_domain: settings.tenantDomain || '',
  }
}

export default function TillioSettingsForm() {
  const t = useT()
  const router = useRouter()
  const [values, setValues] = React.useState<FormValues>(emptyValues)
  const [saving, setSaving] = React.useState(false)

  const { data, isLoading, error } = useQuery<TillioSettingsView>({
    queryKey: ['phone_calls', 'settings', 'tillio'],
    queryFn: () => readApiResultOrThrow<TillioSettingsView>('/api/phone_calls/settings/tillio'),
  })

  React.useEffect(() => {
    if (data) setValues(valuesFromSettings(data))
  }, [data])

  const update = (key: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiCallOrThrow('/api/phone_calls/settings/tillio', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      flash(t('phone_calls.settings.flash.saved'), 'success')
      router.push('/backend/phone-calls')
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.settings.error.save')
      flash(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <LoadingMessage label={t('phone_calls.settings.loading')} />
  if (error) return <ErrorMessage label={t('phone_calls.settings.error.load')} />

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('phone_calls.settings.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('phone_calls.settings.description')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tillio-api-base-url">{t('phone_calls.settings.fields.apiBaseUrl')}</Label>
          <Input id="tillio-api-base-url" value={values.api_base_url} onChange={update('api_base_url')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tillio-plugin">{t('phone_calls.settings.fields.plugin')}</Label>
          <Input id="tillio-plugin" value={values.plugin} onChange={update('plugin')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tillio-system">{t('phone_calls.settings.fields.system')}</Label>
          <Input id="tillio-system" value={values.system} onChange={update('system')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tillio-tenant">{t('phone_calls.settings.fields.tenant')}</Label>
          <Input id="tillio-tenant" value={values.tenant} onChange={update('tenant')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tillio-tenant-domain">{t('phone_calls.settings.fields.tenantDomain')}</Label>
          <Input id="tillio-tenant-domain" value={values.tenant_domain} onChange={update('tenant_domain')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tillio-api-key">{t('phone_calls.settings.fields.apiKey')}</Label>
          <Input
            id="tillio-api-key"
            value={values.api_key}
            onChange={update('api_key')}
            type="password"
            required={!data?.hasApiKey}
            placeholder={data?.hasApiKey ? t('phone_calls.settings.fields.apiKeyStored') : ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tillio-provider-key">{t('phone_calls.settings.fields.providerKey')}</Label>
          <Input
            id="tillio-provider-key"
            value={values.provider_key}
            onChange={update('provider_key')}
            type="password"
            required={!data?.hasProviderKey}
            placeholder={data?.hasProviderKey ? t('phone_calls.settings.fields.providerKeyStored') : ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tillio-token">{t('phone_calls.settings.fields.token')}</Label>
          <Input
            id="tillio-token"
            value={values.token}
            onChange={update('token')}
            type="password"
            placeholder={data?.hasToken ? t('phone_calls.settings.fields.tokenStored') : t('phone_calls.settings.fields.tokenPlaceholder')}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>{saving ? t('phone_calls.settings.actions.saving') : t('phone_calls.settings.actions.save')}</Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/backend/phone-calls')}>
          {t('phone_calls.settings.actions.cancel')}
        </Button>
      </div>
    </form>
  )
}
