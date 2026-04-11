"use client"

import * as React from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { DiscrepancyDisplay } from './DiscrepancyDisplay'

interface OpenTicketFormButtonProps {
  actionId: string
  proposalId: string
  actionType: string
  payload: Record<string, unknown>
  /** Test hook — override navigation. Defaults to window.location.assign */
  onNavigate?: (url: string) => void
}

export function OpenTicketFormButton({ actionId, proposalId, actionType, payload, onNavigate }: OpenTicketFormButtonProps) {
  if (actionType !== 'create_service_ticket') return null

  const handleClick = () => {
    try {
      sessionStorage.setItem(
        'inbox_ops.serviceTicketDraft',
        JSON.stringify({ actionId, proposalId, payload }),
      )
    } catch {
      // sessionStorage unavailable — navigation still proceeds
    }
    const url = `/backend/service-tickets/create?fromInboxAction=${encodeURIComponent(actionId)}`
    if (onNavigate) {
      onNavigate(url)
    } else {
      window.location.assign(url)
    }
  }

  const discrepancies = payload._discrepancies as Array<{ type: string; message: string }> | undefined

  return (
    <div className="space-y-2">
      <DiscrepancyDisplay discrepancies={discrepancies} />
      <Button type="button" size="sm" className="h-11 md:h-9" onClick={handleClick}>
        <FileText className="h-4 w-4 mr-1" />
        Open Ticket Form
      </Button>
    </div>
  )
}

export default OpenTicketFormButton
