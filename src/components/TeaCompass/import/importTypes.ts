import type { CurateImportDetail, CurateImportItem, CurateImportSourceKind } from '../../../lib/api';

export type ImportEvidence = { id: string; file: File; kind: 'photo' | 'file' };
export type ImportPhase = 'input' | 'parsing' | 'review' | 'error';

export interface ImportDraft {
  text: string;
  evidence: ImportEvidence[];
  sourceKind: CurateImportSourceKind;
  journeyId: string | null;
}
export interface ImportPanelState {
  phase: ImportPhase;
  detail: CurateImportDetail | null;
  error: string | null;
}

export type ImportReviewItem = CurateImportItem;
