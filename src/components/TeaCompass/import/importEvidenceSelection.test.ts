import { describe, expect, it } from 'vitest';
import { failedImportSourceIds, prepareImportEvidenceFile, unmatchedImportEvidence } from './importEvidenceSelection';
import type { ImportEvidence } from './importTypes';

describe('Curate evidence selection', () => {
  it('normalizes a blank browser MIME from a supported extension before upload', () => {
    const result = prepareImportEvidenceFile(new File(['name,price'], 'vendor.csv'));

    expect(result.error).toBeNull();
    expect(result.file?.type).toBe('text/csv');
  });

  it('accepts supported documents, spreadsheets, and HEIC for analysis', () => {
    const word = prepareImportEvidenceFile(new File(['PK-docx'], 'notes.docx'));
    expect(word.file?.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(word.referenceOnly).toBe(false);

    expect(prepareImportEvidenceFile(new File(['doc'], 'notes.doc')).file?.type).toBe('application/msword');
    expect(prepareImportEvidenceFile(new File(['sheet'], 'prices.xls')).file?.type).toBe('application/vnd.ms-excel');
    expect(prepareImportEvidenceFile(new File(['PK-sheet'], 'prices.xlsx')).file?.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(prepareImportEvidenceFile(new File(['ods'], 'prices.ods')).file?.type).toBe('application/vnd.oasis.opendocument.spreadsheet');
    expect(prepareImportEvidenceFile(new File(['odt'], 'notes.odt')).file?.type).toBe('application/vnd.oasis.opendocument.text');

    const heic = prepareImportEvidenceFile(new File(['0000ftypheic'], 'phone.heic'));
    expect(heic.file?.type).toBe('image/heic');
    expect(heic.error).toBeNull();

    const unknown = prepareImportEvidenceFile(new File(['binary'], 'archive.bin'));
    expect(unknown.file).toBeNull();
    expect(unknown.error).toBe('This file type cannot be analyzed');
  });

  it('selects only failed sources for retry', () => {
    const source = (id: string, analysis_status: 'pending' | 'analyzed' | 'reference_only' | 'failed') => ({ id, analysis_status, batch_id: 'batch', kind: 'file' as const, pasted_text: null, r2_object_key: 'private', metadata: {} });
    expect(failedImportSourceIds([source('pending', 'pending'), source('done', 'analyzed'), source('word', 'reference_only'), source('failed', 'failed')])).toEqual(['failed']);
  });

  it('keeps failed local evidence that has no persisted source and deduplicates uploaded evidence by client id', () => {
    const evidence = (id: string, name: string, status: ImportEvidence['status']): ImportEvidence => ({
      id, name, status, file: new File(['evidence'], name), kind: 'file', size: 8, type: 'application/pdf', error: status === 'failed' ? 'Temporary evidence failure' : null,
    });
    const uploaded = evidence('uploaded-client-id', 'same.pdf', 'pending');
    const failed = evidence('failed-client-id', 'same.pdf', 'failed');
    const source = {
      id: 'source-uploaded', batch_id: 'batch', kind: 'file' as const, pasted_text: null, r2_object_key: 'private/source-uploaded', analysis_status: 'pending' as const,
      metadata: { client_evidence_id: uploaded.id, filename: uploaded.name },
    };

    expect(unmatchedImportEvidence([uploaded, failed], [source])).toEqual([failed]);
  });
});
