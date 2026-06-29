import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Circle } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { useWalkthrough } from '../lib/walkthroughStore';

/**
 * BriefingPage — the owner's walk-through guide. Not a map of pages (those are
 * reachable from normal nav); this holds the *flows* — the cross-feature chains
 * and the how-to that only lived in Adrian's head. Each walk-through is a real
 * procedure: numbered steps, a "try it here" button on the steps that have a
 * place to go, and a per-step check so he can run the flow, see what breaks or
 * looks wrong, and tick each step off.
 *
 * Per-step checks persist to D1 (feature_status.tested) keyed by step id, via
 * /api/admin/feature-status. Admin-only at the route; owner-only at the tile.
 */

// Prod uses api.teajia.com (workers.dev is blocked in China); dev honors the env var.
const API = import.meta.env.PROD
  ? 'https://api.teajia.com'
  : (import.meta.env.VITE_API_URL || 'https://teajia-api.lightcodes.workers.dev');

type Step = {
  text: string;        // the instruction
  to?: string;         // internal route to "try it"
  href?: string;       // external "try it"
  goLabel?: string;    // override the button label
};
type Walkthrough = {
  id: string;
  title: string;
  /** Why you'd run this / what it proves. One line. */
  intent: string;
  status?: 'not_built';   // honest gap marker
  steps: Step[];
};

// The five user types Your Table renders, and what the platform brings each.
// Descriptive (not impersonation) — manage the real grants in Members & Access.
type Role = { id: string; name: string; gets: string; can: string };
const ROLES: Role[] = [
  {
    id: 'reader', name: 'Reader',
    gets: 'The public, signed-in experience — the writing and the shop, made personal.',
    can: 'Read the magazine, browse and inquire on teas, save favorites, follow the learning tracks. No inventory, no admin. The lightest tier — someone who loves the tea but doesn\'t run anything.',
  },
  {
    id: 'member', name: 'Member',
    gets: 'A practitioner\'s own space — their tasting practice lives here.',
    can: 'Everything a Reader can, plus their own tasting journal (synced across devices) and the collections shared with them. This is the heart of the "manage your own collection" idea — a member treats Teajia as their personal tea record, not just a shop.',
  },
  {
    id: 'operator', name: 'Operator',
    gets: 'The keys to run a shop — the back-office, scoped to what they\'re granted.',
    can: 'Whatever capability bundles you give them: Catalog, Stock, Publish, Gather, Sell, Members — each unlocks that part of admin. An Operator with Stock+Sell runs inventory and orders but can\'t touch members; one with Publish curates and writes. You compose their power bundle by bundle.',
  },
  {
    id: 'staff', name: 'Staff',
    gets: 'A trusted hand inside one shop — broad access without ownership.',
    can: 'The admin tools their bundles allow, working on behalf of the shop, but not the owner-only controls (pricing that crosses accounts, the exchange rate, deleting members). The person who works the counter and the inventory, not the one who sets the strategy.',
  },
  {
    id: 'owner', name: 'Owner',
    gets: 'The whole platform — every shop they own, and the cross-account controls.',
    can: 'Everything: all admin, all bundles, the exchange rate, multi-store network, the audit log, and (as platform owner) acting across accounts. The full picture — what you have right now.',
  },
];

