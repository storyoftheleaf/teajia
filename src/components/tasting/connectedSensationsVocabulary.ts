import type { TastingData } from '../../types';

export type SensationSection = 'body' | 'state';
export type SensationField = 'body' | 'finish' | 'feeling';
export interface SensationTerm { id: string; label: string; meaning: string; field: SensationField }
export interface SensationGroup { id: string; label: string; hint: string; single: boolean; terms: SensationTerm[] }
export type SensoryTastingData = TastingData & { sensoryCustom?: Partial<Record<SensationSection, string[]>> };

export const SENSATION_GROUPS: Record<SensationSection, SensationGroup[]> = {
  "body": [
    {
      "id": "throat",
      "label": "Throat feel",
      "hint": "How swallowing feels.",
      "single": true,
      "terms": [
        {
          "id": "throat-comfortable",
          "label": "Comfortable",
          "meaning": "Swallowing feels easy and comfortable.",
          "field": "finish"
        },
        {
          "id": "throat-slight-edge",
          "label": "Slight edge",
          "meaning": "A little roughness when swallowing.",
          "field": "finish"
        },
        {
          "id": "throat-irritated",
          "label": "Irritated",
          "meaning": "An uncomfortable irritation in the throat.",
          "field": "finish"
        }
      ]
    },
    {
      "id": "texture",
      "label": "Texture",
      "hint": "Compare the feel as the tea moves.",
      "single": false,
      "terms": [
        {
          "id": "silky",
          "label": "Silky",
          "meaning": "Fine and flowing, with a silk-like feel.",
          "field": "body"
        },
        {
          "id": "smooth",
          "label": "Smooth",
          "meaning": "Little friction or roughness.",
          "field": "body"
        },
        {
          "id": "velvety",
          "label": "Velvety",
          "meaning": "Soft, plush and gently coating.",
          "field": "body"
        },
        {
          "id": "slippery",
          "label": "Slippery",
          "meaning": "Slides easily across the mouth.",
          "field": "body"
        },
        {
          "id": "oily",
          "label": "Oily",
          "meaning": "Slick and lubricating; does not imply actual oil.",
          "field": "body"
        },
        {
          "id": "rough",
          "label": "Rough",
          "meaning": "Noticeable friction or unevenness.",
          "field": "body"
        }
      ]
    },
    {
      "id": "weight",
      "label": "Weight",
      "hint": "The substance of the liquid.",
      "single": true,
      "terms": [
        {
          "id": "light",
          "label": "Light",
          "meaning": "Little weight on the tongue.",
          "field": "body"
        },
        {
          "id": "medium",
          "label": "Medium",
          "meaning": "Some substance, between light and full.",
          "field": "body"
        },
        {
          "id": "full",
          "label": "Full",
          "meaning": "A substantial, full-bodied liquid.",
          "field": "body"
        }
      ]
    },
    {
      "id": "finish",
      "label": "After the sip",
      "hint": "What remains after swallowing.",
      "single": false,
      "terms": [
        {
          "id": "coating",
          "label": "Coating",
          "meaning": "A layer-like sensation remains after swallowing.",
          "field": "finish"
        },
        {
          "id": "finish-dry",
          "label": "Drying",
          "meaning": "The mouth feels drier or less lubricated.",
          "field": "finish"
        },
        {
          "id": "salivating",
          "label": "Mouth-watering",
          "meaning": "The tea prompts more saliva.",
          "field": "finish"
        },
        {
          "id": "clean-finish",
          "label": "Clean finish",
          "meaning": "Little lingering film or friction.",
          "field": "finish"
        }
      ]
    },
    {
      "id": "local",
      "label": "Local sensation",
      "hint": "In your mouth or throat.",
      "single": false,
      "terms": [
        {
          "id": "finish-cooling",
          "label": "Cooling",
          "meaning": "A cooling sensation beyond the drink’s temperature.",
          "field": "finish"
        },
        {
          "id": "finish-warming",
          "label": "Warming",
          "meaning": "A warming sensation in the mouth.",
          "field": "finish"
        },
        {
          "id": "tingling",
          "label": "Tingling",
          "meaning": "A light prickling sensation.",
          "field": "finish"
        },
        {
          "id": "tightening",
          "label": "Tightening",
          "meaning": "A contracting or puckering feeling.",
          "field": "finish"
        }
      ]
    },
    {
      "id": "duration",
      "label": "Persistence",
      "hint": "How long the sensation stays.",
      "single": true,
      "terms": [
        {
          "id": "finish-short",
          "label": "Brief",
          "meaning": "Fades quickly.",
          "field": "finish"
        },
        {
          "id": "finish-medium",
          "label": "Moderate",
          "meaning": "Stays for a little while.",
          "field": "finish"
        },
        {
          "id": "lingering",
          "label": "Lingering",
          "meaning": "Remains well after swallowing.",
          "field": "finish"
        }
      ]
    }
  ],
  "state": [
    {
      "id": "mood",
      "label": "Mood",
      "hint": "Settled, lifted, or restless.",
      "single": false,
      "terms": [
        {
          "id": "calming",
          "label": "Calm",
          "meaning": "Settled and at ease.",
          "field": "feeling"
        },
        {
          "id": "uplifting",
          "label": "Uplifted",
          "meaning": "Your mood feels lighter or brighter.",
          "field": "feeling"
        },
        {
          "id": "grounding",
          "label": "Grounded",
          "meaning": "You feel present and steady.",
          "field": "feeling"
        },
        {
          "id": "restless",
          "label": "Restless",
          "meaning": "It feels difficult to settle.",
          "field": "feeling"
        }
      ]
    },
    {
      "id": "activation",
      "label": "Energy",
      "hint": "Your level of activation.",
      "single": false,
      "terms": [
        {
          "id": "energizing",
          "label": "Energized",
          "meaning": "You feel more activated or ready to act.",
          "field": "feeling"
        },
        {
          "id": "alert",
          "label": "Alert",
          "meaning": "Awake and attentive.",
          "field": "feeling"
        },
        {
          "id": "drowsy",
          "label": "Drowsy",
          "meaning": "Sleepy or less alert.",
          "field": "feeling"
        },
        {
          "id": "jittery",
          "label": "Jittery",
          "meaning": "Shaky or uncomfortably overstimulated.",
          "field": "feeling"
        }
      ]
    },
    {
      "id": "mind",
      "label": "Mind",
      "hint": "Clarity and attention.",
      "single": false,
      "terms": [
        {
          "id": "clarifying",
          "label": "Clear-headed",
          "meaning": "Thinking feels clear and less muddled.",
          "field": "feeling"
        },
        {
          "id": "focusing",
          "label": "Focused",
          "meaning": "It feels easier to stay with one thing.",
          "field": "feeling"
        },
        {
          "id": "foggy",
          "label": "Foggy",
          "meaning": "Thinking feels muddled.",
          "field": "feeling"
        },
        {
          "id": "distracted",
          "label": "Distracted",
          "meaning": "Your attention keeps wandering.",
          "field": "feeling"
        }
      ]
    },
    {
      "id": "physical",
      "label": "Body",
      "hint": "Beyond the mouth and throat.",
      "single": false,
      "terms": [
        {
          "id": "feeling-warming",
          "label": "Warmth",
          "meaning": "A sense of warmth through the body.",
          "field": "feeling"
        },
        {
          "id": "lightness",
          "label": "Lightness",
          "meaning": "Your body feels light or unburdened.",
          "field": "feeling"
        },
        {
          "id": "heaviness",
          "label": "Heaviness",
          "meaning": "Your body feels heavy or weighted.",
          "field": "feeling"
        },
        {
          "id": "stomach-discomfort",
          "label": "Stomach discomfort",
          "meaning": "An uncomfortable sensation in the stomach.",
          "field": "feeling"
        },
        {
          "id": "feeling-tingling",
          "label": "Tingling",
          "meaning": "A prickling sensation beyond the mouth.",
          "field": "feeling"
        }
      ]
    },
    {
      "id": "change",
      "label": "Change noticed",
      "hint": "An answer is optional.",
      "single": false,
      "terms": [
        {
          "id": "no-clear-change",
          "label": "No clear change",
          "meaning": "No particular change noticed. This is different from leaving the question unanswered.",
          "field": "feeling"
        }
      ]
    }
  ]
};

