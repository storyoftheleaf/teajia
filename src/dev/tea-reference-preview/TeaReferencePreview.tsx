import React from 'react';
import { ArrowUpRight, EnvelopeSimple, Quotes } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type {
  PublicReferenceEntry,
  PublicReferencePreview,
  PublicReferenceStatement,
} from '../../wisdom/receiving/previewImporter';

const formatDate = (value: string): string => {
  const datePart = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${datePart}T00:00:00Z`));
};

const Statement: React.FC<{ statement: PublicReferenceStatement }> = ({ statement }) => (
  <section className="border-t border-tea-border py-5 first:border-t-0 first:pt-0">
    <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{statement.label}</p>
    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 max-w-[68ch] text-tea-text-sec`}>{statement.text}</p>
    {statement.excerpt && (
      <blockquote className="mt-4 grid max-w-[68ch] grid-cols-[20px_minmax(0,1fr)] gap-3 text-tea-text-sec">
        <Quotes aria-hidden size={18} weight="thin" className="mt-1 text-tea-gold" />
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} italic`}>{statement.excerpt}</p>
      </blockquote>
    )}
    <a
      href={statement.citation.url}
      target="_blank"
      rel="noreferrer"
      className={`${TYPOGRAPHY_CLASSES.link} mt-3 inline-flex min-h-[44px] items-center gap-1.5 py-2 text-tea-gold transition-colors hover:text-tea-gold-lt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
    >
      {statement.citation.label}
      <ArrowUpRight aria-hidden size={15} weight="regular" />
    </a>
  </section>
);

const Entry: React.FC<{ entry: PublicReferenceEntry }> = ({ entry }) => (
  <article id={entry.id} className="scroll-mt-8 border-t border-tea-border py-9 first:border-t-0 first:pt-0 md:py-12">
    <div className="grid gap-6 md:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.8fr)] md:gap-12">
      <header>
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{entry.kindLabel}</p>
        <h3 className={`${TYPOGRAPHY_CLASSES.h2} mt-2 text-tea-text`}>{entry.label}</h3>
        <a
          href={entry.reportUrl}
          className={`${TYPOGRAPHY_CLASSES.link} mt-3 inline-flex min-h-[44px] items-center gap-2 py-2 text-tea-text-sec transition-colors hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
        >
          <EnvelopeSimple aria-hidden size={17} weight="regular" />
          Report an inaccuracy
        </a>
      </header>
      <div>
        {entry.statements.length > 0 ? (
          entry.statements.map(statement => <Statement key={statement.id} statement={statement} />)
        ) : (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} max-w-[68ch] text-tea-text-sec`}>
            Source metadata is available for this entry. A concise cited description has not been written yet.
          </p>
        )}
      </div>
    </div>
  </article>
);

