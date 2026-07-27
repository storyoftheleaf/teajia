import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AnchoredMenu } from '../../../components/shared/AnchoredMenu';
import { RungTag, rungSummary } from './Rung';
import { SearchBox } from './SearchBox';
import { WisdomDetailPanel } from './WisdomDetailPanel';
import {
  AT_BLOCK,
  AT_FLEX,
  WISDOM_CHROME_BTN,
  WISDOM_HEADER_ROW,
  WISDOM_ROW,
  WISDOM_TYPE,
  compareWisdom,
  type AnyWisdomHolding,
  type WisdomColumn,
  type WisdomSort,
} from './config';

/**
 * One list engine for all seven holdings.
 *
 * Layout is a flex row, not a table, because the project forbids horizontal
 * scroll: a column that will not fit a 390px phone drops out at its breakpoint
 * and the name column absorbs the space, instead of the row growing sideways.
 * The column header row carries the same widths and breakpoints, so it degrades
 * with the columns it labels rather than drifting out of alignment.
 */

interface Props {
  holding: AnyWisdomHolding;
  /**
   * The tab strip, rendered inside this component's sticky chrome block. It
   * lives here rather than in the view so that the tabs, the toolbar, the count
   * line and the column header stick as one unit at one offset. A wrapping tab
   * strip has no fixed height, so a second sticky element below it could not
   * know what offset to use.
   */
  tabs: React.ReactNode;
}

const textAlign = (column: WisdomColumn<unknown>) => (column.align === 'right' ? 'text-right' : 'text-left');
const justify = (column: WisdomColumn<unknown>) => (column.align === 'right' ? 'justify-end' : 'justify-start');