export function sensationAllowsIntensity(groupId: string, termId: string): boolean {
  return !['weight', 'duration', 'change'].includes(groupId)
    && !['throat-comfortable', 'clean-finish'].includes(termId);
}

function clearSensationIntensities(value: SensoryTastingData, ids: string[]) {
  if (!value.observationIntensity || !ids.length) return;
  value.observationIntensity = { ...value.observationIntensity };
  for (const id of ids) delete value.observationIntensity[`sensation:${id}`];
}

const LEGACY_THROAT: Record<string, string> = { clean: 'throat-comfortable', 'some-edge': 'throat-slight-edge', rough: 'throat-irritated' };

export function sensationIsSelected(value: TastingData, term: SensationTerm): boolean {
  return !!value[term.field]?.includes(term.id) || (term.id === LEGACY_THROAT[value.cleanliness ?? '']);
}

export function selectedSensations(value: TastingData, section: SensationSection) {
  return SENSATION_GROUPS[section].flatMap(group => group.terms.filter(term => sensationIsSelected(value, term)).map(term => ({ ...term, group: group.id })));
}

export function toggleSensation(value: SensoryTastingData, section: SensationSection, groupId: string, termId: string): SensoryTastingData {
  const group = SENSATION_GROUPS[section].find(item => item.id === groupId);
  const term = group?.terms.find(item => item.id === termId);
  if (!group || !term) return value;
  const wasSelected = sensationIsSelected(value, term);
  const next = { ...value };
  if (groupId === 'throat' && value.cleanliness && LEGACY_THROAT[value.cleanliness]) {
    next.finish = [...new Set([...(value.finish ?? []), LEGACY_THROAT[value.cleanliness]])];
    next.cleanliness = undefined;
  }
  let current = next[term.field] ?? [];
  if (section === 'state') {
    if (term.id === 'no-clear-change' && !wasSelected) {
      clearSensationIntensities(next, [...(next.feeling ?? []), ...(next.sensoryCustom?.state ?? []).map(word => `custom:state:${word}`)]);
      next.feeling = ['no-clear-change'];
      next.sensoryCustom = { ...next.sensoryCustom, state: [] };
      return next;
    }
    current = current.filter(id => id !== 'no-clear-change');
  }
  const without = current.filter(id => id !== term.id && !(group.single && group.terms.some(option => option.id === id)));
  clearSensationIntensities(next, current.filter(id => !without.includes(id)));
  next[term.field] = wasSelected ? without : [...without, term.id];
  return next;
}

