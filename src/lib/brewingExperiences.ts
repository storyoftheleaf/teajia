// "Brewing experiences" (/tea-feed) is built but not approved by Adrian yet.
// This one switch decides whether a visitor can reach it: the button under a
// recap's lead photograph and the route itself. Off until he says yes.
export const BREWING_EXPERIENCES_OPEN = false;

/** A guest's yes to Brewing experiences counts only while the page can be reached. */
export function brewingConsent(asked: boolean): boolean {
  return BREWING_EXPERIENCES_OPEN && asked;
}
