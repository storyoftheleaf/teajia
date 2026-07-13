import { describe, expect, it } from 'vitest';
import { failedImportSourceIds, prepareImportEvidenceFile } from './importEvidenceSelection';

describe('Curate evidence selection', () => {
  it('normalizes a blank browser MIME from a supported extension before upload', () => {
    const result = prepareImportEvidenceFile(new File(['name,price'], 'vendor.csv'));

    expect(result.error).toBeNull();
    expect(result.file?.type).toBe('text/csv');
  });

  it('normalizes DOCX as reference-only and rejects unknown blank-MIME files', () => {
    const word = prepareImportEvidenceFile(new File(['PK-docx'], 'notes.docx'));
    expect(word.file?.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(word.referenceOnly).toBe(true);

    const unknown = prepareImportEvidenceFile(new File(['binary'], 'archive.bin'));
    expect(unknown.file).toBeNull();
    expect(unknown.error).toBe('This file type cannot be analyzed');
  });

  it('selects only failed sources for retry', () => {
    const source = (id: string, analysis_status: 'pending' | 'analyzed' | 'reference_only' | 'failed') => ({ id, analysis_status, batch_id: 'batch', kind: 'file' as const, pasted_text: null, r2_object_key: 'private', metadata: {} });
    expect(failedImportSourceIds([source('pending', 'pending'), source('done', 'analyzed'), source('word', 'reference_only'), source('failed', 'failed')])).toEqual(['failed']);
  });
});
