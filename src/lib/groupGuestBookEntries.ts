type GuestBookPart = { id: string; display_name: string; entry_key?: string };

export function groupGuestBookEntries<TNote extends GuestBookPart, TPhoto extends GuestBookPart>(
  notes: readonly TNote[], photos: readonly TPhoto[],
) {
  const entries = new Map<string, { key: string; displayName: string; note?: TNote; photos: TPhoto[] }>();
  for (const note of notes) {
    const key = note.entry_key ?? 'note:' + note.id;
    entries.set(key, { key, displayName: note.display_name, note, photos: [] });
  }
  for (const photo of photos) {
    const key = photo.entry_key ?? 'photo:' + photo.id;
    const entry = entries.get(key);
    if (entry) entry.photos.push(photo);
    else entries.set(key, { key, displayName: photo.display_name, photos: [photo] });
  }
  return [...entries.values()];
}
