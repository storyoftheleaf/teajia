/**
 * The byline every conversation piece carries under its cover, as a short
 * ledger: A conversation / With them / By Adrian / Length. Adrian made the
 * conversation and wrote the piece, so it is his byline; never "told by",
 * "in their own words" or "interview" (Adrian, 2026-10-01: "It's a
 * conversation with him by me"). The magazine template (TEMPLATE.md section 2)
 * names this as the one byline; change both together.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import './byline.css';

export type BylinePerson = { name: string; nameCn?: string; href?: string };

/** Adrian, as every piece credits him. His Teajia page is the link; his other links live in each piece's colophon. */
export const BYLINE_AUTHOR: BylinePerson = { name: 'Adrian Rasmussen', href: '/people/adrian-rasmussen' };

const Person: React.FC<{ person: BylinePerson }> = ({ person }) => (
  <>
    {person.href ? <Link to={person.href}>{person.name}</Link> : person.name}
    {person.nameCn && <span lang="zh-Hans" className="tj-conv-cn"> {person.nameCn}</span>}
  </>
);

/** "6 minutes, 25 photographs", or just the minutes when the piece has no photographs yet. */
export function lengthLine(minutes: number, photos?: number): string {
  const m = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return photos ? `${m}, ${photos} photograph${photos === 1 ? '' : 's'}` : m;
}

export const ConversationByline: React.FC<{
  /** The people the conversation is with, in the order the piece names them. */
  people: BylinePerson[];
  by?: BylinePerson;
  minutes: number;
  photos?: number;
}> = ({ people, by = BYLINE_AUTHOR, minutes, photos }) => (
  <div className="tj-conv-byline">
    <p className="tj-conv-byline-kind">A conversation</p>
    <dl className="tj-conv-byline-ledger">
      <div>
        <dt>With</dt>
        <dd className="tj-conv-byline-name">
          {people.map((p, i) => (
            <React.Fragment key={p.name}>
              {i > 0 && <span className="tj-conv-byline-and">{i === people.length - 1 ? ' and ' : ', '}</span>}
              <Person person={p} />
            </React.Fragment>
          ))}
        </dd>
      </div>
      <div>
        <dt>By</dt>
        <dd className="tj-conv-byline-name"><Person person={by} /></dd>
      </div>
      <div>
        <dt>Length</dt>
        <dd className="tj-conv-byline-read">{lengthLine(minutes, photos)}</dd>
      </div>
    </dl>
  </div>
);
