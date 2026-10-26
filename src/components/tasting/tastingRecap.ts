import type { TastingData } from '../../types';
import { resolveTermLabel } from '../../data/tastingTaxonomy';
import { selectedSensations, type SensationSection, type SensoryTastingData } from './connectedSensationsVocabulary';
import { tastingWordLabel } from './approvedWheel/observations';
import { STORAGE_CHARACTER_WORDS, withStorageCharacter } from './StorageZone';

export interface TastingRecapGroup {
  id: string;
  label: string;
  words: Array<{ id: string; label: string }>;
}

/** Labels can evolve; resume links always retain the original observation ID. */
export function tastingRecap(value: TastingData): TastingRecapGroup[] {
  const data = value as SensoryTastingData;
  function sensations(section: SensationSection) {
    const selected = selectedSensations(value, section);
    const words = selected.map(({ id, label }) => ({ id, label }));
    const known = new Set(selected.map(term => term.id));
    const legacy = section === 'body' ? [...(value.body ?? []), ...(value.finish ?? [])] : value.feeling ?? [];
    for (const id of legacy) if (!known.has(id)) { words.push({ id, label: resolveTermLabel(id) }); known.add(id); }
    for (const word of data.sensoryCustom?.[section] ?? []) if (!known.has(word)) { words.push({ id: word, label: word }); known.add(word); }
    return words;
  }
  const character = withStorageCharacter(value, value.storageCharacter).storageCharacter;
  const storage: {id:string;label:string}[] = character === undefined ? [] : [{ id: 'storage-character', label: STORAGE_CHARACTER_WORDS[character] }];
  storage.push(...(value.storageNotes ?? []).map(id => ({ id, label: id })));
  const appearance = (value['liquor-color'] ?? []).map(id => ({ id, label: resolveTermLabel(id) }));
  if (value.clarity) appearance.push({ id: value.clarity, label: resolveTermLabel(value.clarity) });
  const groups: TastingRecapGroup[] = [
    { id: 'body', label: 'Texture', words: sensations('body') },
    { id: 'state', label: 'Effect', words: sensations('state') },
    { id: 'flavor', label: 'Taste', words: (value.flavor ?? []).map(id => ({ id, label: tastingWordLabel(id) })) },
    { id: 'aroma', label: 'Aroma', words: (value.aroma ?? []).map(id => ({ id, label: tastingWordLabel(id) })) },
    { id: 'storage', label: 'Storage', words: storage },
    { id: 'appearance', label: 'Appearance', words: appearance },
  ];
  return groups.map(group => ({ ...group, words: group.words.filter((word, index, words) => words.findIndex(other => other.id === word.id) === index) })).filter(group => group.words.length > 0);
}
