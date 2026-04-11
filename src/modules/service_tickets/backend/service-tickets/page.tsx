import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import ServiceTicketsTable from '../../components/ServiceTicketsTable'

export default function ServiceTicketsPage() {
  return (
    <Page>
      <PageBody>
        <ServiceTicketsTable />
      </PageBody>
    </Page>
  )
}
