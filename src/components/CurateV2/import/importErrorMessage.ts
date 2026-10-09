import { ApiError } from '../../../lib/api';

const SAVED_RECORD_MESSAGE = "We couldn't analyze this record. Your pasted text is saved. Try again.";

export function importRunErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = typeof error.data?.code === 'string' ? error.data.code : '';
    const opaqueHttpFailure = /^Request failed \(\d+\)$/.test(error.message);
    if (opaqueHttpFailure || code.startsWith('analysis_provider_')) return SAVED_RECORD_MESSAGE;
  }
  return error instanceof Error ? error.message : 'Import failed';
}

export function savedRecordAnalysisMessage(message?: string | null): string {
  if (!message || message.startsWith('analysis_')) return 'Your saved record is ready to analyze again.';
  return message;
}
