import { describe, expect, it } from 'vitest';

import type { TeaEvent } from '../../../types/events';
import { initialRequiresApproval } from './EditForm';

describe('EditForm event initialization', () => {
  it('preserves mapped requiresApproval=false', () => {
    expect(initialRequiresApproval({ requiresApproval: false } as TeaEvent)).toBe(false);
  });

  it('defaults older events without the mapped field to approval required', () => {
    expect(initialRequiresApproval({} as TeaEvent)).toBe(true);
  });
});
