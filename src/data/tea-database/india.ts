/**
 * Indian teas. Four foundational regions — Assam, Darjeeling, Nilgiri,
 * Kangra — plus emerging origins (Sikkim, Dooars/Terai, Munnar/Anamallais,
 * Karnataka, Manipur/NE indigenous tea, Doke).
 *
 * Note: Manipuri/Singpho tea predates British plantings and is genetically
 * closer to Yunnan ancient assamica than to the post-1837 Calcutta-bred
 * tea-garden lineage.
 */

import type { TeaEntry, TeaRegion, TeaCultivar } from './types';

export const indiaTeas: TeaEntry[] = [
  // ══════════════════════════════════════════════════════════════════════
  //  DARJEELING — by flush
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'in-darj-first-flush',
    name: 'Darjeeling First Flush',
    altNames: ['EX-1', 'Spring Flush'],
    category: 'black',
    species: 'Camellia sinensis var. sinensis',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district', elevation: '600–2100 m' },
    cultivar: ['AV2', 'P312', 'B777', 'China bushes'],
    oxidation: '60–80% (lighter than typical black)',
    processing: ['wither', 'roll', 'partial-oxidize', 'bake'],
    flavorNotes: ['green apple', 'fresh almond', 'astringent floral', 'briery'],
    brewing: { waterTempC: [85, 90], timeSec: [180, 240], leafGramsPer100ml: 3 },
    harvestSeason: ['March–April'],
    description: 'The earliest pluck after winter dormancy — pale gold liquor, often closer to oolong than black in oxidation level.',
    flagship: true,
  },
  {
    id: 'in-darj-second-flush',
    name: 'Darjeeling Second Flush (Muscatel)',
    altNames: ['EX-2'],
    category: 'black',
    species: 'Camellia sinensis var. sinensis',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district' },
    cultivar: ['AV2', 'China hybrid'],
    oxidation: '90–100%',
    processing: ['wither', 'roll', 'full-oxidize', 'bake'],
    flavorNotes: ['muscat grape', 'ripe stone fruit', 'honey', 'spiced wood'],
    brewing: { waterTempC: [90, 95], timeSec: [180, 300], leafGramsPer100ml: 3 },
    harvestSeason: ['May–June'],
    description: 'The fabled muscatel character emerges from leafhopper-bitten leaves — same insect mechanism as Oriental Beauty.',
    flagship: true,
  },
  { id: 'in-darj-monsoon', name: 'Darjeeling Monsoon Flush',
    category: 'black', origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district' },
    harvestSeason: ['July–September'],
    description: 'Heavy-rainfall season — workhorse leaf, less prized.' },
  {
    id: 'in-darj-autumn',
    name: 'Darjeeling Autumn Flush',
    altNames: ['Autumnal'],
    category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district' },
    flavorNotes: ['red fruit', 'mellow malt', 'spiced tannin'],
    harvestSeason: ['October–November'],
    description: 'Final pluck before winter — softer, deeper, brewed copper liquor.' },
  { id: 'in-darj-white', name: 'Darjeeling White (Silver Tips)',
    category: 'white', origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district' } },
  { id: 'in-darj-green', name: 'Darjeeling Green',
    category: 'green', origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district' } },
  { id: 'in-darj-oolong', name: 'Darjeeling Oolong',
    category: 'oolong', origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling district' } },

  // ─── Famous Darjeeling estates ───────────────────────────────────────────
  { id: 'in-darj-castleton', name: 'Castleton Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Kurseong, Darjeeling' },
    flagship: true },
  { id: 'in-darj-margarets-hope', name: "Margaret's Hope Estate", category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Kurseong, Darjeeling' } },
  { id: 'in-darj-makaibari', name: 'Makaibari Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Kurseong, Darjeeling' },
    description: 'First certified-organic, biodynamic Darjeeling estate (Rajah Banerjee).',
    flagship: true },
  { id: 'in-darj-glenburn', name: 'Glenburn Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-jungpana', name: 'Jungpana Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-gopaldhara', name: 'Gopaldhara Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Mirik, Darjeeling' } },
  { id: 'in-darj-puttabong', name: 'Puttabong (Tukvar)', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-arya', name: 'Arya Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-singell', name: 'Singell Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-goomtee', name: 'Goomtee Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-risheehat', name: 'Risheehat Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-thurbo', name: 'Thurbo Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Mirik, Darjeeling' } },
  { id: 'in-darj-rohini', name: 'Rohini Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-ambootia', name: 'Ambootia Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling' } },
  { id: 'in-darj-happy-valley', name: 'Happy Valley Estate', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Darjeeling town' } },

  // ══════════════════════════════════════════════════════════════════════
  //  ASSAM
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'in-assam-orthodox',
    name: 'Assam Orthodox',
    category: 'black',
    species: 'Camellia sinensis var. assamica',
    origin: { country: 'India', province: 'Assam', locality: 'Brahmaputra Valley' },
    cultivar: ['TV-23', 'TV-25', 'TV-26', 'Tocklai jat'],
    oxidation: '100%',
    processing: ['wither', 'roll', 'full-oxidize', 'bake'],
    flavorNotes: ['malt', 'cocoa', 'baked bread', 'thick body'],
    brewing: { waterTempC: [95, 100], timeSec: [180, 300], leafGramsPer100ml: 3 },
    harvestSeason: ['second flush (May–June) prized'],
    description: 'The benchmark malty black tea — full-bodied, the muscle behind English Breakfast and Irish Breakfast blends.',
    flagship: true,
  },
  { id: 'in-assam-ctc', name: 'Assam CTC', category: 'black',
    species: 'Camellia sinensis var. assamica',
    origin: { country: 'India', province: 'Assam' },
    processing: ['wither', 'roll', 'full-oxidize'],
    description: 'Crush-Tear-Curl pellet form — fast extraction, the masala chai workhorse.' },
  { id: 'in-assam-second-flush', name: 'Assam Second Flush (Tippy)', category: 'black',
    origin: { country: 'India', province: 'Assam' },
    flavorNotes: ['heavy malt', 'gold-tipped', 'plummy'],
    flagship: true },
  { id: 'in-assam-first-flush', name: 'Assam First Flush', category: 'black',
    origin: { country: 'India', province: 'Assam' },
    harvestSeason: ['March–April'] },

  // ─── Famous Assam estates ───────────────────────────────────────────────
  { id: 'in-assam-halmari', name: 'Halmari Estate', category: 'black',
    origin: { country: 'India', province: 'Assam', locality: 'Moran' }, flagship: true },
  { id: 'in-assam-mangalam', name: 'Mangalam Estate', category: 'black',
    origin: { country: 'India', province: 'Assam' } },
  { id: 'in-assam-doomur-dullung', name: 'Doomur Dullung Estate', category: 'black',
    origin: { country: 'India', province: 'Assam', locality: 'Sonitpur' } },
  { id: 'in-assam-mokalbari', name: 'Mokalbari Estate', category: 'black',
    origin: { country: 'India', province: 'Assam' } },
  { id: 'in-assam-khongea', name: 'Khongea Estate', category: 'black',
    origin: { country: 'India', province: 'Assam' } },
  { id: 'in-assam-rembeng', name: 'Rembeng Estate', category: 'black',
    origin: { country: 'India', province: 'Assam' } },
  { id: 'in-assam-hattialli', name: 'Hattialli Estate', category: 'black',
    origin: { country: 'India', province: 'Assam' } },
  { id: 'in-assam-numalighur', name: 'Numalighur Estate', category: 'black',
    origin: { country: 'India', province: 'Assam' } },

  // ══════════════════════════════════════════════════════════════════════
  //  NILGIRI
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'in-nilgiri-frost',
    name: 'Nilgiri Frost Tea',
    altNames: ['Winter Frost'],
    category: 'black',
    species: 'Camellia sinensis var. assamica',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiri Hills', elevation: '1500–2200 m' },
    cultivar: ['UPASI-9', 'UPASI-3'],
    oxidation: '100%',
    flavorNotes: ['bright florals', 'crisp', 'dry-cool finish'],
    harvestSeason: ['December–February'],
    description: 'Plucked during cold dry season — concentrated aromatic profile, often compared to high-grown Ceylon.',
    flagship: true,
  },
  { id: 'in-nilgiri-orthodox', name: 'Nilgiri Orthodox', category: 'black',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiri Hills' },
    flavorNotes: ['brisk', 'lively', 'soft floral'] },
  { id: 'in-nilgiri-green', name: 'Nilgiri Green', category: 'green',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiri Hills' } },
  { id: 'in-nilgiri-oolong', name: 'Nilgiri Oolong (Tiger Hill)', category: 'oolong',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Tiger Hill, Nilgiris' } },
  { id: 'in-nilgiri-white', name: 'Nilgiri White', category: 'white',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiri Hills' } },
  { id: 'in-korakundah', name: 'Korakundah Estate', category: 'black',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiri Hills', elevation: '2200 m' },
    description: "One of the world's highest-elevation organic tea estates." },
  { id: 'in-glendale', name: 'Glendale Estate', category: 'black',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Coonoor, Nilgiris' } },
  { id: 'in-havukal', name: 'Havukal Estate', category: 'black',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiris' } },
  { id: 'in-chamraj', name: 'Chamraj Estate', category: 'black',
    origin: { country: 'India', province: 'Tamil Nadu', locality: 'Nilgiris' } },

  // ══════════════════════════════════════════════════════════════════════
  //  SIKKIM
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'in-temi',
    name: 'Temi Estate',
    category: 'black',
    species: 'Camellia sinensis var. sinensis',
    origin: { country: 'India', province: 'Sikkim', locality: 'South Sikkim', elevation: '1200–1800 m' },
    description: 'Sikkim\'s only major tea estate — government-run, certified organic.',
    flagship: true,
  },

  // ══════════════════════════════════════════════════════════════════════
  //  KANGRA (Himachal Pradesh)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'in-kangra-black', name: 'Kangra Black', category: 'black',
    species: 'Camellia sinensis var. sinensis',
    origin: { country: 'India', province: 'Himachal Pradesh', locality: 'Palampur / Dharamsala' },
    description: 'GI-tagged Himalayan black, lightly oxidised muscatel-adjacent style.' },
  { id: 'in-kangra-green', name: 'Kangra Green', category: 'green',
    origin: { country: 'India', province: 'Himachal Pradesh', locality: 'Palampur' } },
  { id: 'in-kangra-oolong', name: 'Kangra Oolong', category: 'oolong',
    origin: { country: 'India', province: 'Himachal Pradesh', locality: 'Palampur' } },

  // ══════════════════════════════════════════════════════════════════════
  //  DOOARS / TERAI
  // ══════════════════════════════════════════════════════════════════════
  { id: 'in-dooars-ctc', name: 'Dooars CTC', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Dooars' } },
  { id: 'in-terai-black', name: 'Terai Black', category: 'black',
    origin: { country: 'India', province: 'West Bengal', locality: 'Terai (foothills below Darjeeling)' } },

  // ══════════════════════════════════════════════════════════════════════
  //  KERALA / KARNATAKA
  // ══════════════════════════════════════════════════════════════════════
  { id: 'in-munnar', name: 'Munnar Tea', category: 'black',
    origin: { country: 'India', province: 'Kerala', locality: 'Munnar / Anamallais', elevation: '1500–2000 m' } },
  { id: 'in-coorg', name: 'Coorg Tea', category: 'black',
    origin: { country: 'India', province: 'Karnataka', locality: 'Coorg' } },
  { id: 'in-chikmagalur', name: 'Chikmagalur Tea', category: 'black',
    origin: { country: 'India', province: 'Karnataka', locality: 'Chikmagalur' } },

  // ══════════════════════════════════════════════════════════════════════
  //  NORTHEAST INDIGENOUS — Manipur / Meghalaya / Arunachal / Tripura
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'in-manipur-singpho',
    name: 'Manipuri / Singpho Indigenous Tea',
    category: 'black',
    species: 'Camellia sinensis var. cambodiensis',
    origin: { country: 'India', province: 'Manipur / Arunachal Pradesh' },
    description: 'Pre-British wild Camellia — genetically related to Yunnan ancient assamica. The Singpho Naga people had a tea tradition before the East India Company.',
    flagship: true,
  },
  { id: 'in-meghalaya-tea', name: 'Meghalaya Tea', category: 'black',
    origin: { country: 'India', province: 'Meghalaya' } },
  { id: 'in-arunachal-tea', name: 'Arunachal Tea', category: 'black',
    origin: { country: 'India', province: 'Arunachal Pradesh' } },

  // ══════════════════════════════════════════════════════════════════════
  //  BIHAR — Doke (modern revival)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'in-doke', name: 'Doke Tea', category: 'black',
    origin: { country: 'India', province: 'Bihar', locality: 'Bhojpur' },
    description: 'Rajiv Lochan\'s small estate — modern artisanal Bihar tea revival.' },

  // ══════════════════════════════════════════════════════════════════════
  //  MASALA CHAI (style — not a region)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'in-masala-chai', name: 'Masala Chai (style)', category: 'flavored',
    origin: { country: 'India' },
    description: 'Strong CTC Assam brewed with milk and a spice blend (cardamom, ginger, cinnamon, clove, black pepper). The Indian everyday street tea.' },
];

