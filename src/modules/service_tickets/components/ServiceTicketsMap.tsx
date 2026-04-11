"use client"
import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { GoogleMap, Marker, InfoWindow, GoogleMarkerClusterer, useJsApiLoader } from '@react-google-maps/api'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { ServiceTicketMapItem, TicketMapResponse } from '../types'

// Poland centroid — fallback when no markers exist
const POLAND_CENTER = { lat: 52.07, lng: 19.48 }
const POLAND_ZOOM = 6
const MAP_CONTAINER_STYLE = { width: '100%', height: '384px' }

function buildClusterIconUrl(count: number): string {
  const label = String(count)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="clusterGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="rgb(180, 243, 114)" />
          <stop offset="50%" stop-color="rgb(238, 251, 99)" />
          <stop offset="100%" stop-color="rgb(188, 154, 255)" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="rgba(92, 76, 145, 0.28)" />
        </filter>
      </defs>
      <circle cx="32" cy="32" r="31" stroke="rgba(188, 154, 255, 0.18)" stroke-width="2" />
      <circle cx="32" cy="32" r="27" stroke="rgba(238, 251, 99, 0.26)" stroke-width="3" />
      <circle cx="32" cy="32" r="23" stroke="rgba(180, 243, 114, 0.34)" stroke-width="3" />
      <circle cx="32" cy="32" r="24" fill="url(#clusterGradient)" stroke="rgba(255,255,255,0.95)" stroke-width="4" filter="url(#shadow)" />
      <circle cx="32" cy="32" r="16" fill="rgba(255,255,255,0.16)" />
      <text x="32" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#2D2342">${label}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

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

function formatVisitDate(value: string, locale?: string): { date: string; time: string } {
  const date = new Date(value)

  return {
    date: new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  }
}

function TicketInfoWindow({ item, onClose, t }: {
  item: ServiceTicketMapItem
  onClose: () => void
  t: (key: string, fallback?: string) => string
}) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined
  const visit = item.visitDate ? formatVisitDate(item.visitDate, locale) : null
  const statusLabel = t(`service_tickets.enum.status.${item.status}`, item.status)
  const serviceTypeLabel = t(`service_tickets.enum.serviceType.${item.serviceType}`, item.serviceType)
  const priorityLabel = t(`service_tickets.enum.priority.${item.priority}`, item.priority)
  const pixelOffset = React.useMemo(() => {
    if (typeof window === 'undefined' || !window.google?.maps) return undefined
    return new window.google.maps.Size(0, -18)
  }, [])

  return (
    <InfoWindow
      position={{ lat: item.latitude, lng: item.longitude }}
      onCloseClick={onClose}
      options={pixelOffset ? { pixelOffset } : undefined}
    >
      <div className="min-w-[260px] max-w-[320px] p-1 text-sm text-slate-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {t('service_tickets.map.popup.ticket', 'Ticket')}
            </p>
            <p className="text-base font-semibold leading-tight text-slate-950">{item.ticketNumber}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
            {statusLabel}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-semibold text-lime-900">
            {serviceTypeLabel}
          </span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-900">
            {priorityLabel}
          </span>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          {visit && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('service_tickets.map.popup.visitDate', 'Visit')}
              </span>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{visit.date}</div>
                <div className="text-xs text-slate-600">{visit.time}</div>
              </div>
            </div>
          )}

          {item.address && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('service_tickets.map.popup.address', 'Address')}
              </span>
              <div className="max-w-[190px] text-right text-xs leading-5 text-slate-700">
                {item.address}
              </div>
            </div>
          )}
        </div>

        <Link
          href={`/backend/service-tickets/${item.id}/edit`}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white no-underline transition hover:bg-slate-800"
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
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'service-tickets-google-map',
    googleMapsApiKey: apiKey,
  })

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
  const markerIcon = React.useMemo<google.maps.Icon | undefined>(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined

    return {
      url: '/map-marker.png',
      scaledSize: new window.google.maps.Size(50, 50),
      anchor: new window.google.maps.Point(25, 25),
    }
  }, [isLoaded])
  const clusterOptions = React.useMemo(
    () => ({
      onClusterClick: (_event: google.maps.MapMouseEvent, cluster: { bounds?: google.maps.LatLngBounds | null; map?: google.maps.Map | null }) => {
        const mapInstance = cluster.map ?? map
        const bounds = cluster.bounds
        if (mapInstance && bounds) {
          mapInstance.fitBounds(bounds)
        }
      },
      renderer: {
        render: ({ count, position }: { count: number; position: google.maps.LatLngLiteral | google.maps.LatLng }) =>
          new window.google.maps.Marker({
            position,
            zIndex: 1000 + count,
            icon: {
              url: buildClusterIconUrl(count),
              scaledSize: new window.google.maps.Size(50, 50),
              anchor: new window.google.maps.Point(32, 32),
            },
            label: undefined,
          }),
      },
    }),
    [map],
  )

  if (!apiKey) {
    return (
      <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {t('service_tickets.map.error.noApiKey', 'Map unavailable: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.')}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {t('service_tickets.map.error.loadSdk', 'Map unavailable: Google Maps could not be loaded.')}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-md border overflow-hidden">
      <div className="px-3 py-2 text-sm font-medium border-b bg-muted/30">
        {t('service_tickets.map.title', 'Ticket locations')}
      </div>

      {!isLoaded && (
        <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          {t('service_tickets.map.loading', 'Loading map…')}
        </div>
      )}

      {isLoaded && isLoading && (
        <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          {t('service_tickets.map.loading', 'Loading map…')}
        </div>
      )}

      {isLoaded && error && !isLoading && (
        <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-destructive/5 text-sm text-destructive px-4">
          {t('service_tickets.map.error.fetch', 'Could not load map data.')}
        </div>
      )}

      {isLoaded && !isLoading && !error && data && (
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
              <GoogleMarkerClusterer options={clusterOptions}>
                {(clusterer) => (
                  <>
                    {data.items.map((item) => (
                      <Marker
                        key={item.id}
                        clusterer={clusterer}
                        position={{ lat: item.latitude, lng: item.longitude }}
                        title={item.ticketNumber}
                        icon={markerIcon}
                        onClick={() => setSelectedId(item.id)}
                      />
                    ))}
                  </>
                )}
              </GoogleMarkerClusterer>
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

      {data?.summary && <MapSummaryBar summary={data.summary} t={t} />}
    </div>
  )
}
