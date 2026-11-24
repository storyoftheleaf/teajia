import { Link, useParams } from 'react-router-dom';
import { casualSitPhotoUrl, usePublicCasualSit } from '../lib/casualSitPublications';
import { SitRecap } from '../components/sessions/SitRecap';
import { TYPOGRAPHY_CLASSES as T } from '../designTokens';

// /sits/casual/:slug. A member's own sit, in the same layout as a shop sit's
// recap: the host's words, then the tea they poured.
export default function CasualSitRecapPage() {
  const { slug = '' } = useParams();
  const result = usePublicCasualSit(slug);
  const sit = result.isSuccess && !result.isError ? result.data.recap : undefined;
  return (
    <div className="-mx-4 min-h-screen max-w-2xl px-6 pt-6 pb-nav-gap sm:mx-auto">
      {result.isPending && <p role="status" className="text-ui-14 text-tea-text-sec">Opening the recap…</p>}
      {!result.isPending && !sit && (
        <>
          <Link className="btn-quiet tap-target mb-3" to="/people">Back to People</Link>
          <h1 className={T.h1}>This recap is unavailable</h1>
        </>
      )}
      {sit && !result.isFetching && (
        <SitRecap
          guestBook={false}
          photo={sit.photo ? { kind: 'casual', url: casualSitPhotoUrl(sit.slug, sit.photo.id), alt: sit.photo.alt, credit: sit.host.name } : null}
          recap={{
            slug: sit.slug, title: sit.title, event_date: sit.date, galleryPhoto: null,
            people: [{ slug: sit.host.slug, name: sit.host.name, role: 'lead_host' }],
            note: sit.writing ? { text: sit.writing, by: { name: sit.host.name, part: 'host', slug: sit.host.slug } } : null,
            teas: (sit.teas ?? (sit.tea ? [{ kind: 'name' as const, id: null, name: sit.tea.name }] : [])).map(tea => ({ ...tea, items: [] })),
            table: [], guestBook: [],
          }}
        />
      )}
    </div>
  );
}
