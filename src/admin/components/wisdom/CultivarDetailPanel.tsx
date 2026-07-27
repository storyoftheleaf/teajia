import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { childrenOf, findRegion, loadCultivarStory, parentsOf } from '../../../wisdom';
import type { Cultivar, CultivarStory } from '../../../wisdom';
import { WISDOM_TYPE, type WisdomLink, type WisdomSection } from './config';
import { FactGrid, LabelledBlock, WisdomChip, WisdomDetailHeader } from './WisdomDetailPanel';

interface Props {
  cultivar: Cultivar;
  onClose: () => void;
  /** Jump the panel to a resolved parent/child without leaving the overlay. */
  onSelectCultivar: (id: string) => void;
  /** Walk a held relation out of this holding: the origin region. */
  jump: (link: WisdomLink) => void;
  /** The prev/next toolbar, supplied by the browser that owns the list. */
  nav?: React.ReactNode;
  /** Which grouped section this cultivar sits in, when the list is grouped. */
  section?: WisdomSection;
  /** This cultivar's page on the public reference. */
  publicHref?: string;
}

/**
 * Full detail for one cultivar: the lean index, the prose fetched on demand
 * from stories/cultivars.json, and its resolved lineage. Read-only.
 *
 * The one holding whose panel is not generic, because lineage links jump the
 * panel to another entry. Everything else here is the shared vocabulary: the
 * same head, the same fact grid, the same micro-caps labels.
 *
 * Facts and story sections lay out ACROSS the panel. Only the description keeps
 * a reading measure, because only prose gets harder to read as it gets wider.
 */
export const CultivarDetailPanel: React.FC<Props> = ({
  cultivar, onClose, onSelectCultivar, jump, nav, section, publicHref,
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
  const lineageChip = 'text-ui-12 rounded-md px-2 py-1';

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
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-nav-gap sm:px-6">
        <div className="mx-auto max-w-5xl pb-8">
          <WisdomDetailHeader
            detail={{
              kind: 'Cultivar',
              name: cultivar.name,
              chineseName: cultivar.chineseName,
              altNames: cultivar.altNames,
              facts: [],
            }}
            id={cultivar.id}
            section={section}
            publicHref={publicHref}
          />

          <FactGrid
            className="mt-5 border-t border-tea-border pt-5"
            facts={[
              {
                label: 'Region',
                value: cultivar.originRegion && (
                  <WisdomChip
                    label={cultivar.originRegion}
                    onClick={region ? () => jump({ holding: 'regions', entry: region.id }) : undefined}
                  />
                ),
              },
              { label: 'Country', value: cultivar.originCountry },
              { label: 'Developed', value: cultivar.developedYear },
              { label: 'Parentage', value: cultivar.parentage },
            ]}
          />

          {(parents.length > 0 || children.length > 0) && (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {parents.length > 0 && (
                <LabelledBlock label="Parents">
                  <div className="flex flex-wrap gap-1.5">
                    {parents.map((parent, index) =>
                      typeof parent === 'string' ? (
                        <span key={index} className={`${lineageChip} text-tea-text-sec bg-tea-surface`}>
                          {parent}
                        </span>
                      ) : (
                        <button
                          key={parent.id}
                          type="button"
                          onClick={() => onSelectCultivar(parent.id)}
                          className={`tap-target ${lineageChip} text-tea-gold hover:text-tea-gold-lt bg-tea-accent-sub transition-colors`}
                        >
                          {parent.name}
                        </button>
                      ),
                    )}
                  </div>
                </LabelledBlock>
              )}
              {children.length > 0 && (
                <LabelledBlock label="Children">
                  <div className="flex flex-wrap gap-1.5">
                    {children.map(child => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onSelectCultivar(child.id)}
                        className={`tap-target ${lineageChip} text-tea-gold hover:text-tea-gold-lt bg-tea-accent-sub transition-colors`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                </LabelledBlock>
              )}
            </div>
          )}

          <div className="mt-8 border-t border-tea-border pt-6">
            {loadingStory ? (
              <div className="flex items-center gap-2 py-6 text-tea-text-dim">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-ui-13">Loading story...</span>
              </div>
            ) : !story ? (
              <p className="py-6 text-ui-13 text-tea-text-dim">No prose recorded for this cultivar yet.</p>
            ) : (
              <div className="space-y-8">
                <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text max-w-2xl`}>{story.description}</p>

                <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ['Plant', story.plantType],
                    ['Environment', story.environment],
                    ['Processing', story.processing],
                    ['Oxidation', story.oxidation],
                    ['Roasting', story.roasting],
                    ['Versatility', story.versatility],
                  ] as const)
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <LabelledBlock key={label} label={label}>
                        <p className="text-ui-13 text-tea-text-sec leading-[1.6]">{value}</p>
                      </LabelledBlock>
                    ))}
                </div>

                {(story.sensory || story.distribution) && (
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    {story.sensory && (
                      <LabelledBlock label="Sensory">
                        <div className="space-y-1.5 text-ui-13 text-tea-text-sec leading-[1.6]">
                          {story.sensory.aroma && <p><span className="text-tea-text-dim">Aroma: </span>{story.sensory.aroma}</p>}
                          {story.sensory.flavor && <p><span className="text-tea-text-dim">Flavor: </span>{story.sensory.flavor}</p>}
                          {story.sensory.mouthfeel_liquor && <p><span className="text-tea-text-dim">Mouthfeel: </span>{story.sensory.mouthfeel_liquor}</p>}
                        </div>
                      </LabelledBlock>
                    )}
                    {story.distribution && (
                      <LabelledBlock label="Distribution">
                        <div className="space-y-2">
                          {Object.entries(story.distribution).map(([country, areas]) => (
                            <p key={country} className="text-ui-13 leading-[1.6]">
                              <span className="text-tea-text capitalize">{country}</span>
                              <span className="text-tea-text-sec">: {areas.join(', ')}</span>
                            </p>
                          ))}
                        </div>
                      </LabelledBlock>
                    )}
                  </div>
                )}

                {story.expressions && (
                  <LabelledBlock label="Expressions">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(story.expressions).map(([family, named]) => (
                        <div key={family} className="min-w-0">
                          <p className={`${WISDOM_TYPE.rowName} mb-1.5`}>{family}</p>
                          <div className="space-y-1.5 border-l border-tea-border pl-3">
                            {Object.entries(named).map(([name, text]) => (
                              <p key={name} className="text-ui-12 text-tea-text-sec leading-[1.6]">
                                <span className="text-tea-text">{name}</span>: {text}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </LabelledBlock>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
