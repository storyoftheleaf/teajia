import { Link } from 'react-router-dom';
import type { Fact } from '../wisdom/FactGrid';

/**
 * The facts at the top of a product page (Adrian, 2026-11-24, proposal D).
 *
 * Three facts nearly every tea carries (Vintage, Format, Region) sit in a bar
 * of equal cells. Everything else is a ledger: one fact per line, labels in a
 * fixed column, the groups split by a hairline rather than a heading. On a
 * phone the bar sits above the box; from 768px it moves inside it, so a tea
 * with little recorded still fills its box.
 *
 * Location is left out when the summary line above already says it, so the
 * same place is not printed twice.
 */
const BAND = ['Vintage', 'Format', 'Region'];
const GROUPS: string[][] = [
  ['Tea family', 'Type', 'Grade', 'Leaf cultivar', 'Named tea'],
  ['Location', 'Elevation'],
];

function FactValue({ fact }: { fact: Fact }) {
  if (fact.to) return <Link to={fact.to} state={fact.state} className="tea-facts__link">{fact.value}</Link>;
  return <>{fact.content ?? fact.value}</>;
}

export function TeaFactsBox({ facts, summary, title }: { facts: Fact[]; summary?: string; title: string }) {
  const sayOnce = (fact: Fact) => !(fact.label === 'Location' && summary && fact.value
    && summary.toLowerCase().includes(fact.value.toLowerCase()));
  const band = BAND.map(label => facts.find(fact => fact.label === label)).filter((fact): fact is Fact => Boolean(fact));
  const rest = facts.filter(fact => !BAND.includes(fact.label) && sayOnce(fact));
  const grouped = GROUPS.map(labels => rest.filter(fact => labels.includes(fact.label)));
  const others = rest.filter(fact => !GROUPS.flat().includes(fact.label));
  const groups = [...grouped, others].filter(group => group.length > 0);
  if (!band.length && !groups.length && !summary) return null;

  // Children stay flat (summary, bar, ledger) so CSS alone can lift the bar
  // out above the box on a phone and set it inside the box on a wide screen.
  return (
    <section className="tea-facts" aria-label={title} data-testid="tea-facts"
      data-has-summary={summary ? '' : undefined} data-has-ledger={groups.length ? '' : undefined}>
      {summary && <p className="tea-facts__summary">{summary}</p>}
      {band.length > 0 && (
        <dl className="tea-facts__band">
          {band.map(fact => (
            <div key={fact.label}>
              <dt className="tea-facts__label">{fact.label}</dt>
              <dd className="tea-facts__band-value"><FactValue fact={fact} /></dd>
            </div>
          ))}
        </dl>
      )}
      {groups.length > 0 && (
        <div className="tea-facts__ledger">
          {groups.map(group => (
            <dl key={group[0].label} className="tea-facts__group">
              {group.map(fact => (
                <div key={fact.label} className="tea-facts__row">
                  <dt className="tea-facts__label">{fact.label}</dt>
                  <dd className="tea-facts__value"><FactValue fact={fact} /></dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      )}
    </section>
  );
}
