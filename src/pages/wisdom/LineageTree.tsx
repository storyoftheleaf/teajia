/**
 * The lineage tree. The reason a cultivar page exists.
 *
 * Read straight out of the wisdom base with `parentsOf` and `childrenOf`. A
 * parent that resolves to a plant we hold becomes a link; one that does not is
 * printed as it was written and marked as not held. Nothing is inferred: where
 * the record is a sentence rather than a cross, the sentence is shown as a
 * sentence, because a blank lineage beats an invented one.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { childrenOf, parentsOf, type Cultivar } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { EYEBROW, SectionHead } from './wisdomShared';

// ─── Reading the record ──────────────────────────────────────────────────────

export interface Lineage {
  /** cross: a recorded breeding cross. note: prose provenance. none: nothing recorded. */
  kind: 'cross' | 'note' | 'none';
  parents: Array<Cultivar | string>;
  children: Cultivar[];
  /** The parentage exactly as recorded, shown so the reader can judge it. */
  raw: string | null;
}

/**
 * Only a standalone cross operator counts as a cross. Most parentage in the
 * corpus is provenance prose ("Selected from the native Anxi heirloom
 * population"), and splitting that on every letter x would invent parents.
 */
const CROSS = /\s[x×]\s/i;

/** The parents of a cross, resolved by the wisdom base. */
const crossParentsOf = (cultivar: Cultivar): Array<Cultivar | string> => parentsOf(cultivar);

export function readLineage(cultivar: Cultivar): Lineage {
  const raw = cultivar.parentage?.trim() || null;
  const children = childrenOf(cultivar);
  if (!raw) return { kind: 'none', parents: [], children, raw: null };
  if (!CROSS.test(raw)) return { kind: 'note', parents: [], children, raw };
  return { kind: 'cross', parents: crossParentsOf(cultivar), children, raw };
}

/** The parents of a parent, one generation further back, when they are a cross too. */
function grandparentsOf(parent: Cultivar): Array<Cultivar | string> {
  if (!parent.parentage || !CROSS.test(parent.parentage)) return [];
  return crossParentsOf(parent);
}

export const isCultivar = (value: Cultivar | string): value is Cultivar => typeof value !== 'string';

