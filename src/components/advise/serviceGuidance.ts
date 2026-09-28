export type ServiceKey = 'design' | 'sourcing' | 'sessions';

export type GuidanceQuestion = {
  id: 'startingPoint' | 'priority';
  prompt: string;
  options: string[];
};

export type GuidanceAnswers = Partial<Record<GuidanceQuestion['id'], string>>;

export const SERVICE_GUIDANCE: Record<ServiceKey, {
  title: string;
  interest: string;
  intro: string;
  questions: [GuidanceQuestion, GuidanceQuestion];
  unsureAdvice: string;
}> = {
  design: {
    title: 'Tea House Design & Curation',
    interest: 'Space design or tea integration',
    intro: 'A tea space can begin with a room, a menu, or a team. Choose what is closest to your situation. Nothing needs to be final yet.',
    questions: [
      { id: 'startingPoint', prompt: 'Where are you in the process?', options: ['Exploring an idea', 'Planning a new space', 'Improving an existing space', 'Not sure yet'] },
      { id: 'priority', prompt: 'What needs attention first?', options: ['The room and experience', 'Tea and teaware selection', 'Team training and operations', 'Not sure yet'] },
    ],
    unsureAdvice: 'Start with the people who will share tea there and the kind of welcome you want them to feel. The room, menu, and training can follow from that.',
  },
  sourcing: {
    title: 'Tea Curation & Sourcing',
    interest: 'Tea sourcing',
    intro: 'You do not need to know a region or tea name. The way the tea will be shared is a useful starting point.',
    questions: [
      { id: 'startingPoint', prompt: 'Who is the tea for?', options: ['My own collection', 'A menu or shared space', 'A group or community', 'Not sure yet'] },
      { id: 'priority', prompt: 'What would help most?', options: ['A dependable everyday selection', 'Rare or aged teas', 'A balanced range to explore', 'Not sure yet'] },
    ],
    unsureAdvice: 'Begin with the people drinking it, how often they will share it, and a comfortable budget. Those details narrow the field more usefully than a long list of tea names.',
  },
  sessions: {
    title: 'Sessions & Guidance',
    interest: 'A session or practice guidance',
    intro: 'A first sit, a personal practice, and a group gathering ask for different kinds of guidance. Choose the closest fit.',
    questions: [
      { id: 'startingPoint', prompt: 'What would you like to do?', options: ['Try tea together for the first time', 'Build a personal practice', 'Gather a group', 'Not sure yet'] },
      { id: 'priority', prompt: 'Where might it happen?', options: ['At the Bali studio', 'At my own venue', 'I am elsewhere', 'Not sure yet'] },
    ],
    unsureAdvice: 'A simple first sit is enough to discover what you enjoy. If you already share tea with others, tell Adrian the group size and occasion; he can suggest a fitting format.',
  },
};

export function serviceForInterest(interest?: string): ServiceKey | null {
  if (interest === 'Space design or tea integration') return 'design';
  if (interest === 'Tea sourcing' || interest === 'A sourcing journey') return 'sourcing';
  if (interest === 'A session or practice guidance' || interest === 'An event or group experience') return 'sessions';
  return null;
}

export function buildInquiryVision(service: ServiceKey | null, answers: GuidanceAnswers, note: string): string {
  const lines: string[] = [];
  if (service) {
    const profile = SERVICE_GUIDANCE[service];
    lines.push(`Service: ${profile.title}`);
    for (const question of profile.questions) {
      const answer = answers[question.id];
      if (answer && question.options.includes(answer)) lines.push(`${question.prompt} ${answer}`);
    }
  }
  if (note.trim()) lines.push(`Additional details: ${note.trim()}`);
  return lines.join('\n');
}

export function guidanceAdvice(service: ServiceKey, answers: GuidanceAnswers): string {
  const startingPoint = answers.startingPoint;
  const specific: Record<ServiceKey, Record<string, string>> = {
    design: {
      'Exploring an idea': 'Write down who will use the space and what you want them to feel. That gives the concept a useful center before choosing furniture or tea.',
      'Planning a new space': 'Start with the path from arrival to the tea table, then work out brewing, storage, and service needs around it.',
      'Improving an existing space': 'Notice where guests or staff pause, and where preparing tea feels awkward. Those moments point to the first changes worth making.',
    },
    sourcing: {
      'My own collection': 'List a few teas you return to and one direction you want to explore. A collection grows more clearly from taste than from rarity alone.',
      'A menu or shared space': 'Start with how guests will order and how staff will brew. A smaller range that can be served well is a sound first menu.',
      'A group or community': 'Think about the group’s experience level and how often you meet. A mix of approachable teas and one discovery can open conversation.',
    },
    sessions: {
      'Try tea together for the first time': 'An open sit is a simple way to begin. Come curious; there is no equipment or tea knowledge you need to bring.',
      'Build a personal practice': 'Bring your current questions and, if you have them, the tools you use. The session can start from the routine you already have.',
      'Gather a group': 'Group size, venue, and occasion are the first useful details. They help shape a gathering that leaves room for everyone at the table.',
    },
  };
  return specific[service][startingPoint ?? ''] ?? SERVICE_GUIDANCE[service].unsureAdvice;
}

export function restoreGuidanceAnswers(value: unknown, service: ServiceKey | null): GuidanceAnswers {
  if (!service || !value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const answers: GuidanceAnswers = {};
  for (const question of SERVICE_GUIDANCE[service].questions) {
    const answer = source[question.id];
    if (typeof answer === 'string' && question.options.includes(answer)) answers[question.id] = answer;
  }
  return answers;
}
