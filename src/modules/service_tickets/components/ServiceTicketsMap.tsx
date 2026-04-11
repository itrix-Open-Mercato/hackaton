"use client"
import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { ServiceTicketMapItem, TicketMapResponse } from '../types'

// Poland centroid — fallback when no markers exist
const POLAND_CENTER = { lat: 52.07, lng: 19.48 }
const POLAND_ZOOM = 6
const MAP_CONTAINER_STYLE = { width: '100%', height: '384px' }

async function fetchMapData(filterParams: string): Promise<TicketMapResponse> {
  const url = `/api/service_tickets/tickets/map${filterParams ? `?${filterParams}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`)
  return res.json()
}

function MapSummaryBar({ summary, t }: {
  summary: TicketMapResponse['summary']
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted-foreground bg-muted/40 border-t">
      <span>{t('service_tickets.map.summary.total', 'Total')}: <strong>{summary.totalFiltered}</strong></span>
      <span>{t('service_tickets.map.summary.mapped', 'On map')}: <strong>{summary.mapped}</strong></span>
      {summary.unmapped > 0 && (
        <span className="text-amber-600">
          {t('service_tickets.map.summary.unmapped', 'No location')}: <strong>{summary.unmapped}</strong>
        </span>
      )}
      {summary.truncated && (
        <span className="text-amber-600 font-medium">
          ⚠ {t('service_tickets.map.summary.truncated', `Showing first ${summary.cappedAt} of ${summary.totalFiltered} located tickets`)}
        </span>
      )}
    </div>
  )
}

function TicketInfoWindow({ item, onClose, t }: {
  item: ServiceTicketMapItem
  onClose: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <InfoWindow
      position={{ lat: item.latitude, lng: item.longitude }}
      onCloseClick={onClose}
    >
      <div className="text-sm min-w-[200px]">
        <p className="font-semibold mb-1">{item.ticketNumber}</p>
        <p className="text-muted-foreground mb-0.5">
          {t('service_tickets.map.popup.status', 'Status')}: {item.status}
        </p>
        <p className="text-muted-foreground mb-0.5">
          {t('service_tickets.map.popup.type', 'Type')}: {item.serviceType}
        </p>
        {item.visitDate && (
          <p className="text-muted-foreground mb-0.5">
            {t('service_tickets.map.popup.visitDate', 'Visit')}: {new Date(item.visitDate).toLocaleDateString()}
          </p>
        )}
        {item.address && (
          <p className="text-muted-foreground mb-1 text-xs">{item.address}</p>
        )}
        <Link
          href={`/backend/service-tickets/${item.id}/edit`}
          className="text-primary underline text-xs"
        >
          {t('service_tickets.map.popup.open', 'Open ticket')}
        </Link>
      </div>
    </InfoWindow>
  )
}

export default function ServiceTicketsMap({ filterParams }: { filterParams: string }) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [map, setMap] = React.useState<google.maps.Map | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  const { data, isLoading, error } = useQuery<TicketMapResponse>({
    queryKey: ['service_tickets_map', filterParams, scopeVersion],
    queryFn: () => fetchMapData(filterParams),
  })

  // Fit bounds whenever markers change
  React.useEffect(() => {
    if (!map || !data?.items.length) return
    const bounds = new window.google.maps.LatLngBounds()
    data.items.forEach((item) => bounds.extend({ lat: item.latitude, lng: item.longitude }))
    map.fitBounds(bounds)
  }, [map, data?.items])

  const selectedItem = data?.items.find((i) => i.id === selectedId) ?? null

  if (!apiKey) {
    return (
      <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {t('service_tickets.map.error.noApiKey', 'Map unavailable: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.')}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-md border overflow-hidden">
      <div className="px-3 py-2 text-sm font-medium border-b bg-muted/30">
        {t('service_tickets.map.title', 'Ticket locations')}
      </div>

      <LoadScript googleMapsApiKey={apiKey} loadingElement={<div />}>
        {isLoading && (
          <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-muted/20 text-sm text-muted-foreground">
            {t('service_tickets.map.loading', 'Loading map…')}
          </div>
        )}

        {error && !isLoading && (
          <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-destructive/5 text-sm text-destructive px-4">
            {t('service_tickets.map.error.fetch', 'Could not load map data.')}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {data.items.length === 0 ? (
              <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-muted/20 text-sm text-muted-foreground">
                {t('service_tickets.map.empty', 'No located tickets match the current filters.')}
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={POLAND_CENTER}
                zoom={POLAND_ZOOM}
                onLoad={(m) => setMap(m)}
                onUnmount={() => setMap(null)}
                onClick={() => setSelectedId(null)}
              >
                {data.items.map((item) => (
                  <Marker
                    key={item.id}
                    position={{ lat: item.latitude, lng: item.longitude }}
                    title={item.ticketNumber}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))}
                {selectedItem && (
                  <TicketInfoWindow
                    item={selectedItem}
                    onClose={() => setSelectedId(null)}
                    t={t}
                  />
                )}
              </GoogleMap>
            )}
          </>
        )}
      </LoadScript>

      {data?.summary && <MapSummaryBar summary={data.summary} t={t} />}
    </div>
  )
}