/** Strips the stray bracket a split leaves behind on "(Jin Xuan x Qing Xin) x Cui Yu". */
export function tidyName(text: string): string {
  let value = text.trim().replace(/^['"]+|['"]+$/g, '');
  const opens = (value.match(/\(/g) ?? []).length;
  const closes = (value.match(/\)/g) ?? []).length;
  if (opens > closes && value.startsWith('(')) value = value.slice(1).trim();
  if (closes > opens && value.endsWith(')')) value = value.slice(0, -1).trim();
  return value;
}

export const nameOf = (node: Cultivar | string): string => (isCultivar(node) ? node.name : tidyName(node));

const placeAndYear = (cultivar: Cultivar): string =>
  [cultivar.originRegion, cultivar.developedYear ? String(cultivar.developedYear) : null].filter(Boolean).join(' · ');

// ─── One node on the rail ────────────────────────────────────────────────────

type Rail = 'full' | 'from-tick' | 'to-tick' | 'none';
type Tone = 'ancestor' | 'subject' | 'descendant' | 'unheld';

const RAIL_CLASS: Record<Rail, string> = {
  full: 'top-0 bottom-0',
  'from-tick': 'top-[17px] bottom-0',
  'to-tick': 'top-0 h-[17px]',
  none: 'hidden',
};

const SMALL_RAIL_CLASS: Record<Rail, string> = {
  full: 'top-0 bottom-0',
  'from-tick': 'top-[13px] bottom-0',
  'to-tick': 'top-0 h-[13px]',
  none: 'hidden',
};

interface NodeRowProps {
  node: Cultivar | string;
  tone: Tone;
  rail: Rail;
  small?: boolean;
  children?: React.ReactNode;
}

const NodeRow: React.FC<NodeRowProps> = ({ node, tone, rail, small = false, children }) => {
  const held = isCultivar(node);
  const marker =
    tone === 'subject'
      ? 'w-[9px] h-[9px] bg-tea-gold'
      : held
        ? 'w-[7px] h-[7px] bg-tea-bg border border-tea-gold/50'
        : 'w-[7px] h-[7px] bg-tea-bg border border-tea-border';

  const markerTop = small ? 'top-[10px]' : tone === 'subject' ? 'top-[13px]' : 'top-[14px]';
  const tickTop = small ? 'top-[13px]' : 'top-[17px]';
  const markerLeft = tone === 'subject' ? 'left-[-1px]' : 'left-0';

  const title = held ? (
    <Link
      to={`/wisdom/cultivar/${node.id}`}
      className="group inline-flex items-baseline gap-2 flex-wrap min-h-[44px]"
    >
      <span
        className={`font-display ${small ? 'text-ui-16' : 'text-ui-20'} text-tea-text group-hover:text-tea-gold-lt transition-colors`}
      >
        {node.name}
      </span>
      {node.chineseName && <span className="font-display text-ui-13 text-tea-text-dim">{node.chineseName}</span>}
    </Link>
  ) : (
    <span className="inline-flex items-baseline gap-2 flex-wrap">
      <span className={`font-display ${small ? 'text-ui-16' : 'text-ui-20'} text-tea-text-sec`}>{tidyName(node)}</span>
      <span className={EYEBROW}>not held here</span>
    </span>
  );

  return (
    <li className="relative">
      <div className={`relative ${small ? 'pl-6 py-1.5' : 'pl-7 py-2'}`}>
        <span aria-hidden className={`absolute left-[3px] w-px bg-tea-border ${(small ? SMALL_RAIL_CLASS : RAIL_CLASS)[rail]}`} />
        <span aria-hidden className={`absolute left-[3px] ${tickTop} h-px ${small ? 'w-3' : 'w-4'} bg-tea-border`} />
        <span aria-hidden className={`absolute ${markerLeft} ${markerTop} rounded-full ${marker}`} />
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 justify-between">
          {title}
          {held && placeAndYear(node) && (
            <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{placeAndYear(node)}</span>
          )}
        </div>
        {children}
      </div>
    </li>
  );
};

/** A generation marker sitting on the rail, so the reader knows which way time runs. */
const Generation: React.FC<{ label: string; opensTheRail?: boolean }> = ({ label, opensTheRail }) => (
  <li className="relative">
    <div className="relative pl-7 pt-4 pb-1">
      <span aria-hidden className={`absolute left-[3px] w-px bg-tea-border ${opensTheRail ? 'top-4' : 'top-0'} bottom-0`} />
      <span className={EYEBROW}>{label}</span>
    </div>
  </li>
);

// ─── The tree ────────────────────────────────────────────────────────────────

export const LineageTree: React.FC<{ cultivar: Cultivar }> = ({ cultivar }) => {
  const lineage = readLineage(cultivar);
  const { parents, children } = lineage;
  const hasParents = lineage.kind === 'cross' && parents.length > 0;

  return (
    <section aria-labelledby="lineage-heading">
      <SectionHead glyph="§" label="Lineage" />
      <h2 id="lineage-heading" className="sr-only">
        Lineage of {cultivar.name}
      </h2>

      {lineage.raw && lineage.kind === 'cross' && (
        <p className={`${EYEBROW} mb-5`}>
          Recorded as <span className="font-mono text-ui-11 text-tea-text-sec normal-case tracking-normal">{lineage.raw}</span>
        </p>
      )}

      <ul className="list-none m-0 p-0">
        {hasParents && <Generation label={parents.length === 1 ? 'Parent' : 'Parents'} opensTheRail />}

        {hasParents &&
          parents.map((parent, index) => {
            const grandparents = isCultivar(parent) ? grandparentsOf(parent) : [];
            return (
              <NodeRow key={`${nameOf(parent)}-${index}`} node={parent} tone="ancestor" rail="full">
                {grandparents.length > 0 && (
                  <ul className="list-none m-0 mt-2 p-0">
                    <li className="relative">
                      <div className="relative pl-6 pb-0.5">
                        <span aria-hidden className="absolute left-[3px] top-0 bottom-0 w-px bg-tea-border" />
                        <span className={EYEBROW}>from</span>
                      </div>
                    </li>
                    {grandparents.map((grandparent, grandIndex) => (
                      <NodeRow
                        key={`${nameOf(grandparent)}-${grandIndex}`}
                        node={grandparent}
                        tone="ancestor"
                        rail={grandIndex === grandparents.length - 1 ? 'to-tick' : 'full'}
                        small
                      />
                    ))}
                  </ul>
                )}
              </NodeRow>
            );
          })}

        <NodeRow
          node={cultivar}
          tone="subject"
          rail={hasParents ? (children.length ? 'full' : 'to-tick') : children.length ? 'from-tick' : 'none'}
        />

        {children.length > 0 && <Generation label={children.length === 1 ? 'Descendant' : 'Descendants'} />}

        {children.map((child, index) => (
          <NodeRow
            key={child.id}
            node={child}
            tone="descendant"
            rail={index === children.length - 1 ? 'to-tick' : 'full'}
          >
            {child.parentage && (
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-dim mt-1 max-w-[56ch]`}>{child.parentage}</p>
            )}
          </NodeRow>
        ))}
      </ul>

      {lineage.kind === 'note' && lineage.raw && (
        <div className="mt-6 pl-7">
          <p className={`${EYEBROW} mb-2`}>Recorded origin</p>
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec max-w-[56ch]`}>{lineage.raw}</p>
        </div>
      )}

      {lineage.kind === 'none' && (
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-dim mt-6 pl-7 max-w-[56ch]`}>
          No breeding record is held for this plant yet. That is a gap, not a claim that none exists.
        </p>
      )}

      <p className={`${EYEBROW} mt-8 leading-relaxed max-w-[60ch]`}>
        A name you can open is a plant held in this reference. A name in plain type was written into the record but is
        not held yet.
      </p>
    </section>
  );
};

export default LineageTree;
