"use client"
import dynamic from 'next/dynamic'
import ServiceTicketsTable from './ServiceTicketsTable'
import { useTicketFilters } from './useTicketFilters'

const ServiceTicketsMap = dynamic(() => import('./ServiceTicketsMap'), { ssr: false })

export default function ServiceTicketsListView() {
  const filters = useTicketFilters()

  return (
    <>
      <ServiceTicketsTable filters={filters} />
      <ServiceTicketsMap filterParams={filters.filterParams} />
    </>
  )
}
