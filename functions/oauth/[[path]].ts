// Cloudflare Pages Function: the same same-origin proxy as /api/*, for /oauth/*.
//
// Connecting an agent (Claude, ChatGPT, Grok Bot) to the shop ends on the
// consent page at /admin/oauth-consent/<id>, which reads the request back from
// /oauth/authorize/request/<id> and posts Adrian's yes to
// /oauth/authorize/decision. Both are asked of the app's own origin, because
// since 2026-06-29 the app talks to the API through teajia.com rather than
// api.teajia.com (the China fix, see ./api/[[path]].ts). Only /api/* was
// forwarded, so /oauth/* fell through to the SPA and the consent page got
// index.html where it expected JSON: "Unexpected token '<'". Every agent
// sign-in failed at the last step. The worker serves /oauth/* itself, so this
// forwards the path unchanged, with the same timeouts and manual redirects.
export { onRequest } from '../api/[[path]]';
