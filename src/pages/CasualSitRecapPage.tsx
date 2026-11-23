import { Link, useParams } from 'react-router-dom';
import { casualSitPhotoUrl, usePublicCasualSit } from '../lib/casualSitPublications';
import { buildPublicProductHref } from '../lib/publicProductNavigation';
import { SessionPhoto } from '../components/sessions/SessionPhoto';
import { SitTeaTasting } from '../components/sessions/SitTeaTasting';
import { TeaCard, TeaCardTitle } from '../components/tea/TeaCard';
import { formatEventLong } from '../components/people/profileFormat';
import { TYPOGRAPHY_CLASSES as T } from '../designTokens';

export default function CasualSitRecapPage() {
  const { slug = '' } = useParams();
  const result = usePublicCasualSit(slug);
  const sit = result.isSuccess && !result.isError ? result.data.recap : undefined;
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pt-6 pb-nav-gap md:px-6">
      <Link className="btn-quiet tap-target mb-3" to={sit ? `/people/${encodeURIComponent(sit.host.slug)}` : '/people'}>{sit ? `Back to ${sit.host.name}’s profile` : 'Back to People'}</Link>
      {result.isPending && <p role="status" className="text-ui-14 text-tea-text-sec">Opening the recap…</p>}
      {!result.isPending && !sit && <h1 className={T.h1}>This recap is unavailable</h1>}
      {sit && (
        <article>
          <h1 className={`${T.h1} break-words`}>{sit.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-13 text-tea-text-sec">
            <time dateTime={sit.date}>{formatEventLong(sit.date)}</time>
            <Link className="tap-target underline underline-offset-4" to={`/people/${encodeURIComponent(sit.host.slug)}`}>{sit.host.name}</Link>
          </div>
          {sit.photo && !result.isFetching && !result.isError && <SessionPhoto source={{
            kind: 'casual', url: casualSitPhotoUrl(sit.slug, sit.photo.id), alt: sit.photo.alt, credit: sit.host.name,
          }} />}
          {sit.writing && <p className={`${T.body} my-4 whitespace-pre-wrap break-words`}>{sit.writing}</p>}
          {sit.tea && (
            <section className="mt-6" aria-label="Tea served">
              <h2 className={`${T.h2} mb-3`}>Tea served</h2>
              <TeaCard title={<TeaCardTitle>{sit.tea.name}</TeaCardTitle>} actions={
                <>
                  <SitTeaTasting id={`casual:${sit.slug}`} name={sit.tea.name} productId={sit.tea.productId} />
                  {sit.tea.productId && <Link className="btn-quiet btn-sm tap-target"
                    to={buildPublicProductHref({ id: sit.tea.productId })}>View tea</Link>}
                </>
              } />
            </section>
          )}
        </article>
      )}
    </div>
  );
}
