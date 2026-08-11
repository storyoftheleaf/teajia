import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { childrenOf, findRegion, loadCultivarStory, parentsOf } from '../../../wisdom';
import type { Cultivar, CultivarStory } from '../../../wisdom';
import {
  WISDOM_TYPE,
  type WisdomEntryUsage,
  type WisdomFact,
  type WisdomLink,
  type WisdomRun,
  type WisdomSection,
} from './config';
import { WisdomDetailHeader, WisdomRoving } from './WisdomDetailPanel';

/** A museum-catalogue record: values stay plain and readable, never badge-like. */
export const EditorialRecord: React.FC<{ facts: WisdomFact[] }> = ({ facts }) => {
  const present = facts.filter(fact => fact.value !== null && fact.value !== undefined && fact.value !== '');
  if (present.length === 0) return null;
  return (
    <aside className="bg-tea-surface px-5 py-6 sm:px-6 lg:px-7 lg:py-8" aria-label="Record">
      <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Record</h3>
      <div className="mt-2 h-px w-10 bg-tea-gold" aria-hidden="true" />
      <dl className="mt-5 divide-y divide-tea-border" data-testid="wisdom-editorial-record">
        {present.map(fact => (
          <div key={fact.label} className="grid gap-1 py-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4 lg:grid-cols-1 lg:gap-1 xl:grid-cols-[7.5rem_minmax(0,1fr)] xl:gap-4">
            <dt className={WISDOM_TYPE.label}>{fact.label}</dt>
            <dd className="min-w-0 text-ui-13 leading-[1.6] text-tea-text">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
};

const MonographSection: React.FC<{
  id: string;
  title: string;
  tone?: 'canvas' | 'surface' | 'elevated';
  children: React.ReactNode;
}> = ({ id, title, tone = 'canvas', children }) => (
  <section
    data-testid={`wisdom-monograph-${id}`}
    aria-labelledby={`wisdom-monograph-${id}-heading`}
    className={tone === 'surface' ? 'bg-tea-surface' : tone === 'elevated' ? 'bg-tea-elevated' : 'bg-tea-bg'}
  >
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 lg:py-14">
      <header>
        <div className="mb-3 h-px w-10 bg-tea-gold" aria-hidden="true" />
        <h3 id={`wisdom-monograph-${id}-heading`} className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>
          {title}
        </h3>
      </header>
      <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
    </div>
  </section>
);

const ReadingRows: React.FC<{ rows: ReadonlyArray<readonly [string, string | null | undefined]> }> = ({ rows }) => (
  <dl className="divide-y divide-tea-border">
    {rows.filter(([, value]) => Boolean(value)).map(([label, value]) => (
      <div key={label} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-7">
        <dt className={WISDOM_TYPE.label}>{label}</dt>
        <dd className={`${TYPOGRAPHY_CLASSES.bodyLight} max-w-[68ch] text-tea-text-sec`}>{value}</dd>
      </div>
    ))}
  </dl>
);

/** The researched prose, shaped into an authored reference rather than a field grid. */
export const CultivarStoryMonograph: React.FC<{ story: CultivarStory }> = ({ story }) => (
  <>
    {(story.plantType || story.versatility) && (
      <MonographSection id="plant" title="The plant" tone="surface">
        <ReadingRows rows={[
          ['Character', story.plantType],
          ['Versatility', story.versatility],
        ]} />
      </MonographSection>
    )}

    {(story.environment || story.distribution) && (
      <MonographSection id="place" title="Where it grows">
        <ReadingRows rows={[
          ['Environment', story.environment],
          ['Distribution', story.distribution
            ? Object.entries(story.distribution)
                .map(([country, areas]) => `${country.charAt(0).toUpperCase()}${country.slice(1)}: ${areas.join(', ')}`)
                .join('; ')
            : null],
        ]} />
      </MonographSection>
    )}

    {story.sensory && (
      <MonographSection id="cup" title="In the cup" tone="elevated">
        <ReadingRows rows={[
          ['Aroma', story.sensory.aroma],
          ['Flavor', story.sensory.flavor],
          ['Mouthfeel', story.sensory.mouthfeel_liquor],
        ]} />
      </MonographSection>
    )}

    {(story.processing || story.oxidation || story.roasting) && (
      <MonographSection id="making" title="Grown and made">
        <ReadingRows rows={[
          ['Processing', story.processing],
          ['Oxidation', story.oxidation],
          ['Roasting', story.roasting],
        ]} />
      </MonographSection>
    )}

    {story.expressions && (
      <MonographSection id="teas" title="The teas" tone="surface">
        <div className="space-y-8">
          {Object.entries(story.expressions).map(([family, named]) => (
            <div key={family} className="grid gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-7">
              <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text`}>{family}</p>
              <div className="space-y-6">
                {Object.entries(named).map(([name, text]) => (
                  <div key={name}>
                    <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{name}</p>
                    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 max-w-[68ch] text-tea-text-sec`}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </MonographSection>
    )}
  </>
);

interface Props {
  cultivar: Cultivar;
  /** The holding's reader-facing noun when this profile is reached elsewhere. */
  kind?: string;
  /** The holding entry whose authorship and product usage are being reviewed. */
  entryId?: string;
  /** Facts owned by the holding that led into this shared plant profile. */
  additionalFacts?: WisdomFact[];
  onClose: () => void;
  /** Jump the panel to a resolved parent/child without leaving the overlay. */
  onSelectCultivar: (id: string) => void;
  /** Walk a held relation out of this holding: the origin region. */
  jump: (link: WisdomLink) => void;
  /** The prev/next toolbar, supplied by the browser that owns the list. */
  nav?: React.ReactNode;
  /** Which grouped section this cultivar sits in, when the list is grouped. */
  section?: WisdomSection;
  /** Where in the run this cultivar sits, when the run is narrower than the holding. */
  run?: WisdomRun;
  /** This cultivar's page on the public reference. */
  publicHref?: string;
  /** How many products resolve through this cultivar right now. */
  usage?: WisdomEntryUsage;
  relationPanel?: React.ReactNode;
}

/**
 * Full detail for one cultivar: the lean index, the prose fetched on demand
 * from stories/cultivars.json, and its resolved lineage. Read-only.
 *
 * Cultivars use it directly; an exact same-name variety may reuse the research
 * without copying it into a second record. Everything else here is the shared
 * vocabulary: the same head, the same fact grid, the same micro-caps labels.
 *
 * Facts and story sections lay out ACROSS the panel. Only the description keeps
 * a reading measure, because only prose gets harder to read as it gets wider.
 */
export const CultivarDetailPanel: React.FC<Props> = ({
  cultivar, kind = 'Cultivar', entryId = cultivar.id, additionalFacts = [], onClose, onSelectCultivar, jump, nav, section, run, publicHref, usage, relationPanel,
}) => {
  const [story, setStory] = useState<CultivarStory | null>(null);
  const [loadingStory, setLoadingStory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setStory(null);
    setLoadingStory(true);
    loadCultivarStory(cultivar.id).then(result => {
      if (!cancelled) {
        setStory(result);
        setLoadingStory(false);
      }
    });
    return () => { cancelled = true; };
  }, [cultivar.id]);

  const parents = parentsOf(cultivar);
  const children = childrenOf(cultivar);
  const lineageLink = 'tap-target text-ui-13 text-tea-gold underline decoration-tea-border underline-offset-4 transition-colors hover:text-tea-gold-lt hover:decoration-tea-gold';

  /**
   * The origin, split so the region can be walked into.
   *
   * It used to be one joined string, which meant a plant named a place the base
   * holds and offered no way to reach it, while its parents and children were
   * one press away. `findRegion` is the same call resolveTea makes, so a written
   * origin resolves here exactly as it does at import.
   */
  const region = findRegion(cultivar.originRegion);

  return (
    <Modal isOpen onClose={onClose} variant="panel" ariaLabel={cultivar.name} headerActions={nav}>
      <div className="flex-1 min-h-0 overflow-y-auto bg-tea-bg pb-nav-gap-lg">
        <section className="border-b border-tea-border bg-tea-surface">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
          <WisdomDetailHeader
            detail={{
              kind,
              name: cultivar.name,
              chineseName: cultivar.chineseName,
              altNames: cultivar.altNames,
              facts: [],
            }}
            id={entryId}
            section={section}
            run={run}
            publicHref={publicHref}
            usage={usage}
            editorial
          />
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-px bg-tea-border lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]" data-testid="wisdom-monograph-overview">
          <div className="bg-tea-elevated px-4 py-9 sm:px-6 sm:py-11 lg:px-10 lg:py-14">
            {loadingStory ? (
              <div className="animate-pulse space-y-3" aria-label="Loading cultivar research">
                <div className="h-4 w-full bg-tea-surface" />
                <div className="h-4 w-11/12 bg-tea-surface" />
                <div className="h-4 w-4/5 bg-tea-surface" />
              </div>
            ) : story ? (
              <p className={`${TYPOGRAPHY_CLASSES.body} max-w-[62ch] text-tea-text`}>{story.description}</p>
            ) : (
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} max-w-[62ch] text-tea-text-sec`}>
                No written profile has been recorded for this cultivar yet.
              </p>
            )}

            {(parents.length > 0 || children.length > 0) && (
              <div className="mt-9 grid gap-6 border-t border-tea-border pt-7 sm:grid-cols-2">
                {parents.length > 0 && (
                  <div>
                    <p className={WISDOM_TYPE.label}>Lineage</p>
                    <WisdomRoving className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {parents.map((parent, index) =>
                        typeof parent === 'string' ? (
                          <span key={index} className="text-ui-13 leading-[1.6] text-tea-text-sec">{parent}</span>
                        ) : (
                          <button key={parent.id} type="button" onClick={() => onSelectCultivar(parent.id)} className={lineageLink}>
                            {parent.name}
                          </button>
                        ),
                      )}
                    </WisdomRoving>
                  </div>
                )}
                {children.length > 0 && (
                  <div>
                    <p className={WISDOM_TYPE.label}>Descendants</p>
                    <WisdomRoving className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {children.map(child => (
                        <button key={child.id} type="button" onClick={() => onSelectCultivar(child.id)} className={lineageLink}>
                          {child.name}
                        </button>
                      ))}
                    </WisdomRoving>
                  </div>
                )}
              </div>
            )}
          </div>

          <EditorialRecord
            facts={[
              ...additionalFacts,
              {
                label: 'Region',
                value: cultivar.originRegion && (
                  region ? (
                    <button type="button" onClick={() => jump({ holding: 'regions', entry: region.id })} className={lineageLink}>
                      {cultivar.originRegion}
                    </button>
                  ) : cultivar.originRegion
                ),
              },
              { label: 'Country', value: cultivar.originCountry },
              { label: 'Developed', value: cultivar.developedYear },
              { label: 'Parentage', value: cultivar.parentage },
            ]}
          />
        </section>

        {story && <CultivarStoryMonograph story={story} />}
        {relationPanel && <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{relationPanel}</div>}
      </div>
    </Modal>
  );
};
