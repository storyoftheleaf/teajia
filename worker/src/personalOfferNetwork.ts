// Personal offers never appear in the wholesale network catalogue other shops
// list from (Adrian, 2026-11-25: "No, keep them out"). A personal offer is one
// person's own tea sold from their Tea Chest; it is not stock another shop can
// carry. The catalogue read, the "list this tea" door and the mirror written
// when an offer is published all hold to this.

/** A product row that is a personal offer is never network-visible. */
export function isPersonalOffer(body: Record<string, unknown>): boolean {
  return body.personal_offer_source_id !== undefined && body.personal_offer_source_id !== null;
}

/** SQL: true when the tea profile `profileAlias` belongs to a personal offer. */
export function profileIsPersonalOfferSql(profileAlias: string): string {
  return `EXISTS (SELECT 1 FROM product_listings pol JOIN products pop ON pop.id = pol.legacy_product_id
    WHERE pol.profile_id = ${profileAlias}.id AND pop.personal_offer_source_id IS NOT NULL)`;
}
