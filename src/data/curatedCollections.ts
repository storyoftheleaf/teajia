// Curated Collections — guided tea journeys for discovery

export type CollectionDifficulty = 'beginner' | 'intermediate' | 'explorer';

export interface CollectionStep {
  order: number;
  teaName: string;
  instruction: string;
  relatedGlossaryTermId?: string;
}

export interface CuratedCollection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: CollectionDifficulty;
  estimatedDuration: string;
  guideSteps: CollectionStep[];
  tags: string[];
}

export const DIFFICULTY_COLORS: Record<CollectionDifficulty, string> = {
  beginner: 'bg-tea-leaf/10 dark:bg-tea-leaf/20 text-tea-leaf dark:text-tea-leaf border border-tea-leaf/30',
  intermediate: 'bg-tea-elevated/10 dark:bg-tea-elevated/20 text-tea-text-sec dark:text-tea-text-sec border border-tea-border',
  explorer: 'bg-tea-readgold/10 dark:bg-tea-readgold/20 text-tea-readgold dark:text-tea-readgold border border-tea-readgold/30',
};

export const CURATED_COLLECTIONS: CuratedCollection[] = [
  {
    id: 'cc-1',
    title: 'New to Oolong? Start Here',
    subtitle: 'A 3-tea guided journey through the world\'s most diverse tea type',
    description: 'Oolong spans an incredible range — from light and floral to dark and roasted. This journey walks you through three distinct styles, one per session, so you can discover where your palate naturally gravitates.',
    difficulty: 'beginner',
    estimatedDuration: '1-2 weeks',
    guideSteps: [
      {
        order: 1,
        teaName: 'High Mountain Oolong (Taiwan)',
        instruction: 'Start here. Brew at 90°C in a gaiwan, 5g to 100ml. Steep 30 seconds, then increase by 10 seconds each round. Notice the floral aroma and buttery sweetness. This is the lighter end of oolong.',
        relatedGlossaryTermId: 'high-mountain',
      },
      {
        order: 2,
        teaName: 'Phoenix Dancong (Guangdong)',
        instruction: 'Brew slightly hotter, 95°C, same ratio. Steep 15 seconds to start — dancong is intense. Pay attention to the fragrance first: do you get honey? Orchid? Apricot? Each tree has its own character.',
        relatedGlossaryTermId: 'dancong',
      },
      {
        order: 3,
        teaName: 'Wuyi Rock Oolong (Da Hong Pao)',
        instruction: 'Full boiling water, 5g to 100ml. Steep 20 seconds. This is the roasted end of oolong — mineral, deep, warming. Compare it to the high mountain from step 1. You\'ve now tasted the full oolong spectrum.',
        relatedGlossaryTermId: 'yancha',
      },
    ],
    tags: ['oolong', 'beginner', 'tasting-journey'],
  },
  {
    id: 'cc-2',
    title: 'Your First Gongfu Session',
    subtitle: 'Everything you need for your first traditional brewing experience',
    description: 'Gongfu brewing isn\'t complicated — it\'s just intimate. Small vessel, more leaf, shorter steeps. This guide takes you through a complete session from heating the water to your last infusion.',
    difficulty: 'beginner',
    estimatedDuration: '1 afternoon',
    guideSteps: [
      {
        order: 1,
        teaName: 'Any oolong or puerh you enjoy',
        instruction: 'Gather your tools: a gaiwan or small teapot (100-150ml), a sharing pitcher, and small cups. Heat everything with boiling water first — warm vessels make better tea.',
        relatedGlossaryTermId: 'gaiwan',
      },
      {
        order: 2,
        teaName: 'Same tea, first infusion',
        instruction: 'Add 5-6g of leaf to your warmed gaiwan. Pour water just off the boil, fill to the brim, and steep for only 10-15 seconds. Pour into the sharing pitcher, then into cups. This first infusion is called the "awakening" — it opens the leaves.',
        relatedGlossaryTermId: 'gongfu',
      },
      {
        order: 3,
        teaName: 'Same tea, rounds 2-5',
        instruction: 'Add 5 seconds to each subsequent steep. Notice how the flavor evolves with each round — this is what gongfu is about. The third or fourth steep is often the peak. By round 5, the tea is gentle and sweet.',
        relatedGlossaryTermId: 'chahai',
      },
      {
        order: 4,
        teaName: 'Same tea, final rounds',
        instruction: 'When the flavor thins, try a longer steep (60+ seconds). Some teas give 8-12 good rounds. Take your time. Look at the spent leaves — are they whole? That tells you about quality.',
      },
    ],
    tags: ['gongfu', 'beginner', 'brewing', 'ceremony'],
  },
  {
    id: 'cc-3',
    title: 'The Puerh Discovery Path',
    subtitle: 'Sheng vs. Shou — understanding tea\'s most complex category',
    description: 'Puerh is unlike any other tea. It ages, it transforms, it has terroir and vintage. This journey introduces you to both styles and helps you develop your palate for this remarkable tea.',
    difficulty: 'intermediate',
    estimatedDuration: '2-3 weeks',
    guideSteps: [
      {
        order: 1,
        teaName: 'Shou Puerh (ripe, 3-5 years)',
        instruction: 'Start with shou — it\'s more approachable. Brew with boiling water, 6g to 100ml, in a gaiwan. Rinse once (pour water, discard after 5 seconds), then steep 15 seconds. It should be smooth, earthy, maybe chocolatey. This is what accelerated fermentation creates.',
        relatedGlossaryTermId: 'shou',
      },
      {
        order: 2,
        teaName: 'Young Sheng Puerh (raw, 1-3 years)',
        instruction: 'Now try sheng. Same parameters but expect a completely different experience: bright, bitter, maybe floral or fruity. The astringency is normal — it\'s the raw power that will mellow with age. Notice the huigan (returning sweetness) after you swallow.',
        relatedGlossaryTermId: 'sheng',
      },
      {
        order: 3,
        teaName: 'Aged Sheng Puerh (10+ years, if available)',
        instruction: 'If you can source an aged sheng, this is the revelation. The bitterness has transformed into depth. The astringency has become silky. You\'re tasting time itself. Compare your memory of the young sheng — this is where it\'s heading.',
        relatedGlossaryTermId: 'aging',
      },
    ],
    tags: ['puerh', 'intermediate', 'tasting-journey', 'aging'],
  },
];

/** Product IDs currently on sale — curated by Adrian */
export const SALE_ITEM_IDS = ['1', '5', '6', '12', '17', '9'];
