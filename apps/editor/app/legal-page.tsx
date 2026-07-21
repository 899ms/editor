import type { Metadata } from 'next'
import Link from 'next/link'
import { getRequestI18n } from '@/lib/server-locale'

type LegalKind = 'privacy' | 'terms'

type LegalBlock = {
  heading?: string
  paragraphs?: string[]
  items?: string[]
  contactPrefix?: string
}

type LegalSection = {
  title: string
  blocks: LegalBlock[]
}

type LegalDocument = {
  title: string
  metadataDescription: string
  sections: LegalSection[]
}

type LegalCommon = {
  home: string
  terms: string
  privacy: string
  effectiveDate: string
  supportEmail: string
}

async function getLegalContent(kind: LegalKind) {
  const { i18n } = await getRequestI18n()
  const common = i18n.t('editor:legal.common', {
    returnObjects: true,
  }) as unknown as LegalCommon
  const document = i18n.t(`editor:legal.${kind}`, {
    returnObjects: true,
  }) as unknown as LegalDocument

  return { common, document }
}

export async function getLegalMetadata(kind: LegalKind): Promise<Metadata> {
  const { document } = await getLegalContent(kind)
  return {
    title: document.title,
    description: document.metadataDescription,
  }
}

export async function LegalPage({ kind }: { kind: LegalKind }) {
  const { common, document } = await getLegalContent(kind)
  const isPrivacy = kind === 'privacy'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/"
            >
              {common.home}
            </Link>
            <span className="text-muted-foreground">/</span>
            {isPrivacy ? (
              <Link
                className="text-muted-foreground transition-colors hover:text-foreground"
                href="/terms"
              >
                {common.terms}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{common.terms}</span>
            )}
            <span className="text-muted-foreground">|</span>
            {isPrivacy ? (
              <span className="font-medium text-foreground">{common.privacy}</span>
            ) : (
              <Link
                className="text-muted-foreground transition-colors hover:text-foreground"
                href="/privacy"
              >
                {common.privacy}
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="mb-2 font-bold text-3xl">{document.title}</h1>
          <p className="mb-8 text-muted-foreground text-sm">{common.effectiveDate}</p>

          {document.sections.map((section) => (
            <section className="mb-8 space-y-4 last:mb-0" key={section.title}>
              <h2 className="font-semibold text-xl">{section.title}</h2>
              {section.blocks.map((block, blockIndex) => (
                <div className="space-y-4" key={`${section.title}-${blockIndex}`}>
                  {block.heading ? (
                    <h3 className="mt-4 font-medium text-lg">{block.heading}</h3>
                  ) : null}
                  {block.paragraphs?.map((paragraph) => (
                    <p className="text-foreground/90 leading-relaxed" key={paragraph}>
                      {paragraph}
                    </p>
                  ))}
                  {block.items?.length ? (
                    <ul className="list-disc space-y-2 pl-6 text-foreground/90">
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {block.contactPrefix ? (
                    <p className="text-foreground/90 leading-relaxed">
                      {block.contactPrefix}{' '}
                      <a
                        className="text-foreground underline hover:text-foreground/80"
                        href={`mailto:${common.supportEmail}`}
                      >
                        {common.supportEmail}
                      </a>
                      .
                    </p>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </article>
      </main>
    </div>
  )
}
