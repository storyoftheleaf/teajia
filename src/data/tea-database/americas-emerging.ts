/**
 * Americas + emerging temperate origins. Camellia sinensis only — yerba mate,
 * yaupon, and guayusa go in `tisanes.ts` (they are Ilex, not Camellia).
 *
 * Most of these regions are recent or revived: cold-hardy sinensis cuttings
 * imported from Sochi/Korea/Japan or assamica clones from India.
 */

import type { TeaEntry, TeaRegion, TeaCultivar } from './types';

export const americasEmergingTeas: TeaEntry[] = [
  // ─── Argentina ────────────────────────────────────────────────────────────
  { id: 'ar-misiones-black', name: 'Misiones Black Tea',
    category: 'black', species: 'Camellia sinensis var. assamica',
    origin: { country: 'Argentina', province: 'Misiones' },
    description: 'Bulk subtropical black, mostly CTC — Argentina is one of the world\'s top tea exporters by volume.' },

  // ─── Brazil ───────────────────────────────────────────────────────────────
  {
    id: 'br-vale-do-ribeira-sencha',
    name: 'Vale do Ribeira Sencha',
    category: 'green',
    species: 'Camellia sinensis var. sinensis',
    origin: { country: 'Brazil', province: 'São Paulo', locality: 'Registro / Vale do Ribeira' },
    cultivar: ['Yabukita'],
    processing: ['steam', 'roll'],
    description: 'Japanese-immigrant heritage Brazilian sencha — the largest Yabukita-cultivar planting outside Japan.',
    flagship: true,
  },
  { id: 'br-amparo-black', name: 'Brazilian Black',
    category: 'black', origin: { country: 'Brazil', province: 'São Paulo' } },

  // ─── USA — South Carolina ────────────────────────────────────────────────
  {
    id: 'us-charleston-tea',
    name: 'Charleston Tea',
    category: 'black',
    origin: { country: 'USA', province: 'South Carolina', locality: 'Wadmalaw Island' },
    cultivar: ['American Classic (heritage seedlings, est. 1799)'],
    description: 'Charleston Tea Garden — only large-scale commercial US producer; Bigelow Tea ownership.',
    flagship: true,
  },

  // ─── USA — Mississippi ───────────────────────────────────────────────────
  {
    id: 'us-mississippi-tea-co',
    name: 'Great Mississippi Tea Co.',
    category: 'black',
    origin: { country: 'USA', province: 'Mississippi', locality: 'Brookhaven' },
    description: 'Artisan small-batch black, white, and oolong. Among the highest-quality US-grown teas.',
    flagship: true,
  },

  // ─── USA — Pacific Northwest emerging ────────────────────────────────────
  {
    id: 'us-minto-island',
    name: 'Minto Island Tea',
    category: 'green',
    origin: { country: 'USA', province: 'Oregon', locality: 'Salem (Minto Island)' },
    cultivar: ['Sochi-derived', 'Korean cold-hardy'],
    description: 'Cold-hardy cultivar trial farm — releases Northwest-grown green and white teas.',
    flagship: true,
  },
  { id: 'us-sakuma', name: 'Sakuma Brothers Tea',
    category: 'green', origin: { country: 'USA', province: 'Washington', locality: 'Burlington' } },
  { id: 'us-blue-dreams', name: 'Blue Dreams Tea (Oregon)',
    category: 'green', origin: { country: 'USA', province: 'Oregon' } },

  // ─── USA — Hawaii ────────────────────────────────────────────────────────
  {
    id: 'us-hi-mauna-kea-oolong',
    name: 'Hawaii Mauna Kea Oolong',
    category: 'oolong',
    origin: { country: 'USA', province: 'Hawaii', locality: 'Big Island, Mauna Kea slopes', elevation: '600–1100 m' },
    cultivar: ['Yabukita', 'Bohea'],
    description: 'Volcanic-soil tea — small-batch oolongs, whites, and blacks from boutique Hawaii growers.',
    flagship: true,
  },
  { id: 'us-hi-onomea', name: 'Onomea Tea',
    category: 'oolong', origin: { country: 'USA', province: 'Hawaii', locality: 'Onomea' } },
  { id: 'us-hi-volcano', name: 'Volcano Tea',
    category: 'black', origin: { country: 'USA', province: 'Hawaii', locality: 'Volcano' } },

  // ─── USA — Alabama ───────────────────────────────────────────────────────
  { id: 'us-fairhope', name: 'Fairhope Tea (Alabama)',
    category: 'black', origin: { country: 'USA', province: 'Alabama', locality: 'Fairhope' } },

  // ─── Colombia ────────────────────────────────────────────────────────────
  {
    id: 'co-bitaco',
    name: 'Bitaco',
    category: 'green',
    origin: { country: 'Colombia', province: 'Valle del Cauca', locality: 'Bitaco', elevation: '1500–1800 m' },
    description: 'Premium organic Andean estate — among the most well-known South American specialty teas.',
    flagship: true,
  },

  // ─── Ecuador / Peru ──────────────────────────────────────────────────────
  { id: 'ec-sangay', name: 'Sangay Tea',
    category: 'black', origin: { country: 'Ecuador', province: 'Sangay region' } },
  { id: 'pe-junin', name: 'Peru Junín',
    category: 'black', origin: { country: 'Peru', province: 'Junín' } },

  // ─── Australia ────────────────────────────────────────────────────────────
  { id: 'au-nerada', name: 'Nerada Tea',
    category: 'black', origin: { country: 'Australia', province: 'Queensland', locality: 'Atherton Tablelands' },
    description: 'Australia\'s largest tea producer.' },
  { id: 'au-madura', name: 'Madura Tea',
    category: 'black', origin: { country: 'Australia', province: 'New South Wales', locality: 'Northern Rivers' } },
  { id: 'au-daintree', name: 'Daintree Tea',
    category: 'black', origin: { country: 'Australia', province: 'Queensland', locality: 'Daintree' } },
  { id: 'au-westerway', name: 'Westerway Tasmania Tea',
    category: 'green', origin: { country: 'Australia', province: 'Tasmania', locality: 'Westerway' } },

  // ─── New Zealand ──────────────────────────────────────────────────────────
  {
    id: 'nz-zealong',
    name: 'Zealong Oolong',
    category: 'oolong',
    species: 'Camellia sinensis var. sinensis',
    origin: { country: 'New Zealand', province: 'Waikato', locality: 'Hamilton' },
    cultivar: ['Qing Xin', 'Si Ji Chun'],
    description: 'Boutique Taiwanese-style oolong estate — biodynamic / organic.',
    flagship: true,
  },
  { id: 'nz-zealong-black', name: 'Zealong Black',
    category: 'black', origin: { country: 'New Zealand', province: 'Waikato' } },

  // ─── UK ───────────────────────────────────────────────────────────────────
  {
    id: 'gb-tregothnan',
    name: 'Tregothnan',
    category: 'black',
    origin: { country: 'UK', province: 'Cornwall', locality: 'Truro' },
    description: 'Largest UK-grown tea estate (since 1999) — blacks, oolongs, greens from cold-hardy sinensis hybrids.',
    flagship: true,
  },
  { id: 'gb-wee-tea-perthshire', name: 'Wee Tea Plantation (Perthshire)',
    category: 'white', origin: { country: 'UK', province: 'Scotland', locality: 'Perthshire' },
    description: 'Dalreoch White — first commercially marketed Scottish white tea.' },

  // ─── Portugal / Azores ────────────────────────────────────────────────────
  {
    id: 'pt-gorreana',
    name: 'Gorreana',
    category: 'black',
    origin: { country: 'Portugal', province: 'Azores', locality: 'São Miguel Island' },
    description: 'Oldest tea plantation in Europe — operating since 1883. Organic by default (no pests at this latitude).',
    flagship: true,
  },
  { id: 'pt-porto-formoso', name: 'Porto Formoso Tea',
    category: 'black', origin: { country: 'Portugal', province: 'Azores', locality: 'São Miguel Island' } },
  { id: 'pt-gorreana-green', name: 'Gorreana Hyssope (Green)',
    category: 'green', origin: { country: 'Portugal', province: 'Azores' } },

  // ─── France / Switzerland / Germany / Italy / Netherlands ────────────────
  { id: 'fr-pays-basque', name: 'Pays Basque Tea',
    category: 'green', origin: { country: 'France', province: 'Pays Basque' } },
  { id: 'fr-brittany', name: 'Brittany Tea',
    category: 'green', origin: { country: 'France', province: 'Brittany' } },
  { id: 'ch-monte-verita', name: 'Monte Verità Tea',
    category: 'green', cultivar: ['Yabukita'],
    origin: { country: 'Switzerland', province: 'Ticino' },
    description: 'Small organic estate — likely the world\'s northernmost commercial Yabukita planting.' },
  { id: 'de-rhineland', name: 'German Rheinland Tea',
    category: 'green', origin: { country: 'Germany', province: 'Rheinland-Pfalz' } },
  { id: 'it-compagnia-del-lago', name: 'Compagnia del Lago Tea',
    category: 'green', origin: { country: 'Italy', province: 'Lombardy', locality: 'Lake Maggiore' } },
  { id: 'nl-twickel', name: 'Twickel Estate Tea',
    category: 'green', origin: { country: 'Netherlands', province: 'Overijssel' } },
];

