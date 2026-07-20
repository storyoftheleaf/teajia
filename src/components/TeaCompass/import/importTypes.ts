import type { CurateImportCanonicalField, CurateImportCanonicalRecord, CurateImportDetail, CurateImportDisposition, CurateImportItem, CurateImportProvenanceState, CurateImportSourceKind } from '../../../lib/api';

export type ImportDisposition = CurateImportDisposition;
export type ImportProvenanceState = CurateImportProvenanceState;
export type ImportCanonicalField = CurateImportCanonicalField;
export type ImportCanonicalRecord = CurateImportCanonicalRecord;

export type ImportEvidenceStatus = 'ready' | 'uploading' | 'pending' | 'analyzed' | 'reference_only' | 'failed' | 'reselect';
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
