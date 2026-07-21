import { getLegalMetadata, LegalPage } from '../legal-page'

export const dynamic = 'force-dynamic'

export const generateMetadata = () => getLegalMetadata('privacy')

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />
}