export function addSensoryCustom(value: SensoryTastingData, section: SensationSection, input: string): SensoryTastingData {
  const word = input.trim().replace(/\s+/g, ' ');
  if (!word) return value;
  const existing = value.sensoryCustom?.[section] ?? [];
  if (existing.some(item => item.toLocaleLowerCase() === word.toLocaleLowerCase())) return value;
  const known = SENSATION_GROUPS[section].flatMap(group => group.terms.map(term => ({ group, term }))).find(({ term }) => term.label.toLocaleLowerCase() === word.toLocaleLowerCase());
  if (known) return sensationIsSelected(value, known.term) ? value : toggleSensation(value, section, known.group.id, known.term.id);
  return { ...value, ...(section === 'state' ? { feeling: value.feeling?.filter(id => id !== 'no-clear-change') } : {}), sensoryCustom: { ...value.sensoryCustom, [section]: [...existing, word] } };
}

export function removeSensoryCustom(value: SensoryTastingData, section: SensationSection, word: string): SensoryTastingData {
  const next = { ...value, sensoryCustom: { ...value.sensoryCustom, [section]: (value.sensoryCustom?.[section] ?? []).filter(item => item !== word) } };
  clearSensationIntensities(next, [`custom:${section}:${word}`]);
  return next;
}
