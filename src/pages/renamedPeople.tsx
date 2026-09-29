/**
 * A person's page address is their profile id, and an id is fixed once saved.
 * When one has to change anyway (a name that was wrong), the old address is
 * kept working here, so links already shared land on the new page with any
 * query or anchor intact (a pay link's ?t= token rides on the query).
 *
 * shangyin-qiwu → yan-jinwen: "Shangyin Qiwu 上隐器物" was a mistranslation of
 * his studio's name; he is Yan Jinwen 严金文. Migration 0029 moved the row.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const RENAMED_PEOPLE: Readonly<Record<string, string>> = {
  'shangyin-qiwu': 'yan-jinwen',
};

/** The current address of a /people path whose person was renamed, or null. */
export function renamedPersonPath(pathname: string): string | null {
  const match = pathname.match(/^\/people\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const next = RENAMED_PEOPLE[decodeURIComponent(match[1])];
  return next ? `/people/${next}${match[2] ?? ''}` : null;
}

/** Renders its children, unless the address belongs to a renamed person. */
export const FollowRenamedPerson: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const next = renamedPersonPath(location.pathname);
  return next ? <Navigate to={`${next}${location.search}${location.hash}`} replace /> : <>{children}</>;
};
