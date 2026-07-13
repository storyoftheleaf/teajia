import type { CurateImportDetail, CurateImportItem, CurateImportSourceKind } from '../../../lib/api';

export type ImportEvidenceStatus = 'ready' | 'uploading' | 'uploaded' | 'failed' | 'reselect';
export type ImportEvidence = {
  id: string;
  file: File | null;
  kind: 'photo' | 'file';
  name: string;
  size: number;
  type: string;
  status: ImportEvidenceStatus;
  error: string | null;
};
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
