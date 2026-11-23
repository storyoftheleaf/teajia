export type TeaVerdict = 'approved' | 'declined' | 'withdrawn';
export type TeaCitation = { title: string; url: string; locator?: string };
export type EditorialPassage = {
  id: string; revision: string; kind: 'Lot opening' | 'Shared history';
  title: string; text: string; scope: string; sources: TeaCitation[]; lots: TeaCitation[];
};
export type TeaEditorialPacket = {
  passages: EditorialPassage[];
  holds: TeaCitation[]; histories: (TeaCitation & { wisdom: string })[];
  intake: Record<string, { nextCheck: string }>;
};
export type PassageVerdict = { decision: TeaVerdict; version: number };
export type TeaEditorialBoard = TeaEditorialPacket & { verdicts: Record<string, PassageVerdict> };
