import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import TillioSettingsForm from '../../../components/TillioSettingsForm'

export default function PhoneCallsSettingsPage() {
  return (
    <Page>
      <PageBody>
        <TillioSettingsForm />
      </PageBody>
    </Page>
  )
}
