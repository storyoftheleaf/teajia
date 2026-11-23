import type { ProductReading } from '../../../components/shop/productDetailFields';
import { guidePath, potPath, type Pot, type Decision, type Entry } from './data';

export function ownerClayReading(pot: Pot, decision: Decision, entries: Entry[]): ProductReading['clay'] {
  const clayEntries = entries.filter(entry => entry.kind === 'clay');
  const confirmed = clayEntries.find(entry => entry.id === decision.clay);
  const review = { name: 'Review clay', href: potPath(pot.id) + '#clay-review' };
  if (confirmed) {
    const name = [confirmed.name, confirmed.chinese].filter(Boolean).join(' · ');
    return {
      label: 'Clay',
      paragraphs: ['You identified this pot’s clay as ' + name + '.', confirmed.summary].filter(Boolean),
      links: [review, { name: 'Clay reference', href: guidePath(pot, confirmed.id, true) }],
    };
  }
  if (!pot.clayLead) return;
  // The board also carries comparisons for pots whose family is explicitly unclear.
  // Only the recorded named hypothesis can appear beside the photographs.
  const lead = pot.clayLead.label.toLowerCase().trim();
  const candidate = clayEntries.find(entry => {
    const family = entry.name.split(' · ')[0].toLowerCase();
    const name = 'possible ' + family;
    return (lead === name || lead.startsWith(name + ' ')) && pot.comparisonIds.includes(entry.id)
      && !decision.rejectedClays?.includes(entry.id);
  });
  if (candidate) return {
    label: 'Possible clay',
    paragraphs: [candidate.name + (candidate.chinese ? ' · ' + candidate.chinese : ''), pot.clayLead.note, candidate.summary].filter(Boolean),
    links: [review, { name: 'Clay reference', href: guidePath(pot, candidate.id, true) }],
  };
  return {
    label: 'Clay identification',
    paragraphs: ['The clay family is still open. A maker’s material record or a supplier label for this pot would help identify it.'],
    links: [review],
  };
}