const WALKTHROUGHS: Walkthrough[] = [
  {
    id: 'wt:onboard',
    title: 'Onboard a team member',
    intent: 'Add someone and give them exactly the access they need — no more.',
    steps: [
      { text: 'Open Members & Access and invite or add the person.', to: '/admin/access', goLabel: 'Members & Access' },
      { text: 'Pick their tier (Guest → Member → Staff → Manager → Owner) and grant only the capability bundles they need (Catalog, Stock, Publish, Gather, Sell, Members).' },
      { text: 'Sign in as them (or have them sign in) and confirm they see only what you granted — wrong tiles here means the bundle is off.', to: '/account', goLabel: 'Your Table' },
    ],
  },
  {
    id: 'wt:mcp',
    title: 'Connect & test the assistant (MCP)',
    intent: 'Get a voice or AI assistant controlling the shop, and prove it works before trusting it.',
    steps: [
      { text: 'Mint a token in MCP Tokens (it shows once — copy it then).', to: '/admin/mcp-tokens', goLabel: 'MCP Tokens' },
      { text: `Point your assistant at the endpoint ${API}/mcp and paste the token.` },
      { text: 'Ask it "what\'s low on stock" — it should list your reorder teas. Compare against the real screen.', to: '/admin/stock', goLabel: 'Stock' },
      { text: 'Ask it to record a small sale — it should preview first, then confirm. Watch that the stock actually moves.', to: '/admin/orders', goLabel: 'Orders' },
    ],
  },
  {
    id: 'wt:csv',
    title: 'Bring in opening stock by CSV',
    intent: 'Load a whole spreadsheet of teas at once instead of typing each.',
    steps: [
      { text: 'Get the columns right: Type, Product Name, Grams, Stock, plus cost/currency where known.' },
      { text: 'Open Stock and start the CSV import.', to: '/admin/stock', goLabel: 'Stock' },
      { text: 'Drop the file, review the staged rows, fix any that look wrong, then commit. Confirm the teas appear in inventory with stock.' },
    ],
  },
  {
    id: 'wt:new-tea',
    title: 'A new tea, start to finish',
    intent: 'From "I have a new tea" to it being live and shoppable.',
    steps: [
      { text: 'Create the product in Catalog — name, type, year, conditional fields.', to: '/admin/catalog', goLabel: 'Catalog' },
      { text: 'Add its opening stock in Stock (writes a purchase-receipt to the ledger).', to: '/admin/stock', goLabel: 'Stock' },
      { text: 'Write its description, lore, and tasting notes so the product page reads well.', to: '/admin/catalog', goLabel: 'Catalog' },
      { text: 'Open the live shop and check the tea page looks right to a customer.', to: '/shop', goLabel: 'Shop' },
    ],
  },
  {
    id: 'wt:tasting-profile',
    title: 'Tasting → profile → shop by mood',
    intent: 'See how a tasting feeds the tea\'s mood/flavor and surfaces it to shoppers.',
    steps: [
      { text: 'Taste a tea and capture it (the mood/flavor taxonomy is part of the note).', to: '/account/journal', goLabel: 'Tasting Journal' },
      { text: 'On the product, confirm the mood/flavor that got promoted from tastings looks right.', to: '/admin/catalog', goLabel: 'Catalog' },
      { text: 'In the public shop, use "shop by mood" and check this tea shows up where it should.', to: '/shop', goLabel: 'Shop' },
    ],
  },
  {
    id: 'wt:samples',
    title: 'Sample set → labels → QR',
    intent: 'Build a set of samples and produce what the customer physically gets.',
    steps: [
      { text: 'Build the sample set (pick the teas, the amounts).', to: '/admin/samples', goLabel: 'Samples' },
      { text: 'Generate the label sheet and check each label reads right.' },
      { text: 'Generate the QR on a sample and scan it with your phone — confirm it lands where a customer expects.' },
    ],
  },
  {
    id: 'wt:brewing-qr',
    title: 'Brewing QR card',
    intent: 'Produce the brewing card a customer scans, and verify the scan.',
    steps: [
      { text: 'Open a tea in Stock and generate its brewing QR card.', to: '/admin/stock', goLabel: 'Stock' },
      { text: 'Share it to WhatsApp (or download) and check it looks right.' },
      { text: 'Scan the QR with your phone — confirm the brewing guide it opens is correct for that tea.' },
    ],
  },
  {
    id: 'wt:event',
    title: 'Run an event end to end',
    intent: 'From creating a gathering to the post-session recap.',
    steps: [
      { text: 'Create the event — date, capacity, tea menu.', to: '/admin/events', goLabel: 'Events' },
      { text: 'Check the public event page and that RSVP + capacity behave.', to: '/events', goLabel: 'Public events' },
      { text: 'Run the session (mark attendance, the tea menu).', to: '/admin/events', goLabel: 'Events' },
      { text: 'Write the recap — teas served, notes, purchase links — and confirm it shows on the public recap.' },
    ],
  },
  {
    id: 'wt:collection',
    title: 'Make & share a collection',
    intent: 'Curate a set and get it in front of the right people.',
    steps: [
      { text: 'Build the collection (pick the teas, the order, the framing).', to: '/admin/collections', goLabel: 'Collections' },
      { text: 'Publish it as an editorial band and check it on the storefront.', to: '/shop', goLabel: 'Shop' },
      { text: 'Share it to a contact or a tagged group, and confirm the share lands (no duplicate sends).', to: '/admin/contact-tags', goLabel: 'Contact Tags' },
    ],
  },
  {
    id: 'wt:sale',
    title: 'A sale, fully',
    intent: 'Watch one sale fire everything it should downstream.',
    steps: [
      { text: 'Record or fulfill an invoice in Orders.', to: '/admin/orders', goLabel: 'Orders' },
      { text: 'Confirm the stock ledger moved and the listing mirror updated.', to: '/admin/records', goLabel: 'Records' },
      { text: 'If it crossed a threshold, confirm the low-stock alert fired; if it hit zero, confirm the tea auto-archived.', to: '/admin/stock', goLabel: 'Stock' },
    ],
  },
  {
    id: 'wt:pdf-import',
    title: 'Import an order from a PDF',
    intent: 'Drop a supplier PDF and have the order parsed out.',
    status: 'not_built',
    steps: [
      { text: 'Not built yet. Today, bulk import is CSV-only (see "Bring in opening stock by CSV"); PDF is output-only. This is here so the gap is visible — say the word to scope building it.' },
    ],
  },
];

