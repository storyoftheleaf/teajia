/** Customer delivery postage is separate from the shop's inbound freight. */
export interface UsShippingAddress { street: string; city: string; state: string; postcode: string }
const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI AA AE AP'.split(' '));
export function validateUsShippingAddress(address: UsShippingAddress): Record<string, string> {
  const errors: Record<string, string> = {};
  if (address.street.trim().length < 3 || address.street.trim().length > 300) errors.address = 'Enter your street address, including apartment or unit if needed.';
  if (!address.city.trim() || /[,\r\n]/.test(address.city) || address.city.trim().length > 100) errors.location = 'Enter your city.';
  if (!US_STATES.has(address.state.trim().toUpperCase())) errors.state = 'Enter a two-letter US state code, for example CA.';
  if (!/^\d{5}(-\d{4})?$/.test(address.postcode.trim())) errors.postcode = 'Enter a valid US ZIP code.';
  return errors;
}
export function formatUsShippingAddress(address: UsShippingAddress): string {
  return `${address.street.trim()}\n${address.city.trim()}, ${address.state.trim().toUpperCase()} ${address.postcode.trim()}\nUnited States`;
}
