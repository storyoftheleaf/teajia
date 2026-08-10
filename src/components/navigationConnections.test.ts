import { describe, expect, it } from 'vitest';
import {
  ADMIN_CONNECTION_ROUTES,
  PUBLIC_REFERENCE_ROUTES,
} from './navigationConnections';

describe('operating-program navigation connections', () => {
  it('gives operators stable doors to Tea Masters and Wisdom', () => {
    expect(ADMIN_CONNECTION_ROUTES).toEqual({
      teaMasters: '/admin/contributors',
      wisdom: '/admin/wisdom',
    });
  });

  it('gives public visitors stable doors to People and the Tea Wisdom Base', () => {
    expect(PUBLIC_REFERENCE_ROUTES).toEqual({
      people: '/people',
      wisdom: '/wisdom',
    });
  });
});
