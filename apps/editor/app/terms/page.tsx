import { getLegalMetadata, LegalPage } from '../legal-page'

export const dynamic = 'force-dynamic'

export const generateMetadata = () => getLegalMetadata('terms')

export default function TermsPage() {
  return <LegalPage kind="terms" />
}
