import { Section } from '../types';

export const SECTION_TO_PATH: Record<Section, string> = {
  HOME: '/',
  MAGAZINE: '/magazine',
  LEARN: '/learn',
  SHOP: '/shop',
  OFFERINGS: '/consult',
  EVENTS: '/events',
  ACCOUNT: '/account',
  ABOUT: '/about',
};

export const PATH_TO_SECTION: Record<string, Section> = Object.fromEntries(
  Object.entries(SECTION_TO_PATH).map(([section, path]) => [path, section as Section])
) as Record<string, Section>;

export function pathToSection(pathname: string): Section {
  // Exact match first
  if (PATH_TO_SECTION[pathname]) return PATH_TO_SECTION[pathname];
  // Nested route match (e.g. /shop/product/xxx -> SHOP)
  for (const [path, section] of Object.entries(PATH_TO_SECTION)) {
    if (path !== '/' && pathname.startsWith(path + '/')) return section;
  }
  return 'HOME';
}

export function sectionToPath(section: Section): string {
  return SECTION_TO_PATH[section] || '/';
}
