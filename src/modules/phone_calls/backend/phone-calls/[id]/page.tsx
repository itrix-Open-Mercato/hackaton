import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import PhoneCallDetail from '../../../components/PhoneCallDetail'

export default function PhoneCallDetailPage({ params }: { params?: { id?: string } }) {
  return (
    <Page>
      <PageBody>
        {params?.id ? <PhoneCallDetail callId={params.id} /> : null}
      </PageBody>
    </Page>
  )
}
