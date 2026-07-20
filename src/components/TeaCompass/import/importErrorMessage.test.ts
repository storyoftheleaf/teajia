import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../lib/api';
import { importRunErrorMessage, savedRecordAnalysisMessage } from './importErrorMessage';

describe('importRunErrorMessage', () => {
  it('turns an opaque analysis 502 into a recoverable record message', () => {
    expect(importRunErrorMessage(new ApiError('Request failed (502)', 502))).toBe(
      "We couldn't analyze this record. Your pasted text is saved. Try again.",
    );
  });

  it('uses the same recovery message for a structured provider failure', () => {
    expect(importRunErrorMessage(new ApiError('Import analysis failed', 502, { code: 'analysis_provider_400' }))).toBe(
      "We couldn't analyze this record. Your pasted text is saved. Try again.",
    );
  });

  it('does not expose internal analysis codes when a saved record is reopened', () => {
    expect(savedRecordAnalysisMessage('analysis_provider_400')).toBe('Your saved record is ready to analyze again.');
  });
});