const TeaReferencePreview: React.FC<{ data: PublicReferencePreview }> = ({ data }) => (
  <main className="light min-h-[100dvh] overflow-x-clip bg-tea-bg text-tea-text">
    <div aria-hidden className="texture-overlay opacity-[0.025]" />

    <header className="relative border-b border-tea-border">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 py-10 sm:px-7 md:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)] md:px-10 md:py-16 lg:px-14">
        <div className="max-w-[760px]">
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Tea Reference · cited edition</p>
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-4 max-w-[680px] text-tea-text`}>{data.title}</h1>
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} mt-5 max-w-[620px] text-tea-text-sec`}>{data.deck}</p>
          <div className={`${TYPOGRAPHY_CLASSES.label} mt-7 flex flex-wrap gap-x-6 gap-y-2 text-tea-text-dim`}>
            <span>{data.entryCount} reference entries</span>
            <span>{data.sourceCount} cited sources</span>
          </div>
        </div>

        <aside aria-label="Geographic scale" className="self-end border-t border-tea-border pt-5 md:border-t-0 md:border-l md:pl-8 md:pt-0">
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Browse by geographic scale</p>
          <ol className="mt-4 space-y-2">
            {data.geographicScale.map((level, index) => (
              <li key={level.id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-3">
                <span className={`${TYPOGRAPHY_CLASSES.mono} text-tea-gold`}>{String(index + 1).padStart(2, '0')}</span>
                <span className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>{level.label}</span>
                <span className={`${TYPOGRAPHY_CLASSES.mono} figures-tab text-tea-text-dim`}>{level.count}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </header>

    <div className="relative mx-auto grid w-full max-w-[1400px] gap-12 px-4 py-10 sm:px-7 md:px-10 md:py-14 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-14">
      <nav aria-label="Reference contents" className="lg:sticky lg:top-8 lg:self-start">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Contents</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 lg:block lg:space-y-1">
          {data.sections.map(section => (
            <li key={section.id}>
              <a
                href={`#section-${section.id}`}
                className={`${TYPOGRAPHY_CLASSES.link} inline-flex min-h-[44px] items-center gap-2 py-2 text-tea-text-sec transition-colors hover:text-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
              >
                {section.label}
                <span className={`${TYPOGRAPHY_CLASSES.mono} text-tea-text-dim`}>{section.entries.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        {data.sections.map(section => (
          <section key={section.id} id={`section-${section.id}`} className="scroll-mt-8 pb-14 last:pb-0 md:pb-20">
            <header className="mb-8 grid gap-3 border-b border-tea-border pb-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] sm:items-end sm:gap-8">
              <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{section.label}</h2>
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} max-w-[48ch] text-tea-text-sec`}>{section.description}</p>
            </header>
            <div>{section.entries.map(entry => <Entry key={entry.id} entry={entry} />)}</div>
          </section>
        ))}

        <section id="sources" className="border-t border-tea-border pt-10 md:pt-14">
          <div className="grid gap-8 md:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.8fr)] md:gap-12">
            <header>
              <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Bibliography</p>
              <h2 className={`${TYPOGRAPHY_CLASSES.h2} mt-2 text-tea-text`}>Sources</h2>
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-sec`}>
                Publisher and page metadata are shown here. Research snapshots and full evidence remain outside this page.
              </p>
            </header>
            <ol className="divide-y divide-tea-border border-t border-tea-border">
              {data.sources.map((source, index) => (
                <li key={source.sourceId} className="grid gap-2 py-5 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:gap-4">
                  <span className={`${TYPOGRAPHY_CLASSES.mono} figures-tab text-tea-text-dim`}>{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text`}>{source.title || source.publisher}</p>
                    <p className={`${TYPOGRAPHY_CLASSES.link} mt-1 text-tea-text-sec`}>
                      {[source.publisher, source.author, formatDate(source.publishedDate)].filter(Boolean).join(' · ')}
                    </p>
                    <p className={`${TYPOGRAPHY_CLASSES.label} mt-2 text-tea-text-dim`}>{source.publisherRoleLabel}</p>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open source: ${source.title || source.publisher}`}
                    className="tap-target inline-flex h-11 w-11 items-center justify-center text-tea-gold transition-colors hover:text-tea-gold-lt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
                  >
                    <ArrowUpRight aria-hidden size={18} weight="regular" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>

    <footer className="relative border-t border-tea-border">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-8 sm:px-7 md:flex-row md:items-center md:justify-between md:px-10 lg:px-14">
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} max-w-[62ch] text-tea-text-sec`}>
          Reference descriptions are cited and general. They do not describe a particular tea lot or replace personal tasting notes.
        </p>
        <a
          href={data.reportUrl}
          className={`${TYPOGRAPHY_CLASSES.link} inline-flex min-h-[44px] shrink-0 items-center gap-2 py-2 text-tea-gold transition-colors hover:text-tea-gold-lt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
        >
          <EnvelopeSimple aria-hidden size={17} weight="regular" />
          Report an inaccuracy
        </a>
      </div>
    </footer>
  </main>
);

export default TeaReferencePreview;
