import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { rememberOrderVia, withOrderVia } from '../../lib/orderVia';
import { KeepTeaButton } from './KeepTeaButton';

type ThanksTea = {
  id: string;
  name: string;
  path?: string | null;
  kept?: boolean;
};

export function ThanksTeas({ teas, thanksRef, credential }: { teas: ThanksTea[]; thanksRef?: string | null; credential: string }) {
  if (teas.length === 0) return null;

  return (
    <section aria-labelledby="after-sit-teas" className="border-t border-tea-border pt-3">
      <h2 id="after-sit-teas" className={TYPOGRAPHY_CLASSES.h2}>Teas served</h2>
      <ul className={`${TYPOGRAPHY_CLASSES.body} mt-2 grid gap-1`}>
        {teas.map(tea => (
          <li key={tea.id} className="flex min-w-0 flex-wrap items-center gap-2">
            {tea.path ? (
              <Link className={`${TYPOGRAPHY_CLASSES.link} min-w-0 break-words`}
                to={withOrderVia(tea.path, thanksRef)}
                onClick={() => rememberOrderVia(thanksRef)}>
                {tea.name}
              </Link>
            ) : (
              <span className="min-w-0 break-words">{tea.name}</span>
            )}
            <KeepTeaButton credential={credential} teaId={tea.id} kept={tea.kept === true} />
          </li>
        ))}
      </ul>
    </section>
  );
}