export const indiaRegions: TeaRegion[] = [
  { id: 'rg-in-darjeeling', name: 'Darjeeling', country: 'India', province: 'West Bengal',
    coordinates: { lat: 27.0410, lon: 88.2663 },
    elevation: '600–2100 m',
    primaryCategories: ['black', 'white', 'green', 'oolong'],
    notes: 'GI-protected — 87 estates spread across Darjeeling, Kurseong, Mirik, Sukhia and Rangli Rangliot subdivisions. Champagne of teas.' },
  { id: 'rg-in-assam', name: 'Assam (Brahmaputra Valley)', country: 'India', province: 'Assam',
    elevation: '50–500 m',
    primaryCategories: ['black'],
    notes: 'Lowland Brahmaputra plains — the world\'s largest single tea-growing region. Includes Upper Assam (Dibrugarh, Tinsukia, Sivasagar, Jorhat) and Lower Assam (Sonitpur, Darrang).' },
  { id: 'rg-in-cachar', name: 'Cachar (Barak Valley)', country: 'India', province: 'Assam',
    primaryCategories: ['black'],
    notes: 'Southern Assam tea valley — distinct from Brahmaputra Valley.' },
  { id: 'rg-in-nilgiris', name: 'Nilgiri Hills', country: 'India', province: 'Tamil Nadu',
    coordinates: { lat: 11.4916, lon: 76.7337 },
    elevation: '1000–2400 m',
    primaryCategories: ['black', 'green', 'oolong'] },
  { id: 'rg-in-sikkim', name: 'Sikkim', country: 'India', province: 'Sikkim',
    primaryCategories: ['black'] },
  { id: 'rg-in-kangra', name: 'Kangra Valley', country: 'India', province: 'Himachal Pradesh',
    primaryCategories: ['black', 'green', 'oolong'] },
  { id: 'rg-in-dooars', name: 'Dooars', country: 'India', province: 'West Bengal',
    primaryCategories: ['black'] },
  { id: 'rg-in-terai', name: 'Terai', country: 'India', province: 'West Bengal',
    primaryCategories: ['black'] },
  { id: 'rg-in-munnar', name: 'Munnar / Anamallais', country: 'India', province: 'Kerala',
    elevation: '1500–2000 m',
    primaryCategories: ['black'] },
  { id: 'rg-in-coorg', name: 'Coorg', country: 'India', province: 'Karnataka',
    primaryCategories: ['black'] },
  { id: 'rg-in-chikmagalur', name: 'Chikmagalur', country: 'India', province: 'Karnataka',
    primaryCategories: ['black'] },
  { id: 'rg-in-manipur', name: 'Manipur / NE Indigenous belt', country: 'India', province: 'Manipur',
    primaryCategories: ['black'],
    notes: 'Pre-British tea-bearing forests — Singpho heritage.' },
  { id: 'rg-in-arunachal', name: 'Arunachal Pradesh', country: 'India', province: 'Arunachal Pradesh',
    primaryCategories: ['black'] },
  { id: 'rg-in-meghalaya', name: 'Meghalaya', country: 'India', province: 'Meghalaya',
    primaryCategories: ['black'] },
  { id: 'rg-in-bihar', name: 'Bihar (Doke)', country: 'India', province: 'Bihar',
    primaryCategories: ['black'] },
];

