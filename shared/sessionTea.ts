// The public shape of a poured tea on a session, shared by the worker that
// builds it and the pages that draw it (worker/src/sessionTeas.ts).

export type SessionTeaOffer = {
  /** Which shop sells it, so the tea page opens in that shop. */
  store: string;
  /** "pack" for a personal offer (one exact pack), "weigh" for a shop tea. */
  count: 'pack' | 'weigh';
  /** The shop's public product, exactly as /api/s/:slug/products returns it. */
  product: Record<string, unknown>;
};

/**
 * A name-only tea carries its name only. A real tea carries its page, year,
 * type and place, and an `offer` (with the price) only when its owner marked
 * it for sale.
 */
export type PublicSessionTea =
  | { kind: 'name'; id: string | null; name: string }
  | {
    kind: 'tea'; id: string | null; name: string; href: string | null;
    year: string | null; type: string | null; place: string | null;
    offer?: SessionTeaOffer;
  };

export type SessionSignature = { name: string; part: 'host' | 'guest'; slug?: string };
export type SessionPerson = { slug: string; name: string; role: string };
export type SessionPhotograph = { src: string; alt: string; by: SessionSignature | null };
export type SessionGuestItem =
  | { kind: 'photo'; src: string; alt: string; by: SessionSignature }
  | { kind: 'note'; text: string; by: SessionSignature };
