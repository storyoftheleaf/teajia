import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const poetryCollection: ReadableStory = {
  id: 'template-poetry',
  type: ContentType.Article,
  status: 'published',
  title: 'Poetry Collection',
  subtitle: 'Whispered Verse',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=poetry1',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A collection of tea poetry showcasing every poetic layout variant — centered, left-aligned, scattered, visual, and haiku.',
  tags: ['Poetry', 'Literature', 'Culture'],
  content: [
    ":::COVER_MINIMAL:::Whispered\nVerse",

    ":::POEM_CENTERED:::THE FIRST CUP\n\nBefore the water finds its voice\nin the iron kettle's throat,\nbefore the leaves uncurl\nlike fists releasing grief,\nthere is a moment\nof pure anticipation —\n\nthe dry leaves in the palm,\ntheir scent a letter\nfrom a mountain\nyou have never climbed\nbut somehow remember.\n\nYou lift them to your nose\nand breathe,\nand for one breath\nyou are not here\nbut there —\n\nwhere fog erases\nthe line between\nthe garden and the sky,\nwhere someone's hands\nare picking still,\nand the morning\nhas no name.",

    ":::POEM_LEFT_ALIGN:::WATER MEMORY\n\nThe kettle remembers every tea\nit has ever boiled for.\nMineral ghosts layer the interior —\ncalcium from the well in Hangzhou,\niron from the spring near Wuyi,\nchlorine from the city years,\nthe slow silver scaling of ten thousand boils.\n\nI do not descale my kettle.\nThese are not deposits.\nThey are annotations.\nEach ring a year,\neach mineral a place,\neach stain a conversation\nthat ended well or didn't\nbut always ended\nwith the cup empty\nand the heart\na little less so.",

    ":::IMG_FULL_BLEED:::Morning mist over the tea garden|https://picsum.photos/800/1200?random=poetry2",

    ":::POEM_HAIKU_MINIMAL:::Spring picking —\nthe basket fills faster\nthan the hours pass",

    ":::TEXT_CENTER_NARROW:::These poems were written over the course of a single year spent traveling through the tea mountains of southern China and Taiwan. They are not translations of classical Chinese tea poetry — though that tradition haunts every line — but attempts to articulate the experience of tea in a contemporary voice. The classical poets wrote of tea as scholars and monks, from positions of retreat and contemplation. These poems are written from the road, the tea table, the factory floor, the predawn kitchen. They seek not the elevated remove of the literati but the intimate proximity of the practitioner — hands wrapped around a warm cup, watching steam dissolve into air that smells of woodsmoke and wet earth.",

    ":::POEM_SCATTERED:::Autumn leaves fall\n      into the tea\n             or perhaps\n    the tea rises\n          to meet them —\n                who can say\n       where the garden ends\n  and the cup\n            begins?",

    ":::POEM_VISUAL:::S T E E P\n\nThe word itself\n   descends —\n      letter\n         by\n            letter\n               into\n                  depth.\n\nSteep: to soak,\nto saturate,\nto immerse\nuntil the boundary\nbetween solvent\nand solute\ndissolves.\n\nWe steep tea.\nTea steeps us.",

    ":::IMG_OVAL_VIGNETTE:::Solitary cup on stone|https://picsum.photos/800/1200?random=poetry3",

    ":::TEXT_JUSTIFIED_NARROW:::The relationship between tea and poetry is not metaphorical — it is structural. Both operate through compression. A tea leaf is a compressed landscape: soil minerals, rainwater, sunlight, mountain air, microbial communities, the genetic memory of a cultivar shaped over centuries. Brewing is decompression: hot water unlocks what the leaf has stored, releasing it in sequence across multiple steepings, each infusion a stanza revealing new dimensions of the same source material. Poetry works the same way. A few words compressed into lines, carrying far more meaning than their surface syntax suggests, releasing that meaning gradually across repeated readings. The best tea and the best poems share this quality of inexhaustibility — you return to them again and again and find something you missed before.",

    ":::POEM_CENTERED:::THE TEA MASTER'S HANDS\n\nThey move like water —\nnot rushing water\nbut the slow water\nthat shapes stone\nover centuries.\n\nThe right hand lifts the kettle\nwith the wrist, not the arm.\nThe left hand turns the lid\nwith thumb and ring finger only.\nThe pour begins\nbefore the mind decides to pour.\n\nThirty years of practice\nhave worn a groove\nin the wooden table\nwhere the kettle rests.\nThe groove is not a flaw.\nIt is a signature —\nthe only one he needs.",

    ":::QUOTE_BIG:::Poetry is the tea of language — brewed slowly, served in small cups, best shared in silence.",

    ":::DEDICATION_SIMPLE:::For the mountain,\nthe leaf,\nand the long way home.",

    ":::IMG_DUOTONE:::Old tea trees in morning light|https://picsum.photos/800/1200?random=poetry4",

    ":::EPILOGUE_CENTERED:::These poems were composed between spring 2024 and winter 2025 in the tea regions of Fujian, Yunnan, and Taiwan. Some were written at tea tables, others on overnight trains, a few in the margins of tasting notebooks. They owe a debt to Lu Yu, Su Dongpo, and the countless unnamed monks who first understood that tea and verse share the same silence.",

    ":::COPYRIGHT_PAGE:::Poetry by Zhou Yu\nFirst published in Teajia Journal\nAll rights reserved"
  ],
  author: PEOPLE.zhou,
};
