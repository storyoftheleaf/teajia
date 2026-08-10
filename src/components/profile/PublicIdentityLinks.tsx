interface PublicIdentityLinksProps {
  contributorSlug?: string | null;
  shelfSlug?: string | null;
  subjectName: string;
  className?: string;
}

export function PublicIdentityLinks({ contributorSlug, shelfSlug, subjectName, className = '' }: PublicIdentityLinksProps) {
  if (!contributorSlug && !shelfSlug) return null;
  return (
    <nav aria-label={`${subjectName}'s public pages`} className={`flex flex-wrap gap-x-5 gap-y-2 text-ui-13 text-tea-text-sec ${className}`}>
      {contributorSlug && (
        <a href={`/people/${encodeURIComponent(contributorSlug)}`} className="tap-target border-b border-tea-border hover:border-tea-gold hover:text-tea-text">
          {subjectName}’s Tea Master profile
        </a>
      )}
      {shelfSlug && (
        <a href={`/u/${encodeURIComponent(shelfSlug)}`} className="tap-target border-b border-tea-border hover:border-tea-gold hover:text-tea-text">
          {subjectName}’s personal shelf
        </a>
      )}
    </nav>
  );
}
