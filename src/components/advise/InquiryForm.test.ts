import { describe, expect, it } from 'vitest';
import { restoreInquiryDraft } from './InquiryForm';
import { buildInquiryVision, guidanceAdvice, restoreGuidanceAnswers, serviceForInterest } from './serviceGuidance';

describe('Advise inquiry guidance', () => {
  it('keeps saved contact details while a newly clicked service takes priority', () => {
    const restored = restoreInquiryDraft({
      name: 'Maya', email: 'maya@example.com', location: 'Bali', whatsapp: '123',
      vision: 'We have a small room.', referral: 'A friend', interests: ['Tea sourcing'],
    }, 'Space design or tea integration');
    expect(restored.name).toBe('Maya');
    expect(restored.email).toBe('maya@example.com');
    expect(restored.vision).toBe('We have a small room.');
    expect(restored.interests).toEqual(['Space design or tea integration']);
    expect(serviceForInterest(restored.interests[0])).toBe('design');
  });

  it('restores saved choices only when they are valid for the selected service', () => {
    expect(restoreGuidanceAnswers({ startingPoint: 'Planning a new space', priority: 'Not sure yet' }, 'design'))
      .toEqual({ startingPoint: 'Planning a new space', priority: 'Not sure yet' });
    expect(restoreGuidanceAnswers({ startingPoint: 'Planning a new space', priority: 'Not sure yet' }, 'sourcing'))
      .toEqual({ priority: 'Not sure yet' });
  });

  it('sends the chosen answers and optional note through the existing vision field', () => {
    expect(buildInquiryVision('sessions', {
      startingPoint: 'Gather a group', priority: 'At my own venue',
    }, 'About twelve people.')).toBe(
      'Service: Sessions & Guidance\nWhat would you like to do? Gather a group\nWhere might it happen? At my own venue\nAdditional details: About twelve people.',
    );
    expect(buildInquiryVision(null, {}, 'A question about tea.')).toBe('Additional details: A question about tea.');
  });

  it('gives practical help for a chosen path and for uncertainty', () => {
    expect(guidanceAdvice('sourcing', { startingPoint: 'A menu or shared space' })).toContain('how staff will brew');
    expect(guidanceAdvice('sourcing', { startingPoint: 'Not sure yet' })).toContain('how often they will share it');
  });
});
