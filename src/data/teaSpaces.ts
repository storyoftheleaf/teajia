// Tea Space Inspiration — gallery and guides for creating tea environments

export type SpaceType = 'corner' | 'room' | 'outdoor' | 'portable';

export interface TeaSpaceEntry {
  id: string;
  title: string;
  spaceType: SpaceType;
  description: string;
  tips: string[];
}

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  corner: 'Corner',
  room: 'Room',
  outdoor: 'Outdoor',
  portable: 'Portable',
};

export const TEA_SPACES: TeaSpaceEntry[] = [
  {
    id: 'ts-1',
    title: 'The Minimalist Corner',
    spaceType: 'corner',
    description: 'A simple shelf or small table in a quiet corner is all you need. Focus on one beautiful vessel, good light, and enough room to sit comfortably. Less is more.',
    tips: [
      'Choose a spot with natural light if possible',
      'A wooden tray keeps everything contained and organized',
      'Keep only your most-used teaware here — store the rest',
      'A small plant adds life without cluttering the space',
    ],
  },
  {
    id: 'ts-2',
    title: 'The Window Seat Setup',
    spaceType: 'corner',
    description: 'Position your tea practice by a window for changing light and a connection to the outdoors. Morning light through steam is one of tea\'s quiet pleasures.',
    tips: [
      'East-facing windows give the best morning light',
      'A cushion on a low stool works as well as a chair',
      'Keep a towel or cloth nearby for spills and vessel warming',
      'Consider blackout options for evening sessions in summer',
    ],
  },
  {
    id: 'ts-3',
    title: 'The Dedicated Tea Room',
    spaceType: 'room',
    description: 'If you have a spare room or can convert a space, a tea room allows full immersion. Low furniture, minimal decoration, and the sound of water become the environment.',
    tips: [
      'Low seating (floor cushions or a tea table) changes the energy',
      'Tatami or a natural fiber rug defines the space',
      'Consider a small water source — even a tabletop fountain',
      'Display seasonal elements: a branch, a stone, a single flower',
    ],
  },
  {
    id: 'ts-4',
    title: 'The Garden Ceremony',
    spaceType: 'outdoor',
    description: 'Brewing outdoors connects you to weather, wind, and birdsong. A stable surface and shelter from direct sun is all the infrastructure you need.',
    tips: [
      'A portable gas burner or thermos avoids the need for electricity',
      'Shade is important — direct sun heats your vessels unevenly',
      'Wind affects water temperature; bring a windscreen for your burner',
      'Evening outdoor sessions with candlelight are unforgettable',
    ],
  },
  {
    id: 'ts-5',
    title: 'The Travel Kit',
    spaceType: 'portable',
    description: 'Your tea practice doesn\'t have to stay home. A compact travel set lets you brew well anywhere — hotels, parks, offices, or the back of a car.',
    tips: [
      'A small gaiwan (80-100ml) and two cups fit in a padded pouch',
      'Pre-weigh tea into small tins or foil packets before traveling',
      'A collapsible silicone tray catches spills on any surface',
      'Hotel kettles work — just run a cycle of plain water first to clean',
    ],
  },
  {
    id: 'ts-6',
    title: 'The Shared Table',
    spaceType: 'room',
    description: 'A tea table designed for hosting creates a different energy than solo practice. It becomes a place of conversation, connection, and generosity.',
    tips: [
      'Seat 2-4 people comfortably — intimacy matters more than capacity',
      'A cha pan (tea tray) with drainage handles the mess of gongfu',
      'Multiple cup styles let guests choose what feels right in their hands',
      'Keep a kettle within arm\'s reach so the flow never stops',
    ],
  },
];
