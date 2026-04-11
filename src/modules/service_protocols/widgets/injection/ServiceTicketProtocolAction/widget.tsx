"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ClipboardList, ExternalLink } from 'lucide-react'
import type { InjectionWidgetModule, InjectionWidgetComponentProps } from '@open-mercato/shared/modules/widgets/injection'

type ProtocolListItem = {
  id: string
  protocolNumber: string
  status: string
}

type ProtocolsResponse = {
  items: ProtocolListItem[]
  totalCount?: number
}

const NON_ACTIONABLE_TICKET_STATUSES = ['new', 'cancelled']

function ServiceTicketProtocolActionWidget({ data }: InjectionWidgetComponentProps) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()

  const formValues = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

  // Get ticket id and state from form values (works for both edit and detail contexts)
  const ticketId = (formValues.id ?? formValues.ticketId) as string | undefined
  const ticketStatus = (formValues.status ?? formValues.ticketStatus) as string | undefined
  const staffMemberIds = (formValues.staff_member_ids ?? formValues.staffMemberIds) as string[] | undefined

  // Conditions to show the button
  const statusAllowed = ticketStatus && !NON_ACTIONABLE_TICKET_STATUSES.includes(ticketStatus)
  const hasTechnicians = Array.isArray(staffMemberIds) && staffMemberIds.length > 0

  const canCreateProtocol = !!ticketId && statusAllowed && hasTechnicians

  // Query for existing active protocol
  const { data: protocolData, isLoading: checkingProtocol, refetch } = useQuery<ProtocolsResponse>({
    queryKey: ['service_ticket_protocol_check', ticketId, scopeVersion],
    queryFn: () => fetchCrudList<ProtocolListItem>('service_protocols/protocols', {
      serviceTicketId: ticketId!,
      pageSize: 1,
    }),
    enabled: !!ticketId,
  })

  const activeProtocol = React.useMemo(() => {
    return protocolData?.items?.find((p) => p.status !== 'cancelled') ?? null
  }, [protocolData])

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await apiCall('/api/service_protocols/protocols', {
        method: 'POST',
        body: JSON.stringify({ service_ticket_id: ticketId }),
      }) as { id: string }
      return result
    },
    onSuccess: (result) => {
      flash(t('service_protocols.widget.created'), 'success')
      refetch()
      router.push(`/backend/service-protocols/${result.id}`)
    },
    onError: (err) => {
      flash(err instanceof Error ? err.message : t('service_protocols.widget.error'), 'error')
    },
  })

  // Don't render anything if we don't have a ticket ID yet (new ticket form)
  if (!ticketId) return null

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium">{t('service_protocols.widget.title')}</span>
      </div>

      {checkingProtocol ? (
        <p className="text-sm text-muted-foreground">{t('service_protocols.widget.checking')}</p>
      ) : activeProtocol ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {t('service_protocols.widget.protocolExists')}{' '}
            <span className="font-medium text-foreground">{activeProtocol.protocolNumber}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/backend/service-protocols/${activeProtocol.id}`)}
          >
            <ExternalLink size={14} className="mr-1" />
            {t('service_protocols.widget.openProtocol')}
          </Button>
        </div>
      ) : canCreateProtocol ? (
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <ClipboardList size={14} className="mr-1" />
          {createMutation.isPending
            ? t('service_protocols.widget.creating')
            : t('service_protocols.widget.createProtocol')}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {!statusAllowed
            ? t('service_protocols.widget.statusNotAllowed')
            : !hasTechnicians
              ? t('service_protocols.widget.noTechnicians')
              : t('service_protocols.widget.unavailable')}
        </p>
      )}
    </div>
  )
}

const widget: InjectionWidgetModule<unknown, unknown> = {
  metadata: {
    id: 'service_protocols.injection.ServiceTicketProtocolAction',
    title: 'Service Protocol Action',
    description: 'Create or open a service protocol from a service ticket',
    priority: 50,
    enabled: true,
  },
  Widget: ServiceTicketProtocolActionWidget,
}

export default widget