export const americasEmergingRegions: TeaRegion[] = [
  { id: 'rg-ar-misiones', name: 'Misiones', country: 'Argentina', province: 'Misiones',
    primaryCategories: ['black'] },
  { id: 'rg-br-vale-ribeira', name: 'Vale do Ribeira', country: 'Brazil', province: 'São Paulo',
    primaryCategories: ['green'],
    notes: 'Brazilian Japanese-diaspora tea region.' },
  { id: 'rg-us-charleston', name: 'Charleston / Wadmalaw Island', country: 'USA', province: 'South Carolina',
    primaryCategories: ['black'] },
  { id: 'rg-us-mississippi', name: 'Brookhaven', country: 'USA', province: 'Mississippi',
    primaryCategories: ['black', 'white', 'oolong'] },
  { id: 'rg-us-pacific-nw', name: 'Pacific Northwest', country: 'USA', province: 'Oregon / Washington',
    primaryCategories: ['green', 'white'] },
  { id: 'rg-us-hawaii-big-island', name: 'Big Island Hawaii', country: 'USA', province: 'Hawaii',
    elevation: '600–1500 m',
    primaryCategories: ['oolong', 'white', 'black'] },
  { id: 'rg-co-bitaco', name: 'Bitaco', country: 'Colombia', province: 'Valle del Cauca',
    elevation: '1500–1800 m',
    primaryCategories: ['green', 'white'] },
  { id: 'rg-au-northern-rivers', name: 'Northern Rivers', country: 'Australia', province: 'New South Wales',
    primaryCategories: ['black'] },
  { id: 'rg-au-atherton', name: 'Atherton Tablelands', country: 'Australia', province: 'Queensland',
    primaryCategories: ['black'] },
  { id: 'rg-nz-waikato', name: 'Waikato', country: 'New Zealand', province: 'Waikato',
    primaryCategories: ['oolong', 'black'] },
  { id: 'rg-gb-cornwall', name: 'Cornwall', country: 'UK', province: 'Cornwall',
    primaryCategories: ['black', 'oolong'] },
  { id: 'rg-gb-perthshire', name: 'Perthshire', country: 'UK', province: 'Scotland',
    primaryCategories: ['white'] },
  { id: 'rg-pt-sao-miguel', name: 'São Miguel Island', country: 'Portugal', province: 'Azores',
    primaryCategories: ['black', 'green'],
    notes: "Europe's oldest active tea region — Atlantic volcanic soil, no need for pesticides at this latitude." },
];

export const americasEmergingCultivars: TeaCultivar[] = [
  { id: 'cv-us-american-classic', name: 'American Classic (Charleston heritage)',
    species: 'Camellia sinensis var. sinensis',
    origin: 'Charleston, USA — descended from 1799 Pinehurst plantings',
    primaryUse: ['black'] },
  { id: 'cv-pt-azores-heritage', name: 'Azores heritage (Gorreana)',
    species: 'Camellia sinensis var. sinensis',
    origin: 'São Miguel, Azores',
    primaryUse: ['black', 'green'] },
  { id: 'cv-gb-tregothnan-blend', name: 'Tregothnan cold-hardy blend',
    species: 'Camellia sinensis var. sinensis',
    origin: 'Cornwall, UK',
    primaryUse: ['black', 'oolong'] },
];
