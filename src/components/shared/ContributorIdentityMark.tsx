import React from 'react';
import { Icons } from '../Icons';

interface ContributorIdentityMarkProps {
  name: string;
  className?: string;
  decorative?: boolean;
}

export const initialsFor = (name: string) => name
  .trim()
  .split(/\s+/)
  .map(part => Array.from(part).find(character => /\p{L}/u.test(character)))
  .filter((character): character is string => Boolean(character))
  .slice(0, 2)
  .map(character => character.toLocaleUpperCase())
  .join('');

export const ContributorIdentityMark: React.FC<ContributorIdentityMarkProps> = ({ name, className = '', decorative = true }) => {
  const initials = initialsFor(name);
  return (
    <div
      className={`relative isolate flex h-full w-full items-center justify-center overflow-hidden bg-tea-elevated text-tea-gold ${className}`}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${name} identity mark` })}
    >
      <span className="absolute inset-[10%] rounded-full border border-tea-border" aria-hidden="true" />
      <Icons.Seal className={`absolute h-[58%] w-[58%] ${initials ? 'opacity-[0.12]' : 'opacity-70'}`} aria-hidden="true" />
      {initials && (
        <span className="relative font-display text-ui-28 tracking-[0.08em] text-tea-text">
          {initials}
        </span>
      )}
    </div>
  );
};

export default ContributorIdentityMark;
