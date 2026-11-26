import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// Launch 3, J8: after a tasting, one line for notes written on paper. Each tea
// that has a record opens the journal with that tea filled in; a tea with no
// record gets no link. With one such tea, the line itself is the link.

type JournalTea = { id: string; name: string; product_id: string };

const journalFor = (tea: JournalTea) => `/account/journal?tea=${encodeURIComponent(tea.product_id)}`;

export function PaperNotesLine({ teas }: { teas: JournalTea[] }) {
  if (teas.length === 1) {
    return (
      <p className={TYPOGRAPHY_CLASSES.body}>
        <Link to={journalFor(teas[0])} className={TYPOGRAPHY_CLASSES.link}>Wrote on paper? Add your notes</Link>
      </p>
    );
  }
  if (teas.length === 0) {
    return (
      <p className={TYPOGRAPHY_CLASSES.body}>
        <Link to="/account/journal" className={TYPOGRAPHY_CLASSES.link}>Wrote on paper? Add your notes</Link>
      </p>
    );
  }
  return (
    <p className={`${TYPOGRAPHY_CLASSES.body} flex flex-wrap items-baseline gap-x-3 gap-y-1`}>
      <span>Wrote on paper? Add your notes:</span>
      {teas.map(tea => (
        <Link key={tea.id} to={journalFor(tea)} className={`${TYPOGRAPHY_CLASSES.link} break-words`}>{tea.name}</Link>
      ))}
    </p>
  );
}
