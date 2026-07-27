import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { childrenOf, loadCultivarStory, parentsOf } from '../../../wisdom';
import { authorshipLine } from '../../../wisdom/authorship';
import type { Cultivar, CultivarStory } from '../../../wisdom';

interface Props {
  cultivar: Cultivar;
  onClose: () => void;
  /** Jump the panel to a resolved parent/child without leaving the overlay. */
  onSelectCultivar: (id: string) => void;
}

const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-1">{label}</p>
      <p className="text-ui-13 text-tea-text-sec leading-[1.6]">{value}</p>
    </div>
  );
};

/**
 * Full detail for one cultivar: everything the lean index holds, plus the
 * prose fetched on demand from stories/cultivars.json, plus its resolved
 * lineage. Read-only, per the wisdom base's current phase.
 */
export const CultivarDetailPanel: React.FC<Props> = ({ cultivar, onClose, onSelectCultivar }) => {
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

  return (
    <Modal isOpen onClose={onClose} variant="panel" ariaLabel={cultivar.name}>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-nav-gap sm:px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-2">Cultivar</p>
          <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{cultivar.name}</h2>
          {cultivar.chineseName && <p className="text-ui-15 text-tea-text-sec mt-1">{cultivar.chineseName}</p>}
          {cultivar.altNames.length > 0 && (
            <p className="text-ui-12 text-tea-text-dim mt-1">Also known as {cultivar.altNames.join(', ')}</p>
          )}

          <p className="text-ui-12 text-tea-text-dim italic mt-3">{authorshipLine(cultivar.id)}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-tea-border text-ui-13">
            {(cultivar.originRegion || cultivar.originCountry) && (
              <div>
                <span className="text-tea-text-dim">Origin: </span>
                <span className="text-tea-text">{[cultivar.originRegion, cultivar.originCountry].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {cultivar.developedYear && (
              <div>
                <span className="text-tea-text-dim">Developed: </span>
                <span className="text-tea-text">{cultivar.developedYear}</span>
              </div>
            )}
          </div>

          {cultivar.parentage && (
            <div className="mt-4">
              <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-1">Parentage</p>
              <p className="text-ui-13 text-tea-text-sec leading-[1.6]">{cultivar.parentage}</p>
            </div>
          )}

          {(parents.length > 0 || children.length > 0) && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {parents.length > 0 && (
                <div>
                  <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-2">Parents</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parents.map((parent, index) => (
                      typeof parent === 'string' ? (
                        <span key={index} className="text-ui-12 text-tea-text-sec bg-tea-surface border border-tea-border px-2 py-1 rounded-md">
                          {parent}
                        </span>
                      ) : (
                        <button
                          key={parent.id}
                          type="button"
                          onClick={() => onSelectCultivar(parent.id)}
                          className="tap-target text-ui-12 text-tea-gold hover:text-tea-gold-lt bg-tea-accent-sub px-2 py-1 rounded-md transition-colors"
                        >
                          {parent.name}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              )}
              {children.length > 0 && (
                <div>
                  <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-2">Children</p>
                  <div className="flex flex-wrap gap-1.5">
                    {children.map(child => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onSelectCultivar(child.id)}
                        className="tap-target text-ui-12 text-tea-gold hover:text-tea-gold-lt bg-tea-accent-sub px-2 py-1 rounded-md transition-colors"
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-tea-border pb-6">
            {loadingStory ? (
              <div className="flex items-center gap-2 text-tea-text-dim py-6">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-ui-13">Loading story...</span>
              </div>
            ) : !story ? (
              <p className="text-ui-13 text-tea-text-dim italic py-6">No prose recorded for this cultivar yet.</p>
            ) : (
              <div className="space-y-6">
                <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text`}>{story.description}</p>

                <Field label="Plant" value={story.plantType} />
                <Field label="Environment" value={story.environment} />
                <Field label="Processing" value={story.processing} />
                <Field label="Oxidation" value={story.oxidation} />
                <Field label="Roasting" value={story.roasting} />
                <Field label="Versatility" value={story.versatility} />

                {story.sensory && (
                  <div>
                    <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-2">Sensory</p>
                    <div className="space-y-1.5 text-ui-13 text-tea-text-sec leading-[1.6]">
                      {story.sensory.aroma && <p><span className="text-tea-text-dim">Aroma: </span>{story.sensory.aroma}</p>}
                      {story.sensory.flavor && <p><span className="text-tea-text-dim">Flavor: </span>{story.sensory.flavor}</p>}
                      {story.sensory.mouthfeel_liquor && <p><span className="text-tea-text-dim">Mouthfeel: </span>{story.sensory.mouthfeel_liquor}</p>}
                    </div>
                  </div>
                )}

                {story.distribution && (
                  <div>
                    <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-2">Distribution</p>
                    <div className="space-y-2">
                      {Object.entries(story.distribution).map(([country, areas]) => (
                        <p key={country} className="text-ui-13 leading-[1.6]">
                          <span className="text-tea-text capitalize">{country}</span>
                          <span className="text-tea-text-sec">: {areas.join(', ')}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {story.expressions && (
                  <div>
                    <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.1em] mb-2">Expressions</p>
                    <div className="space-y-4">
                      {Object.entries(story.expressions).map(([family, named]) => (
                        <div key={family}>
                          <p className="text-ui-13 text-tea-text font-medium mb-1.5">{family}</p>
                          <div className="space-y-1.5 pl-3 border-l border-tea-border">
                            {Object.entries(named).map(([name, text]) => (
                              <p key={name} className="text-ui-12 text-tea-text-sec leading-[1.6]">
                                <span className="text-tea-text">{name}</span>: {text}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
