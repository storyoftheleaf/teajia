import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { api } from '../lib/api';
import { PART_QUERY, partView } from '../lib/closedPart';
import { LoadFailed } from '../components/shared/LoadFailed';

interface PublicSession {
  slug: string;
  title: string;
  event_date: string;
  timezone?: string | null;
  account_name?: string | null;
  hosts?: { role: string; display_name: string }[];
}

interface PublicTea {
  id: string;
  brew_order?: number | null;
  custom_name?: string | null;
  given_name?: string | null;
  product_name?: string | null;
  product_year?: number | null;
  product_origin_region?: string | null;
  product_origin_country?: string | null;
}

// Scope the paper rules to this preview, including when other pages print.
const printStyles = `
  .session-card {
    overflow-wrap: anywhere;
  }

  .session-card-code {
    color-scheme: light;
    inline-size: calc(var(--space-12) * 2);
    block-size: auto;
  }

  @media print {
    @page session-card {
      size: A5 portrait;
      margin: 10mm;
    }

    html:has(.session-card) {
      color-scheme: light;
      background: Canvas;
    }

    body:has(.session-card) {
      page: session-card;
    }

    body:has(.session-card),
    body :has(.session-card) {
      display: block !important;
      position: static !important;
      inline-size: auto !important;
      block-size: auto !important;
      min-block-size: 0 !important;
      max-block-size: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: Canvas !important;
      transform: none !important;
      opacity: 1 !important;
    }

    body:has(.session-card) > :not(:has(.session-card), .session-card),
    body :has(.session-card) > :not(:has(.session-card), .session-card),
    .session-card-controls {
      display: none !important;
    }

    .session-card {
      display: flex;
      flex-direction: column;
      inline-size: 100%;
      max-inline-size: 128mm;
      min-block-size: 189mm;
      margin: 0 auto;
      background: Canvas;
      color: CanvasText;
    }

    .session-card * {
      color: inherit !important;
    }

    .session-card li,
    .session-card footer {
      break-inside: avoid;
    }

    .session-card footer {
      margin-block-start: auto;
    }
  }
`;

function isPublicSession(data: PublicSession): boolean {
  return typeof data === 'object' && data !== null && typeof data.event_date === 'string' && data.event_date.length > 0
    && typeof data.title === 'string' && typeof data.slug === 'string';
}

export default function SessionCardPage() {
  const { slug } = useParams<'slug'>();
  const session = useQuery<PublicSession>({
    queryKey: ['event-public', slug],
    queryFn: () => api.events.getPublic(encodeURIComponent(slug!)),
    enabled: !!slug,
    ...PART_QUERY,
  });
  // A body without a title and a day is not a session: read as a failed load, never a crash (W5-2).
  const sessionView = partView(session, isPublicSession);
  const menu = useQuery<PublicTea[]>({
    queryKey: ['session-card-tea-menu', slug],
    queryFn: () => api.events.getPublicTeaMenu(encodeURIComponent(slug!)),
    enabled: sessionView.state === 'ready',
    ...PART_QUERY,
  });
  const menuView = partView(menu);

  if (!slug || sessionView.state === 'closed') {
    return <p role="status" className={TYPOGRAPHY_CLASSES.body}>There is no session card at this address.</p>;
  }
  // A failed read says so at once, with a way to try again (W5-1).
  if (sessionView.state === 'failed' || menuView.state === 'failed') {
    return <LoadFailed className="pt-6" sentence="Could not load the session card just now."
      onRetry={() => { if (sessionView.state === 'failed') sessionView.retry(); else if (menuView.state === 'failed') menuView.retry(); }} />;
  }
  if (sessionView.state !== 'ready' || menuView.state !== 'ready') {
    return <p role="status" className={TYPOGRAPHY_CLASSES.body}>Loading the session card…</p>;
  }

  const event = sessionView.data;
  const host = event.hosts?.find(person => person.role === 'lead_host')
    ?? event.hosts?.find(person => person.role === 'co_host' || person.role === 'guest_host');
  const hostName = host?.display_name || event.account_name;
  const day = new Date(event.event_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: event.event_date.length === 10 ? 'UTC' : event.timezone || undefined,
  });
  const publicPath = `/event/${encodeURIComponent(event.slug)}`;
  const publicUrl = `https://teajia.com${publicPath}`;
  const teas = (Array.isArray(menuView.data) ? [...menuView.data] : []).sort((a, b) => (a.brew_order ?? 0) - (b.brew_order ?? 0));

  return (
    <section className="mx-auto max-w-prose pt-6 pb-nav">
      <style>{printStyles}</style>
      <div className="session-card-controls mb-4 flex flex-wrap justify-end">
        <Button type="button" className="tap-target" onClick={() => window.print()}>Print</Button>
      </div>
      <article className="session-card grid gap-6 bg-tea-bg text-tea-text">
        <header className="grid gap-1">
          <h1 className={TYPOGRAPHY_CLASSES.h1}>{event.title}</h1>
          <p className={TYPOGRAPHY_CLASSES.body}><time dateTime={event.event_date}>{day}</time></p>
          {hostName && <p className={TYPOGRAPHY_CLASSES.body}>Hosted by {hostName}</p>}
        </header>
        {teas.length > 0 && (
          <>
            <ol aria-label="Teas in pouring order" className="grid list-decimal gap-2 pl-6">
              {teas.map(tea => {
                const place = [tea.product_origin_region, tea.product_origin_country].filter(Boolean).join(', ');
                const details = [tea.product_year, place].filter(Boolean).join(' · ');
                return (
                  <li className={TYPOGRAPHY_CLASSES.body} key={tea.id}>
                    {tea.custom_name || tea.given_name || tea.product_name}
                    {details && <span className="block">{details}</span>}
                  </li>
                );
              })}
            </ol>
            <footer className="grid justify-items-start gap-1">
              <h2 className={TYPOGRAPHY_CLASSES.h3}>Afterward</h2>
              <QRCodeSVG
                className="session-card-code block max-w-full"
                value={publicUrl}
                includeMargin
                bgColor="Canvas"
                fgColor="CanvasText"
                role="img"
                aria-label="Session link QR code"
              />
              <a href={publicUrl} className={`${TYPOGRAPHY_CLASSES.body} tap-target break-all`}>
                teajia.com{publicPath}
              </a>
            </footer>
          </>
        )}
      </article>
    </section>
  );
}