export const indiaCultivars: TeaCultivar[] = [
  { id: 'cv-in-tv-1-india', name: 'TV-1', species: 'Camellia sinensis var. assamica',
    origin: 'Tocklai TRI, Assam', primaryUse: ['black'], introduced: '1949' },
  { id: 'cv-in-tv-23-india', name: 'TV-23', species: 'Camellia sinensis var. assamica',
    origin: 'Tocklai, Assam', primaryUse: ['black'] },
  { id: 'cv-in-tv-25-india', name: 'TV-25', species: 'Camellia sinensis var. assamica',
    origin: 'Tocklai, Assam', primaryUse: ['black'] },
  { id: 'cv-in-tv-26-india', name: 'TV-26', species: 'Camellia sinensis var. assamica',
    origin: 'Tocklai, Assam', primaryUse: ['black'] },
  { id: 'cv-in-upasi-9-india', name: 'UPASI-9', species: 'Camellia sinensis var. assamica',
    origin: 'UPASI, South India', primaryUse: ['black'] },
  { id: 'cv-in-upasi-17-india', name: 'UPASI-17', species: 'Camellia sinensis var. assamica',
    origin: 'UPASI, South India', primaryUse: ['black'] },
  { id: 'cv-in-av2-india', name: 'AV2 (Ambari Vegetative #2)',
    species: 'Camellia sinensis var. sinensis',
    origin: 'Darjeeling', primaryUse: ['black'],
    notes: 'Dominant new-planting cultivar in Darjeeling.' },
  { id: 'cv-in-p312-india', name: 'P312', species: 'Camellia sinensis var. sinensis',
    origin: 'Darjeeling', primaryUse: ['black'] },
  { id: 'cv-in-b777-india', name: 'B777', species: 'Camellia sinensis var. sinensis',
    origin: 'Darjeeling', primaryUse: ['black'] },
  { id: 'cv-in-china-bushes-india', name: 'Darjeeling China Bushes',
    species: 'Camellia sinensis var. sinensis',
    origin: '1841 China seed, replanted Darjeeling', primaryUse: ['black'],
    notes: 'Original Darjeeling lineage — declining acreage in favour of AV2.' },
  { id: 'cv-in-manipuri-indigenous', name: 'Manipuri Indigenous',
    species: 'Camellia sinensis var. cambodiensis',
    origin: 'Manipur / Arunachal, India', primaryUse: ['black'] },
];
