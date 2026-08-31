import { describe, expect, it } from 'vitest';
import {
  buildTeaMasterReadiness,
  type PersonReadinessInput,
  type ShopReadinessInput,
} from './teaMasterReadiness';

const unstartedPerson: PersonReadinessInput = {
  hasProfile: false,
  identityReady: false,
  isPublished: false,
  publishedPaymentMethods: 0,
};

const finishedPerson: PersonReadinessInput = {
  hasProfile: true,
  identityReady: true,
  isPublished: true,
  publishedPaymentMethods: 1,
};

const unopenedShop: ShopReadinessInput = {
  name: 'Rayi',
  hasCurrency: true,
  hasContact: true,
  sellableProductCount: 0,
  isPublicEnabled: false,
  orderCount: 0,
};

const openShop: ShopReadinessInput = {
  name: 'Rayi',
  hasCurrency: true,
  hasContact: true,
  sellableProductCount: 4,
  isPublicEnabled: true,
  orderCount: 2,
};

describe('tea master readiness', () => {
  it('gives a tea master with no store a list they can finish', () => {
    const unfinished = buildTeaMasterReadiness({ person: unstartedPerson, shop: null });

    expect(unfinished.totalCount).toBe(3);
    expect(unfinished.steps.every(step => step.half === 'person')).toBe(true);
    expect(unfinished.completeCount).toBe(0);
    expect(unfinished.isComplete).toBe(false);

    const finished = buildTeaMasterReadiness({ person: finishedPerson, shop: null });
    expect(finished.isComplete).toBe(true);
    expect(finished.nextStep).toBeNull();
  });

  it('adds the selling steps only once a store is attached', () => {
    const joined = buildTeaMasterReadiness({ person: finishedPerson, shop: unopenedShop });

    expect(joined.steps.map(step => step.id)).toEqual([
      'identity',
      'published',
      'payments',
      'shop-settings',
      'shop-stock',
      'shop-storefront',
      'shop-sale',
    ]);
    expect(joined.completeCount).toBe(4);
    expect(joined.totalCount).toBe(7);
  });

  it('names the first unfinished step and where it is fixed', () => {
    const readiness = buildTeaMasterReadiness({ person: unstartedPerson, shop: openShop });

    expect(readiness.nextStep).toMatchObject({ id: 'identity', route: '/account/profile' });

    const paymentsLeft = buildTeaMasterReadiness({
      person: { ...finishedPerson, publishedPaymentMethods: 0 },
      shop: openShop,
    });
    expect(paymentsLeft.nextStep).toMatchObject({ id: 'payments', route: '/account/profile' });
  });

  it('reports complete only when nothing at all is left', () => {
    const readiness = buildTeaMasterReadiness({ person: finishedPerson, shop: openShop });

    expect(readiness.isComplete).toBe(true);
    expect(readiness.completeCount).toBe(readiness.totalCount);
    expect(readiness.nextStep).toBeNull();
  });

  it('does not call a store open when it has nothing anyone can buy', () => {
    const readiness = buildTeaMasterReadiness({
      person: finishedPerson,
      shop: { ...openShop, sellableProductCount: 0 },
    });

    expect(readiness.steps.find(step => step.id === 'shop-storefront')).toMatchObject({
      done: false,
      detail: 'The shop is open but has nothing to sell yet.',
    });
  });

  it('keeps an unpublished profile from reading as a payable one', () => {
    const readiness = buildTeaMasterReadiness({
      person: { ...finishedPerson, isPublished: false },
      shop: null,
    });

    expect(readiness.nextStep?.id).toBe('published');
    expect(readiness.isComplete).toBe(false);
  });
});
