import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicSessionTea, SessionPerson, SessionPhotograph, SessionSignature } from '../../../shared/sessionTea';
import { countWord } from '../people/profileFormat';
import { sessionPhotoSrc } from '../../lib/publicSitRecap';
import { SessionTeaRow } from './SessionTeaRow';
import { useSessionPhotoImage, type SessionPhotoSource } from './SessionPhoto';

// The parts a session is drawn with, on a profile and on its recap
// (approved drawing "The profile and the recap it opens", 2026-11-24).
// Each session is one edge-to-edge block on the lifted ground with a clear gap
// before the next. Labels are the profile's small label and hairline.

const PART_WORD: Record<string, string> = { lead_host: 'Host', co_host: 'Co-host', guest_host: 'Pouring' };

/** The small label and hairline both profile sections open with. */
export function SectionRule({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <h2 className="font-sans text-ui-10 font-medium uppercase tracking-[0.24em] text-tea-text-dim">{label}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-tea-border" />
    </div>
  );
}

const personLink = 'tap-target text-tea-text underline decoration-tea-border underline-offset-4 hover:text-tea-gold-lt';

/** "Host Mei Lin · Pouring Practice Host", each name opening that profile. */
export function SessionPeople({ people }: { people: SessionPerson[] }) {
  const shown = people.filter(person => PART_WORD[person.role]);
  if (!shown.length) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-1.5 font-sans text-ui-13 text-tea-text-dim" data-testid="session-people">
      {shown.map((person, index) => (
        <Fragment key={`${person.slug}-${person.role}`}>
          {index > 0 && <span aria-hidden="true">·</span>}
          <span>{PART_WORD[person.role]}</span>
          <Link className={personLink} to={`/people/${encodeURIComponent(person.slug)}`}>{person.name}</Link>
        </Fragment>
      ))}
    </p>
  );
}

function signature(by: SessionSignature) {
  return `${by.name}, ${by.part}`;
}

/** Whose words these are, and their part. */
export function SessionNote({ text, by, className = '' }: { text: string; by: SessionSignature | null; className?: string }) {
  return (
    <blockquote className={`m-0 grid gap-1.5 border-l border-tea-gold pl-3.5 ${className}`}>
      <p className="m-0 whitespace-pre-line break-words font-body text-ui-15 italic leading-relaxed text-tea-text">{text}</p>
      {by && <footer className="font-sans text-ui-12 text-tea-text-dim">{signature(by)}</footer>}
    </blockquote>
  );
}

/** "Mon 23 Nov": the short date a session leads with. */
export function sessionDate(value: string): string {
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return value;
  return day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

export function pouredLabel(count: number) {
  return `Poured · ${countWord(count)} ${count === 1 ? 'tea' : 'teas'}`;
}

export function PouredTeas({ teas }: { teas: PublicSessionTea[] }) {
  if (!teas.length) return null;
  return (
    <div className="px-6 pb-1.5" data-testid="session-poured">
      <SectionRule label={pouredLabel(teas.length)} className="mb-1" />
      {teas.map((tea, index) => <SessionTeaRow key={tea.id ?? `${tea.name}-${index}`} tea={tea} />)}
    </div>
  );
}

/** The lead photograph, opening the recap. */
export function LeadPhoto({ source, to, title }: { source: SessionPhotoSource; to: string; title: string }) {
  const { image } = useSessionPhotoImage(source);
  if (!image) return null;
  return (
    <Link to={to} aria-label={`Open the recap of ${title}`} className="block">
      <img src={image} alt="" className="block aspect-[16/10] w-full object-cover" />
    </Link>
  );
}

/** Up to three small photographs and a count of the rest, each opening the recap. */
export function PhotoStrip({ photos, more, to }: { photos: SessionPhotograph[]; more: number; to: string }) {
  if (!photos.length) return null;
  return (
    <div className="mt-0.5 grid grid-cols-4 gap-0.5" data-testid="session-photo-strip">
      {photos.slice(0, 3).map(photo => (
        <Link key={photo.src} to={to} aria-label={photo.alt} className="block">
          <img src={sessionPhotoSrc(photo.src)} alt="" loading="lazy" className="block aspect-square w-full object-cover" />
        </Link>
      ))}
      {more > 0 && (
        <Link to={to} className="grid aspect-square place-items-center bg-tea-bg font-sans text-ui-13 text-tea-text-sec"
          aria-label={`${more} more photographs`}>+{more}</Link>
      )}
    </div>
  );
}

/** The session header: date and part, title, people. */
export function SessionHead({ date, part, title, to, people, level = 'h3' }: {
  date: string; part: string; title: string; to?: string; people: SessionPerson[];
  /** The recap page names the sit as its page title. */
  level?: 'h1' | 'h3';
}) {
  const Heading = level;
  const heading = <span className="font-display text-ui-24 leading-tight text-tea-text">{title}</span>;
  return (
    <div className="grid gap-1.5 px-6 pt-4">
      <p className="m-0 font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-text-dim">
        <span className="text-tea-gold-lt">{date}</span> · {part}
      </p>
      <Heading className="m-0 font-normal">{to ? <Link to={to} className="hover:text-tea-gold-lt">{heading}</Link> : heading}</Heading>
      <SessionPeople people={people} />
    </div>
  );
}

/** "Next sit": the date plate, title, day and host, and "Ask for a seat". */
export function NextSitRow({ slug, title, date, host }: { slug: string; title: string; date: string; host: string }) {
  const day = new Date(date);
  const valid = !Number.isNaN(day.getTime());
  const href = `/event/${encodeURIComponent(slug)}`;
  return (
    <div className="relative -mx-6 flex items-center gap-2.5 border-y border-tea-border bg-tea-surface px-6 py-3" data-testid="profile-next-sit">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-tea-gold" />
      <span className="tea-save-tile shrink-0" aria-hidden="true">
        <span className="grid justify-items-center gap-1">
          <span className="font-display text-ui-20 leading-none text-tea-text-sec">{valid ? day.getDate() : ''}</span>
          <span className="h-px w-6 bg-tea-border" />
          <span className="font-sans text-ui-12 text-tea-text-sec">{valid ? day.toLocaleDateString('en-GB', { month: 'short' }) : ''}</span>
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-gold-lt">Next sit</p>
        <p className="m-0 truncate font-display text-ui-20 leading-tight text-tea-text">{title}</p>
        <p className="m-0 truncate font-sans text-ui-13 text-tea-text-sec">
          {valid ? day.toLocaleDateString('en-GB', { weekday: 'long' }) : ''}{valid ? ' · ' : ''}Host {host}
        </p>
      </div>
      <Link to={href} className="btn-secondary btn-sm shrink-0">Ask for a seat</Link>
    </div>
  );
}

/** One session as an edge-to-edge block on the lifted ground. */
export function SessionBlock({ children, testId = 'session-block' }: { children: ReactNode; testId?: string }) {
  return (
    <article className="-mx-6 grid border-y border-tea-border bg-tea-surface" data-testid={testId}>
      {children}
    </article>
  );
}

export function OpenRecapRow({ to }: { to: string }) {
  return (
    <Link to={to} className="flex min-h-tap items-center justify-between border-t border-tea-border bg-tea-bg px-6 py-3 font-sans text-ui-11 uppercase tracking-[0.12em] text-tea-text-sec hover:text-tea-text">
      <span>All photographs and guest book</span>
      <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 border-r border-t border-current" />
    </Link>
  );
}
