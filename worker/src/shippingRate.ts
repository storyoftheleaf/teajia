/**
 * What freight costs, per kilo, when nobody has said otherwise.
 *
 * ONE number, and this is it. The shop had four: products defaulted to 0, the
 * intake batch to 10, the Add Product form to 13, and the MCP tool documented
 * 10 while writing whatever it was handed. The same tea therefore landed at a
 * different cost depending on which door it came through, and a product
 * created by hand carried no freight at all in its retail price.
 *
 * USD per kg, because that is how Adrian quotes it. A per-product rate is
 * written in the COST currency and overrides this whenever it holds a real
 * value; 0 means nobody entered one, not free freight.
 *
 * It lives in its own module so the pricing function and the intake path can
 * both read it without importing each other.
 */
export const DEFAULT_SHIPPING_RATE_PER_KG_USD = 12;
