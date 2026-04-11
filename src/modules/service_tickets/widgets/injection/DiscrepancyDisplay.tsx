"use client"

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

interface Discrepancy {
  type: string
  message: string
}

interface DiscrepancyDisplayProps {
  discrepancies?: Discrepancy[]
}

const LABELS: Record<string, string> = {
  unknown_contact: 'Unknown sender',
  ambiguous_customer: 'Ambiguous customer',
  machine_not_found: 'Machine not found',
}

export function DiscrepancyDisplay({ discrepancies }: DiscrepancyDisplayProps) {
  if (!discrepancies || discrepancies.length === 0) return null

  return (
    <div className="space-y-1">
      {discrepancies.map((d, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            <strong>{LABELS[d.type] ?? d.type}:</strong> {d.message}
          </span>
        </div>
      ))}
    </div>
  )
}

export default DiscrepancyDisplay
