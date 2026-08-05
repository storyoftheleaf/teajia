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
import {
  AXIS_INDENT,
  CELL,
  CELL_CLASS,
  FACT,
  FACT_CLASS,
  LABEL,
  MEASURE,
  NAME_CLASS,
  QUIET_LINK,
  SectionHead,
} from './wisdomShared';

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

/**
 * Repairs what splitting on the cross operator does to a written parentage.
 *
 * Three cases, all real in the corpus:
 *   "(Jin Xuan x Qing Xin) x Cui Yu"  leaves a lone opening bracket on the head
 *   "C. sinensis var. assamica (Burma) x C. formosensis (Taiwanese Wild Tea)"
 *     leaves each side with one bracket and no partner
 *   "'Saemidori' x a hybrid of 'Sofu' and 'Makura-Cd86'." leaves a trailing stop
 *
 * A dangling bracket is closed rather than deleted, because "(Burma" is the
 * start of a real qualification and dropping it would change what the record
 * says. Nothing here invents a word.
 */
export function tidyName(text: string): string {
  let value = text.trim().replace(/^['"]+|['"]+$/g, '').replace(/\.$/, '').trim();
  const opens = (value.match(/\(/g) ?? []).length;
  const closes = (value.match(/\)/g) ?? []).length;
  if (opens > closes) value = value.startsWith('(') ? value.slice(1).trim() : `${value})`;
  else if (closes > opens) value = value.endsWith(')') ? value.slice(0, -1).trim() : `(${value}`;
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

interface NodeRowProps {
  node: Cultivar | string;
  tone: Tone;
  rail: Rail;
  children?: React.ReactNode;
}

const NodeRow: React.FC<NodeRowProps> = ({ node, tone, rail, children }) => {
  const held = isCultivar(node);
  const marker =
    tone === 'subject'
      ? 'w-[9px] h-[9px] bg-tea-gold'
      : held
        ? 'w-[7px] h-[7px] bg-tea-bg border border-tea-gold/50'
        : 'w-[7px] h-[7px] bg-tea-bg border border-tea-border';

  const markerTop = tone === 'subject' ? 'top-[13px]' : 'top-[14px]';
  const markerLeft = tone === 'subject' ? 'left-[-1px]' : 'left-0';

  // At 390px the deepest rail leaves 306px of line. A 35-character unheld name
  // ("C. formosensis (Taiwanese Wild Tea)") plus the tag does not fit on one
  // line there, so the tag has to be able to drop to the next line whole. Left
  // to itself it broke as "not held / here", which reads as two failures.
  const title = held ? (
    <Link
      to={`/wisdom/cultivar/${node.id}`}
      className="group inline-flex items-baseline gap-3 flex-wrap min-w-0 min-h-[44px]"
    >
      <span className={`${NAME_CLASS} text-tea-text group-hover:text-tea-gold-lt transition-colors break-words`}>
        {node.name}
      </span>
      {node.chineseName && <span className={`${NAME_CLASS} text-tea-text-dim`}>{node.chineseName}</span>}
    </Link>
  ) : (
    <span className="inline-flex items-baseline gap-3 flex-wrap min-w-0">
      <span className={`${NAME_CLASS} text-tea-text-sec break-words`}>{tidyName(node)}</span>
      {/* Not tracked capitals. Caps here would be a badge, which is a third
          job for a device that does two: field labels and section heads. */}
      <span className={`${CELL_CLASS} text-tea-text-dim whitespace-nowrap`}>not held here</span>
    </span>
  );

  return (
    <li className="relative">
      <div className="relative pl-7 py-2">
        <span aria-hidden className={`absolute left-[3px] w-px bg-tea-border ${RAIL_CLASS[rail]}`} />
        <span aria-hidden className="absolute left-[3px] top-[17px] h-px w-4 bg-tea-border" />
        <span aria-hidden className={`absolute ${markerLeft} ${markerTop} rounded-full ${marker}`} />
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 justify-between min-w-0">
          {title}
          {held && placeAndYear(node) && (
            <span className={`${CELL_CLASS} text-tea-text-dim min-w-0 break-words`}>{placeAndYear(node)}</span>
          )}
        </div>
        {children}
      </div>
    </li>
  );
};

/**
 * A node's own recorded parentage, folded onto the node's own line.
 *
 * This replaces a second rail. Grandparents used to open a nested list with an
 * indent and a spine of their own, set at the same weight as the parents, and
 * the result was that a reader could not tell whether a row was a sibling of
 * the row above it or a child of it. Two spines fighting is worse than one
 * spine and a footnote, and the parents are the structure here: a grandparent
 * is a thing you follow, not a thing you scan.
 *
 * So it is one dim line under the name, inside the parent's own text block, at
 * no extra indent. Both generations are still reachable, because a grandparent
 * the reference holds is still a link. Held against not held reads exactly as
 * it does everywhere else on this page, and the legend under the tree already
 * says so: a name you can open is held, a name in plain type is not.
 */
const FoldedParents: React.FC<{ of: string; parents: Array<Cultivar | string> }> = ({ of, parents }) => {
  if (parents.length === 0) return null;
  return (
    <p className={`${CELL_CLASS} text-tea-text-dim leading-relaxed mt-0.5 ${MEASURE}`}>
      <span className="sr-only">Parents of {of}: </span>
      <span aria-hidden>from </span>
      {parents.map((parent, index) => (
        <React.Fragment key={`${nameOf(parent)}-${index}`}>
          {index > 0 && (
            <>
              <span aria-hidden> × </span>
              <span className="sr-only"> and </span>
            </>
          )}
          {isCultivar(parent) ? (
            <Link to={`/wisdom/cultivar/${parent.id}`} className={`py-2 ${QUIET_LINK}`}>
              {parent.name}
            </Link>
          ) : (
            <span className="text-tea-text-sec">{tidyName(parent)}</span>
          )}
        </React.Fragment>
      ))}
    </p>
  );
};

/** A generation marker sitting on the rail, so the reader knows which way time runs. */
const Generation: React.FC<{ label: string; opensTheRail?: boolean }> = ({ label, opensTheRail }) => (
  <li className="relative">
    <div className="relative pl-7 pt-4 pb-1">
      <span aria-hidden className={`absolute left-[3px] w-px bg-tea-border ${opensTheRail ? 'top-4' : 'top-0'} bottom-0`} />
      <span className={LABEL}>{label}</span>
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
      <SectionHead label="Lineage" />
      <h2 id="lineage-heading" className="sr-only">
        Lineage of {cultivar.name}
      </h2>

      <div className={AXIS_INDENT}>
        {/* The record itself, verbatim, before anything is read out of it. It
            heads the block, because the tree below is a reading of this line
            and a reader is entitled to check the reading against it. Stacked
            rather than inline: at 390px a label and a 40-character cross on one
            line wrapped into a shape that read as two facts.

            No rule between this and the tree. The full-measure hairline is the
            reference's one mark for a major division, and a second one inside a
            section would be the same weight doing a smaller job. The label says
            what this line is; the space says where it ends. */}
        {lineage.raw && lineage.kind === 'cross' && (
          <div className="mb-5">
            <p className={`${LABEL} mb-1`}>Recorded as</p>
            <p className={`${CELL} min-w-0 break-words figures-tab`}>{lineage.raw}</p>
          </div>
        )}

        <ul className="list-none m-0 p-0">
          {hasParents && <Generation label={parents.length === 1 ? 'Parent' : 'Parents'} opensTheRail />}

          {hasParents &&
            parents.map((parent, index) => (
              <NodeRow key={`${nameOf(parent)}-${index}`} node={parent} tone="ancestor" rail="full">
                {isCultivar(parent) && <FoldedParents of={parent.name} parents={grandparentsOf(parent)} />}
              </NodeRow>
            ))}

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
              {/* A descendant's own parentage is the same kind of thing as a
                  parent's folded line, so it is set at the same weight. It ran
                  at the body size, which put a generation's footnote at the
                  size of the page's prose. */}
              {child.parentage && (
                <p className={`${CELL_CLASS} text-tea-text-dim leading-relaxed mt-0.5 ${MEASURE}`}>
                  {child.parentage}
                </p>
              )}
            </NodeRow>
          ))}
        </ul>

        {lineage.kind === 'note' && lineage.raw && (
          <div className="mt-5 pl-7">
            <p className={`${LABEL} mb-1.5`}>Recorded origin</p>
            <p className={`${FACT} ${MEASURE}`}>{lineage.raw}</p>
          </div>
        )}

        {lineage.kind === 'none' && (
          <p className={`${FACT_CLASS} text-tea-text-dim mt-5 pl-7 ${MEASURE}`}>
            No breeding record is held for this plant yet. That is a gap, not a claim that none exists.
          </p>
        )}

        <p className={`${CELL_CLASS} text-tea-text-dim leading-relaxed mt-6 ${MEASURE}`}>
          A name you can open is a plant held in this reference. A name in plain type was written into the record but is
          not held yet.
        </p>
      </div>
    </section>
  );
};

export default LineageTree;
