// Which magazine articles name a person, so they reach that person's page
// without anyone ticking them as a subject (Adrian, 2026-09-29: the articles
// someone is featured in "should be automatic").
//
// An article names a person when its title, subtitle or body carries their
// full display name, or the name they write in Chinese. The match is exact
// and case-sensitive (SQLite instr, not LIKE), and a name has to be specific
// enough to trust: at least two words and six letters, so "Mei" or "Lin" on
// its own never pulls in every article that happens to contain the word. A
// Chinese name needs two characters. When neither is trustworthy the needle is
// empty and only the explicit subject tag counts, exactly as before.

/** The strings that name this person in an article, [display name, Chinese name]; '' where a name is too short to trust. */
export function mentionNeedles(person: { display_name?: unknown; chinese_name?: unknown }): [string, string] {
  const name = typeof person.display_name === 'string' ? person.display_name.trim().replace(/\s+/g, ' ') : '';
  const words = name.split(' ').filter(Boolean);
  const nameNeedle = words.length >= 2 && name.replace(/\s/g, '').length >= 6 ? name : '';
  const script = typeof person.chinese_name === 'string' ? person.chinese_name.trim() : '';
  const scriptNeedle = [...script].length >= 2 && /[^\u0000-\u007f]/.test(script) ? script : '';
  return [nameNeedle, scriptNeedle];
}
