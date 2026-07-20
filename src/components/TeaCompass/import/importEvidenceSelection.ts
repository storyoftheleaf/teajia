import type { CurateImportSource } from '../../../lib/api';
import type { ImportEvidence } from './importTypes';

export const IMPORT_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_BATCH_MAX_BYTES = 20 * 1024 * 1024;
export const IMPORT_SOURCE_MAX_COUNT = 50;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  pdf: 'application/pdf', json: 'application/json', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet', odt: 'application/vnd.oasis.opendocument.text',
};

const SUPPORTED_TYPES = new Set([...Object.values(MIME_BY_EXTENSION), 'application/csv']);

export function prepareImportEvidenceFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const inferredType = MIME_BY_EXTENSION[extension] ?? null;
  const type = file.type || inferredType;
  if (!type || !SUPPORTED_TYPES.has(type)) return { file: null, error: 'This file type cannot be analyzed', referenceOnly: false };
  const normalized = file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
  return {
    file: normalized,
    error: file.size > IMPORT_EVIDENCE_MAX_BYTES ? 'Files must be 5 MB or smaller' : null,
    referenceOnly: false,
  };
}

export function failedImportSourceIds(sources: CurateImportSource[]) {
  return sources.filter(source => source.analysis_status === 'failed').map(source => source.id);
}

export function unmatchedImportEvidence(evidence: ImportEvidence[], sources: CurateImportSource[]) {
  const persistedClientIds = new Set(sources.map(source => String(source.metadata?.client_evidence_id || '')).filter(Boolean));
  return evidence.filter(item => !persistedClientIds.has(item.id));
}
