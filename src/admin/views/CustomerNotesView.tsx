import { CustomerNotesReview } from '../components/CustomerNotesReview';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export default function CustomerNotesView() {
  return (
    <section className="mx-auto w-full max-w-prose px-4 py-6 lg:px-6">
      <h1 className={TYPOGRAPHY_CLASSES.h1}>Guest notes</h1>
      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>
        Approve guest excerpts, then choose where each appears.
      </p>
      <div className="mt-4">
        <CustomerNotesReview />
      </div>
    </section>
  );
}