export const WisdomBrowser: React.FC<Props> = ({ holding, tabs }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nameColumn = holding.columns[0];
  const [sort, setSort] = useState<WisdomSort>({ key: nameColumn.key, direction: 'asc' });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle ? holding.rows.filter(row => holding.searchText(row).includes(needle)) : [...holding.rows];
    const column = holding.columns.find(entry => entry.key === sort.key) ?? nameColumn;
    return rows.sort((left, right) => {
      const order = compareWisdom(column.value(left), column.value(right), sort.direction);
      // Name is the tiebreaker everywhere, so equal values never shuffle.
      return order !== 0 ? order : compareWisdom(nameColumn.value(left), nameColumn.value(right), 'asc');
    });
  }, [holding, nameColumn, query, sort]);

  const summary = useMemo(() => rungSummary(holding.rows.map(row => holding.idOf(row))), [holding]);
  const selected = selectedId ? holding.rows.find(row => holding.idOf(row) === selectedId) ?? null : null;

  const toggleSort = (key: string) =>
    setSort(current =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );

  const sortable = holding.columns.filter(column => column.sortable !== false);

  const sortMenu = (
    <AnchoredMenu
      align="right"
      width={176}
      role="listbox"
      trigger={props => (
        <button {...props} className={WISDOM_CHROME_BTN} aria-label={`Sort ${holding.noun}`}>
          Sort
        </button>
      )}
    >
      {close =>
        sortable.map(column => {
          const isCurrent = sort.key === column.key;
          return (
            <button
              key={column.key}
              role="option"
              aria-selected={isCurrent}
              onClick={() => {
                toggleSort(column.key);
                close();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-ui-12 ${
                isCurrent ? 'text-tea-gold' : 'text-tea-text-sec'
              }`}
            >
              <span>{column.label}</span>
              {isCurrent &&
                (sort.direction === 'asc' ? (
                  <ArrowUp size={13} aria-hidden="true" />
                ) : (
                  <ArrowDown size={13} aria-hidden="true" />
                ))}
            </button>
          );
        })
      }
    </AnchoredMenu>
  );

  /**
   * The count, and the shape of the authorship rungs, said once. This is what
   * replaces a column that read "DRAFTED" on all 79 rows. It is a sentence, so
   * it never wears micro-caps.
   */
  const countLine = (
    <>
      {filtered.length === holding.rows.length
        ? `${holding.rows.length} ${holding.noun}`
        : `${filtered.length} of ${holding.rows.length} ${holding.noun}`}
      <span className="px-1.5 text-tea-border" aria-hidden="true">·</span>
      {summary}
    </>
  );

  return (
    <div>
      {/* All chrome sticks as one block: tabs, toolbar, count line, column
          header. About 130px on a desktop before the first entry. */}
      <div className="sticky top-0 z-sticky bg-tea-bg">
        {tabs}

        {/* Toolbar: find on the left, utilities as micro-caps on the right.
            From md the count rides here in the space the toolbar was wasting,
            which buys the whole screen a line back. */}
        <div className="flex h-10 items-center gap-4 px-3 md:px-4">
          <SearchBox value={query} onChange={setQuery} placeholder={holding.placeholder} />
          <p className="hidden shrink-0 text-ui-11 text-tea-text-dim md:block">{countLine}</p>
          <div className="flex shrink-0 items-center gap-3">{sortMenu}</div>
        </div>

        <p className="px-3 pb-1 text-ui-11 text-tea-text-dim md:hidden">{countLine}</p>

        {/* No ARIA table roles: the rows below are buttons, not grid cells, and
            `aria-sort` only carries meaning inside a real table or grid. The
            sort state rides in each button's label instead, where a screen
            reader will actually read it. */}
        <div
          className={`${WISDOM_HEADER_ROW} border-y border-tea-border`}
          data-testid="wisdom-column-row"
        >
          {holding.columns.map((column, index) => {
            const canSort = column.sortable !== false;
            const isCurrent = sort.key === column.key;
            const width = index === 0 ? 'flex-1 min-w-0' : `${column.width} shrink-0`;
            return (
              <div
                key={column.key}
                className={`${width} ${AT_FLEX[column.at ?? 'always']} ${justify(column)} ${textAlign(column)} ${WISDOM_TYPE.label} items-center`}
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    aria-label={
                      isCurrent
                        ? `Sort by ${column.label}, currently ${sort.direction === 'asc' ? 'ascending' : 'descending'}`
                        : `Sort by ${column.label}`
                    }
                    className="group inline-flex min-h-[24px] min-w-0 select-none items-center gap-1 transition-colors hover:text-tea-text"
                  >
                    <span className="truncate">{column.label}</span>
                    {isCurrent ? (
                      sort.direction === 'asc'
                        ? <ArrowUp size={10} className="shrink-0 text-tea-gold" />
                        : <ArrowDown size={10} className="shrink-0 text-tea-gold" />
                    ) : (
                      <ArrowUpDown size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                ) : (
                  <span className="truncate">{column.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-tea-border">
        {filtered.map(row => {
          const id = holding.idOf(row);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id)}
              className={`${WISDOM_ROW} transition-colors hover:bg-tea-accent-sub`}
            >
              {holding.columns.map((column, index) => {
                const content = column.render ? column.render(row) : (column.value(row) ?? null);
                if (index === 0) {
                  return (
                    <span key={column.key} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                      {content}
                      <RungTag id={id} />
                    </span>
                  );
                }
                return (
                  <span
                    key={column.key}
                    className={`${column.width} shrink-0 truncate ${AT_BLOCK[column.at ?? 'always']} ${textAlign(column)} ${WISDOM_TYPE.fact}`}
                  >
                    {content}
                  </span>
                );
              })}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-ui-13 text-tea-text-dim">
            No {holding.noun} match &quot;{query}&quot;.
          </p>
        )}
      </div>

      {/* The read-only note, kept under the content rather than in front of it. */}
      <p className="px-3 pb-6 pt-3 text-ui-11 text-tea-text-dim md:px-4">
        Read only. Entries change by re-running the build from the source data.
      </p>

      {selected && (holding.renderDetail
        ? holding.renderDetail(selected, { onClose: () => setSelectedId(null), onSelect: setSelectedId })
        : (
          <WisdomDetailPanel
            detail={holding.detail(selected)}
            id={holding.idOf(selected)}
            onClose={() => setSelectedId(null)}
          />
        ))}
    </div>
  );
};
