/**
 * Being a tea master is one thing to a person and two things to the system: a
 * profile, which holds who they are and how they are paid, and a shop, which
 * holds stock and takes orders. They were built at different times and until
 * now no surface knew about both, so there was no single answer to "am I set
 * up yet".
 *
 * This is that answer, as one ordered list. The person comes first because the
 * person is the trunk: someone can hold a profile and be paid while selling
 * nothing. The shop half is therefore ABSENT rather than unmet when no shop is
 * attached, so a tea master who does not sell still sees a list they can
 * finish. A checklist with an item nobody can complete is not a checklist.
 */

export type TeaMasterReadinessHalf = 'person' | 'shop';

export type TeaMasterStepId =
  | 'identity'
  | 'published'
  | 'payments'
  | 'shop-settings'
  | 'shop-stock'
  | 'shop-storefront'
  | 'shop-sale';

export interface TeaMasterReadinessStep {
  id: TeaMasterStepId;
  half: TeaMasterReadinessHalf;
  /** Plain name of the step, as a person would say it. */
  label: string;
  /** One sentence: what is true now, or what to do next. */
  detail: string;
  done: boolean;
  /** Where this step is actually fixed. */
  route: string;
}

export interface TeaMasterReadiness {
  steps: TeaMasterReadinessStep[];
  completeCount: number;
  totalCount: number;
  /** The first unfinished step, or null when nothing is left. */
  nextStep: TeaMasterReadinessStep | null;
  /**
   * True once every step is done. A surface rendering this must disappear at
   * that point: this is a setup aid, not a permanent dashboard.
   */
  isComplete: boolean;
}

export interface PersonReadinessInput {
  /** Whether a profile exists at all, published or still a private draft. */
  hasProfile: boolean;
  /** Public name and biography are both written. */
  identityReady: boolean;
  isPublished: boolean;
  /** Methods a customer can actually see. A private method pays nobody. */
  publishedPaymentMethods: number;
}

export interface ShopReadinessInput {
  name: string | null;
  hasCurrency: boolean;
  /** A WhatsApp number or a contact email, which is what checkout needs. */
  hasContact: boolean;
  /** Items that are public, priced and in stock. */
  sellableProductCount: number;
  isPublicEnabled: boolean;
  orderCount: number;
}

const PROFILE_ROUTE = '/account/profile';
const SHOP_SETTINGS_ROUTE = '/admin/account-settings';
const SHOP_STOCK_ROUTE = '/admin/stock';
const SHOP_ORDERS_ROUTE = '/admin/activity?tab=orders';

function personSteps(person: PersonReadinessInput): TeaMasterReadinessStep[] {
  const identityDone = person.hasProfile && person.identityReady;
  const paymentCount = person.publishedPaymentMethods;
  return [
    {
      id: 'identity',
      half: 'person',
      label: 'Your identity',
      detail: identityDone
        ? 'Your name and your story are written.'
        : person.hasProfile
          ? 'Add your public name and a short biography.'
          : 'Start your Tea Master profile with a name and a short biography.',
      done: identityDone,
      route: PROFILE_ROUTE,
    },
    {
      id: 'published',
      half: 'person',
      label: 'Your profile is public',
      detail: person.isPublished
        ? 'People can find you and see how to pay you.'
        : 'Publish the profile. Until it is public, your payment details reach nobody.',
      done: person.isPublished,
      route: PROFILE_ROUTE,
    },
    {
      id: 'payments',
      half: 'person',
      label: 'A way to pay you',
      detail: paymentCount > 0
        ? paymentCount === 1 ? 'One public payment method.' : `${paymentCount} public payment methods.`
        : 'Add at least one payment method and make it public.',
      done: paymentCount > 0,
      route: PROFILE_ROUTE,
    },
  ];
}

function shopSteps(shop: ShopReadinessInput): TeaMasterReadinessStep[] {
  const settingsDone = Boolean(shop.name) && shop.hasCurrency && shop.hasContact;
  const stockDone = shop.sellableProductCount > 0;
  const storefrontDone = shop.isPublicEnabled && stockDone && shop.hasContact;
  return [
    {
      id: 'shop-settings',
      half: 'shop',
      label: 'Shop details',
      detail: settingsDone
        ? 'Name, currency and a way to be contacted are all set.'
        : 'Set the shop name, its currency, and a WhatsApp number or email.',
      done: settingsDone,
      route: SHOP_SETTINGS_ROUTE,
    },
    {
      id: 'shop-stock',
      half: 'shop',
      label: 'Tea for sale',
      detail: stockDone
        ? shop.sellableProductCount === 1
          ? 'One tea is priced, in stock and ready to sell.'
          : `${shop.sellableProductCount} teas are priced, in stock and ready to sell.`
        : 'Add tea with a price and a quantity, then make it public.',
      done: stockDone,
      route: SHOP_STOCK_ROUTE,
    },
    {
      id: 'shop-storefront',
      half: 'shop',
      label: 'Shop open to buyers',
      detail: storefrontDone
        ? 'Customers can browse the shop and order.'
        : shop.isPublicEnabled
          ? 'The shop is open but has nothing to sell yet.'
          : 'Open the shop once there is tea to sell and a way to be paid.',
      done: storefrontDone,
      route: SHOP_SETTINGS_ROUTE,
    },
    {
      id: 'shop-sale',
      half: 'shop',
      label: 'First order',
      detail: shop.orderCount > 0
        ? shop.orderCount === 1 ? 'One order recorded.' : `${shop.orderCount} orders recorded.`
        : 'Walk one order through yourself before a customer does.',
      done: shop.orderCount > 0,
      route: SHOP_ORDERS_ROUTE,
    },
  ];
}

export function buildTeaMasterReadiness(input: {
  person: PersonReadinessInput;
  /** Null when no shop is attached, which is a finished state, not a gap. */
  shop: ShopReadinessInput | null;
}): TeaMasterReadiness {
  const steps = [
    ...personSteps(input.person),
    ...(input.shop ? shopSteps(input.shop) : []),
  ];
  const completeCount = steps.filter(step => step.done).length;
  return {
    steps,
    completeCount,
    totalCount: steps.length,
    nextStep: steps.find(step => !step.done) ?? null,
    isComplete: completeCount === steps.length,
  };
}