/** A problem flagged during a walk-through, read back from D1 for the rollup. */
type Finding = { stepId: string; walkTitle: string; stepText: string; works: string; note: string };

// stepId is `${walkthroughId}#${index}` — resolve it back to a human walk + step.
function resolveFinding(stepId: string, works: string, note: string): Finding | null {
  const [walkId, idxStr] = stepId.split('#');
  const wt = WALKTHROUGHS.find((w) => w.id === walkId);
  const idx = Number(idxStr);
  if (!wt || Number.isNaN(idx) || !wt.steps[idx]) return null;
  return { stepId, walkTitle: wt.title, stepText: wt.steps[idx].text, works, note };
}

export default function BriefingPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const startWalk = useWalkthrough((s) => s.start);
  const activeWalkId = useWalkthrough((s) => s.activeId);

  useEffect(() => {
    if (!isAdmin) return;
    api.featureStatus.list()
      .then((map) => {
        const next: Record<string, boolean> = {};
        const problems: Finding[] = [];
        for (const [id, s] of Object.entries(map)) {
          const row = s as { tested?: boolean; works?: string; notes?: string };
          next[id] = row.tested === true;
          // A finding = a step flagged broken / needs-revision, or one carrying a note.
          const isProblem = row.works === 'broken' || row.works === 'needs_revision';
          if (isProblem || (row.notes && row.notes.trim() !== '')) {
            const f = resolveFinding(id, row.works ?? 'unknown', row.notes ?? '');
            if (f) problems.push(f);
          }
        }
        setChecked(next);
        setFindings(problems);
      })
      .catch(() => { /* first run */ });
  }, [isAdmin]);

  const toggle = useCallback((stepId: string) => {
    setChecked((prev) => {
      const value = !prev[stepId];
      api.featureStatus.save(stepId, { tested: value }).catch(() => { /* optimistic */ });
      return { ...prev, [stepId]: value };
    });
  }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">These walk-throughs are visible to the platform owner only.</p>
        <button onClick={() => navigate('/account')} className="mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2">Back to Your Table</button>
      </div>
    );
  }

  const stepId = (wt: Walkthrough, i: number) => `${wt.id}#${i}`;

  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      <div className="max-w-[720px] mx-auto px-6 lg:px-8 pt-8">
        <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-6 tap-target">
          <ArrowLeft className="w-4 h-4" weight="bold" />
          <span className="text-ui-13">Your Table</span>
        </button>

        <div className="font-sans text-ui-12 uppercase tracking-[0.14em] text-tea-text-dim">The Guide</div>
        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em] mt-2">How it works, and who it's for</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-3 mb-10 leading-[1.65]">
          Two things: what the platform brings each kind of person, and the real flows you can run and test. Tap a
          role to see what it offers them; walk a flow and check off steps, catching what breaks or looks wrong.
        </p>

        {/* ── Problems found: the rollup of everything flagged across walk-throughs ──
            Reads from D1 so it survives reloads and shows after a walk is finished.
            This is the owner's working todo of what's broken, in one place. */}
        {findings.length > 0 && (
          <div className="mb-12 bg-tea-surface border border-tea-gold/30 rounded-xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-tea-border flex items-baseline justify-between gap-3">
              <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em]">Problems found</h2>
              <span className="font-sans text-ui-12 text-tea-gold shrink-0">{findings.length} to fix</span>
            </div>
            <ul className="px-5 py-2">
              {findings.map((f) => (
                <li key={f.stepId} className="flex items-start gap-3 py-3 border-b border-tea-border last:border-0">
                  <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${f.works === 'broken' ? 'bg-tea-gold' : 'bg-tea-gold/50'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-ui-12 text-tea-text-dim">{f.walkTitle}</div>
                    <p className="font-serif text-ui-14 text-tea-text-sec leading-[1.5] mt-0.5">{f.stepText}</p>
                    {f.note.trim() !== '' && (
                      <p className="font-serif text-ui-14 text-tea-text leading-[1.5] mt-1.5 pl-3 border-l-2 border-tea-gold/40">{f.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-5 py-2.5 border-t border-tea-border">
              <p className="font-sans text-ui-11 text-tea-text-dim leading-[1.5]">
                These are saved. To pull them into the project todo list, run <span className="text-tea-text-sec">npm run intake:findings</span> from the repo.
              </p>
            </div>
          </div>
        )}

        {/* ── Roles: what the platform brings each user type ── */}
        <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em] mb-1">Who it's for</h2>
        <p className="font-serif text-ui-14 text-tea-text-sec italic mb-4">What each kind of person gets at their level.</p>
        <div className="flex flex-col gap-2.5 mb-12">
          {ROLES.map((r) => {
            const open = openRole === r.id;
            return (
              <div key={r.id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                <button onClick={() => setOpenRole(open ? null : r.id)} className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-tea-gold/[0.03] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-ui-20 text-tea-text tracking-[0.01em]">{r.name}</div>
                    <div className="font-serif text-ui-14 text-tea-text-sec mt-0.5 leading-[1.45]">{r.gets}</div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-tea-text-dim shrink-0 mt-1 transition-transform ${open ? 'rotate-90' : ''}`} weight="bold" />
                </button>
                {open && (
                  <div className="px-5 pb-4 pt-1 border-t border-tea-border">
                    <p className="font-serif text-ui-15 text-tea-text-sec leading-[1.6] mt-3">{r.can}</p>
                    <button onClick={() => navigate('/admin/access')} className="mt-3 inline-flex items-center gap-1 font-sans text-ui-13 font-medium text-tea-gold-lt hover:text-tea-gold tap-target">
                      Manage roles & access <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Walk-throughs ── */}
        <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em] mb-1">Run it &amp; test it</h2>
        <p className="font-serif text-ui-14 text-tea-text-sec italic mb-4">The real flows. Each step has a button to go try it.</p>
        <div className="flex flex-col gap-5">
          {WALKTHROUGHS.map((wt) => {
            const notBuilt = wt.status === 'not_built';
            const total = wt.steps.length;
            const done = wt.steps.reduce((n, _s, i) => n + (checked[stepId(wt, i)] ? 1 : 0), 0);
            return (
              <section key={wt.id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-tea-border">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em]">{wt.title}</h2>
                    {notBuilt
                      ? <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim shrink-0">Not built yet</span>
                      : <span className="font-sans text-ui-12 text-tea-text-dim shrink-0">{done}/{total}</span>}
                  </div>
                  <p className="font-serif text-ui-14 text-tea-text-sec italic mt-1 leading-[1.5]">{wt.intent}</p>
                  {!notBuilt && (
                    <button
                      onClick={() => startWalk(wt.id, wt.title, wt.steps.map((s) => ({ text: s.text, to: s.to, goLabel: s.goLabel })))}
                      className="mt-3 inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-bg bg-tea-gold rounded-full px-3.5 py-1.5 hover:bg-tea-gold-lt tap-target"
                    >
                      {activeWalkId === wt.id ? 'Walking…' : 'Walk it with me'}
                      <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                    </button>
                  )}
                </div>

                <ol className="px-5 py-2">
                  {wt.steps.map((step, i) => {
                    const sid = stepId(wt, i);
                    const on = !!checked[sid];
                    return (
                      <li key={sid} className="flex items-start gap-3 py-3 border-b border-tea-border last:border-0">
                        {!notBuilt && (
                          <button onClick={() => toggle(sid)} className="shrink-0 mt-0.5 tap-target" aria-label={on ? 'Done' : 'Not done'}>
                            {on
                              ? <CheckCircle className="w-5 h-5 text-tea-gold-lt" weight="fill" />
                              : <Circle className="w-5 h-5 text-tea-text-dim" weight="regular" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            {!notBuilt && <span className="font-sans text-ui-12 text-tea-text-dim shrink-0">{i + 1}.</span>}
                            <p className={`font-serif text-ui-15 leading-[1.55] ${on ? 'text-tea-text-dim' : 'text-tea-text-sec'}`}>{step.text}</p>
                          </div>
                          {(step.to || step.href) && (
                            <div className="mt-1.5 ml-5">
                              {step.to && (
                                <button onClick={() => navigate(step.to!)} className="inline-flex items-center gap-1 font-sans text-ui-13 font-medium text-tea-gold-lt hover:text-tea-gold tap-target">
                                  {step.goLabel || 'Try it'} <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                                </button>
                              )}
                              {step.href && (
                                <a href={step.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-sans text-ui-13 font-medium text-tea-gold-lt hover:text-tea-gold tap-target">
                                  {step.goLabel || 'Try it'} <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
