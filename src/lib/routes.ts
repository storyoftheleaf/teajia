import { Section } from '../types';

export const SECTION_TO_PATH: Record<Section, string> = {
  HOME: '/',
  MAGAZINE: '/magazine',
  LEARN: '/learn',
  SHOP: '/shop',
  OFFERINGS: '/consult',
  ACCOUNT: '/account',
  ABOUT: '/about',
};

export const PATH_TO_SECTION: Record<string, Section> = Object.fromEntries(
  Object.entries(SECTION_TO_PATH).map(([section, path]) => [path, section as Section])
) as Record<string, Section>;

export function pathToSection(pathname: string): Section {
  return PATH_TO_SECTION[pathname] || 'HOME';
}

export function sectionToPath(section: Section): string {
  return SECTION_TO_PATH[section] || '/';
}
