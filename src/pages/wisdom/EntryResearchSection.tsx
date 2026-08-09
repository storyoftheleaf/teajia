import React from 'react';
import { resolveTermLabel, TASTING_CATEGORY_ORDER } from '../../data/tastingTaxonomy';
import {
  getEntryCitations,
  getEntryPotentialProfile,
  getEntryResearchSources,
  RESEARCH_BUNDLE,
  type PublicResearchBundle,
} from '../../wisdom/research';
import type { WisdomEntryKind, WisdomPotentialTasting } from '../../wisdom/types';
import {
  AXIS_INDENT,
  CELL_CLASS,
  FACT_CLASS,
  GROUND,
  LABEL,
  MEASURE,
  QUIET_LINK,
  SectionHead,
  SPACE,
} from './wisdomShared';

interface EntryResearchSectionProps {
  entryKind: WisdomEntryKind;
  entryId: string;
  bundle?: PublicResearchBundle;
}

const PROFILE_LABELS: Record<keyof WisdomPotentialTasting, string> = {
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feeling',
  flavor: 'Flavour',
  'liquor-color': 'Liquor',
  brewing: 'Brewing',
};

function readableDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export const EntryResearchSection: React.FC<EntryResearchSectionProps> = ({
  entryKind,
  entryId,
  bundle = RESEARCH_BUNDLE,
}) => {
  const citations = getEntryCitations(bundle, entryKind, entryId);
  const sources = getEntryResearchSources(bundle, entryKind, entryId);
  const candidateProfile = getEntryPotentialProfile(bundle, entryKind, entryId);
  const citationIds = new Set(citations.map(citation => citation.id));
  const profile = candidateProfile?.citationIds.some(id => citationIds.has(id))
    ? candidateProfile
    : null;

  if (!profile && sources.length === 0) return null;

  return (
    <>
      {profile && (
        <section className={`${SPACE.section} ${GROUND} py-6`}>
          <SectionHead label="Potential profile" />
          <div className={`${AXIS_INDENT} flex max-w-[66ch] flex-wrap gap-x-8 gap-y-4`}>
            {TASTING_CATEGORY_ORDER.map(category => {
              const terms = profile.tasting[category];
              if (!terms?.length) return null;
              return (
                <div key={category} className="min-w-[8rem] max-w-full">
                  <p className={LABEL}>{PROFILE_LABELS[category]}</p>
                  <p className={`${FACT_CLASS} mt-1 text-tea-text`}>
                    {terms.map(resolveTermLabel).join(' · ')}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section className={`${SPACE.section} ${GROUND} py-6`}>
          <SectionHead label="Research sources" count={sources.length} />
          <ul className={`${AXIS_INDENT} ${MEASURE} m-0 list-none p-0`}>
            {sources.map(source => {
              const qualifications = citations
                .filter(citation => citation.sourceIds.includes(source.id) && citation.qualification)
                .map(citation => citation.qualification as string);
              return (
                <li key={source.id} className="border-t border-tea-border py-4 first:border-t-0 first:pt-0">
                  <p className={`${FACT_CLASS} text-tea-text`}>
                    <span>{source.publisher}. </span>
                    {source.url ? (
                      <a
                        href={source.url}
                        className={`${QUIET_LINK} inline-flex min-h-[44px] items-center`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.title}
                      </a>
                    ) : (
                      <span>{source.title}</span>
                    )}
                  </p>
                  <p className={`${CELL_CLASS} mt-1 text-tea-text-dim`}>
                    {`Accessed ${readableDate(source.accessedAt)}`}
                  </p>
                  {qualifications.map(qualification => (
                    <p key={qualification} className={`${FACT_CLASS} mt-2 text-tea-text-sec`}>
                      {qualification}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
};

export default EntryResearchSection;
