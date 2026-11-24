import { describe, expect, it } from 'vitest';
import { groupGuestBookEntries } from './groupGuestBookEntries';

describe('Guest Book entries', () => {
  it('keeps a note and earlier photos together by the scoped entry key', () => {
    const note = { id: 'n1', display_name: 'Mei', entry_key: 'guest-a', note: 'Tea at dusk' };
    const photo = { id: 'p1', display_name: 'Mei', entry_key: 'guest-a' };
    const olderPhoto = { id: 'p2', display_name: 'Mei', entry_key: 'guest-a' };
    expect(groupGuestBookEntries([note], [photo, olderPhoto])).toEqual([
      { key: 'guest-a', displayName: 'Mei', note, photos: [photo, olderPhoto] },
    ]);
  });

  it('keeps different attendees with the same name separate, including earlier responses without keys', () => {
    const note = { id: 'same-id', display_name: 'Mei', entry_key: 'guest-a' };
    const photos = [
      { id: 'same-id', display_name: 'Mei', entry_key: 'guest-b' },
      { id: 'p2', display_name: 'Mei' },
    ];
    expect(groupGuestBookEntries([note], photos).map(entry => entry.key)).toEqual(['guest-a', 'guest-b', 'photo:p2']);
    expect(groupGuestBookEntries([{ id: 'same-id', display_name: 'Mei' }], [photos[0]]).map(entry => entry.key))
      .toEqual(['note:same-id', 'guest-b']);
  });
});
