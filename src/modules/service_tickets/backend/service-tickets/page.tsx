import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import ServiceTicketsListView from '../../components/ServiceTicketsListView'

export default function ServiceTicketsPage() {
  return (
    <Page>
      <PageBody>
        <ServiceTicketsListView />
      </PageBody>
    </Page>
  )
}
