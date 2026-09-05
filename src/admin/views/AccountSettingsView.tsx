import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Copy, ExternalLink, Loader2, Save, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useLaunchAudit, type LaunchAudit } from '../hooks/useLaunchAudit';
import { useRates } from '../hooks/useAdminData';
import { FALLBACK_SHIPPING_RATE_CURRENCY } from '../../lib/shippingRate';
import { usePersonReadiness } from '../../components/readiness/usePersonReadiness';
import { storeOpeningRefusal, type StoreOpeningRefusal } from '../../components/readiness/storeOpening';
import type { PersonReadinessInput } from '../../components/readiness/teaMasterReadiness';
import type { Account, AccountMember, AccountRole } from '../../types';

function useCurrentRole(): AccountRole | null {
  const { memberships, activeAccountId } = useAppStore();
  return useMemo(
    () => memberships.find((m) => m.account_id === activeAccountId)?.role ?? null,
    [memberships, activeAccountId],
  );
}

interface AccountSettingsViewProps {
  embedded?: boolean;
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ embedded = false }) => {
  const { activeAccountId, setActiveAccount } = useAppStore();
  const currentRole = useCurrentRole();
  const canEdit = currentRole === 'owner';

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copiedStorefront, setCopiedStorefront] = useState(false);
  const [refusal, setRefusal] = useState<StoreOpeningRefusal | null>(null);

  const { audit: launchAudit, refresh: loadLaunchAudit } = useLaunchAudit(activeAccountId, Boolean(account));
  // The person the shop would pay. The gate on the server asks about the shop's
  // host tea master; the person standing on this screen is its owner, so this
  // is the same question asked from where it can be answered without a second
  // endpoint. Only used to describe the storefront stage, never to permit it.
  //
  // Read only for the owner, because for anyone else it is somebody else's
  // profile answering a question about this shop, and a wrong answer here reads
  // as a shop that cannot take money when it can.
  const ownerReadiness = usePersonReadiness(Boolean(activeAccountId) && canEdit);
  const person = canEdit ? ownerReadiness : null;

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    setLoading(true);
    api.accounts
      .get(activeAccountId)
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
        setActiveAccount(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load account');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, setActiveAccount]);

  const update = <K extends keyof Account>(key: K, value: Account[K]) => {
    setAccount((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const { data: rates = [] } = useRates();

  /* The freight rate is typed, so it is held as text while the cursor is in it.
     Running every keystroke through Number() turns "8." into "8" and deletes
     the decimal point out from under the person typing it. Null means the field
     has not been touched since the account loaded. */
  const [freightText, setFreightText] = useState<string | null>(null);
  const freightValue = freightText ?? (
    account?.default_shipping_rate_per_kg == null ? '' : String(account.default_shipping_rate_per_kg)
  );
  const freightNumber = freightValue.trim() === '' ? null : Number(freightValue);
  const freightIsValid = freightNumber === null || (Number.isFinite(freightNumber) && freightNumber >= 0);

  /* What the typed rate is worth today, so the number is legible without a
     calculator. Freight is inside the cost basis the markup multiplies, so the
     line says what it adds to a gram on the shelf, which is the figure that
     actually moves when this field changes. */
  const freightHint = (() => {
    if (!freightIsValid) return 'Enter a number, or leave it empty to use the platform default.';
    if (freightNumber === null) return 'Empty means the platform default applies.';
    const currency = account?.default_shipping_rate_currency ?? FALLBACK_SHIPPING_RATE_CURRENCY;
    const rate = rates.find(r => r.currency === currency)?.rateToUSD;
    if (!rate || rate <= 0) return `Per kilo, in ${currency}. No live rate for ${currency} yet.`;
    const perKgUsd = freightNumber / rate;
    const perGramOnShelf = (perKgUsd / 1000) * 3;
    return `${freightNumber} ${currency}/kg is $${(Math.round(perKgUsd * 100) / 100).toFixed(2)} USD/kg at today's rate, `
      + `adding $${perGramOnShelf.toFixed(3)} per gram to the shelf price after the markup. `
      + 'Applies to every tea that has not had a rate entered on it.';
  })();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !activeAccountId) return;
    if (!freightIsValid) {
      setError('Freight rate must be a number, or empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    setRefusal(null);
    try {
      const updated = await api.accounts.update(activeAccountId, {
        name: account.name,
        tagline: account.tagline,
        description: account.description,
        logo_url: account.logo_url,
        cover_image_url: account.cover_image_url,
        location_city: account.location_city,
        location_country: account.location_country,
        timezone: account.timezone,
        currency_default: account.currency_default,
        whatsapp_number: account.whatsapp_number,
        contact_email: account.contact_email,
        public_enabled: account.public_enabled,
        default_shipping_rate_per_kg: freightNumber,
        default_shipping_rate_currency: account.default_shipping_rate_currency,
      });
      setAccount(updated);
      setActiveAccount(updated);
      // Hand the field back to the saved value, so it shows what the shop is
      // actually charging rather than what was last typed at it.
      setFreightText(null);
      setSaveMsg('Saved.');
    } catch (err: any) {
      const refused = storeOpeningRefusal(err);
      if (refused) {
        // Nothing was saved, so the checkbox is put back where the server left
        // it. A ticked box over a closed shop is the lie this whole gate exists
        // to prevent.
        setAccount((prev) => (prev ? { ...prev, public_enabled: false } : prev));
        setRefusal(refused);
      } else {
        setError(err?.message || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!activeAccountId) {
    return (
      <div className="p-12 text-center text-tea-text-sec font-serif">
        No active account selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-tea-text-dim">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-12 text-center text-tea-text-sec font-serif">
        {error || 'Account not found.'}
      </div>
    );
  }

  const disabled = !canEdit || saving;
  const storefrontUrl = `${window.location.origin}/store/${account.slug}`;

  const copyStorefrontUrl = async () => {
    await navigator.clipboard.writeText(storefrontUrl);
    setCopiedStorefront(true);
    window.setTimeout(() => setCopiedStorefront(false), 1800);
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
      {!embedded && (
        <div className="mb-8">
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>
            Account Settings
          </h1>
          <p className="label-caps text-tea-text-dim mt-1">
            {account.name}
          </p>
        </div>
      )}

      <LaunchReadinessPanel
        account={account}
        audit={launchAudit}
        storefrontUrl={storefrontUrl}
        copied={copiedStorefront}
        onCopy={copyStorefrontUrl}
        onRefresh={loadLaunchAudit}
        person={person}
      />

      {!canEdit && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-surface border border-tea-border text-ui-12 text-tea-text-sec">
          You don't have permission to edit these settings. View only.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-error/10 border border-tea-error/40 text-ui-12 text-tea-error">
          {error}
        </div>
      )}
      {refusal && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-md bg-tea-surface border border-tea-border">
          <p className="text-ui-13 text-tea-text leading-[1.5]">The shop was not opened. {refusal.message}</p>
          <a
            href={refusal.route}
            className="tap-target mt-2 inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            {refusal.fix}
            <ArrowRight size={11} />
          </a>
        </div>
      )}
      {saveMsg && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-green/10 border border-tea-green/40 text-ui-12 text-tea-green">
          {saveMsg}
        </div>
      )}

      <form id="account-profile-form" onSubmit={handleSave} className="space-y-6">
        {/* Read-only section */}
        <div className="bg-tea-surface rounded-xl border border-tea-border p-5 space-y-4">
          <h2 className="label-caps text-tea-text-dim">
            System
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadOnlyField label="Slug" value={account.slug} />
            <ReadOnlyField label="Invoice Prefix" value={account.invoice_prefix ?? '—'} />
            <ReadOnlyField
              label="Platform Owner"
              value={account.is_platform_owner ? 'Yes' : 'No'}
            />
          </div>
        </div>

        {/* Editable profile */}
        <div className="bg-tea-surface rounded-xl border border-tea-border p-5 space-y-3">
          <h2 className="label-caps text-tea-text-dim">
            Profile
          </h2>
          <Field
            label="Name"
            value={account.name}
            onChange={(v) => update('name', v)}
            disabled={disabled}
            hint="Shown at the top of the public store and in the network directory."
          />
          <Field
            label="Tagline"
            value={account.tagline ?? ''}
            onChange={(v) => update('tagline', v)}
            disabled={disabled}
            placeholder="A short invitation for visitors."
            hint="One sentence. This appears under the store name."
          />
          <TextAreaField
            label="Description"
            value={account.description ?? ''}
            onChange={(v) => update('description', v)}
            disabled={disabled}
            placeholder="What this table carries, where it is based, and how guests should approach it."
            hint="Use plain language. Visitors see this before they decide to message or buy."
          />
          <Field
            label="Logo URL"
            value={account.logo_url ?? ''}
            onChange={(v) => update('logo_url', v)}
            disabled={disabled}
            placeholder="https://..."
          />
          <Field
            label="Cover Image URL"
            value={account.cover_image_url ?? ''}
            onChange={(v) => update('cover_image_url', v)}
            disabled={disabled}
            placeholder="https://..."
            hint="Optional. Used as the atmosphere image at the top of the public store."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="City"
              value={account.location_city ?? ''}
              onChange={(v) => update('location_city', v)}
              disabled={disabled}
              placeholder="Melbourne"
            />
            <Field
              label="Country"
              value={account.location_country ?? ''}
              onChange={(v) => update('location_country', v)}
              disabled={disabled}
              placeholder="Australia"
            />
          </div>
        </div>

        {/* Commerce */}
        <div className="bg-tea-surface rounded-xl border border-tea-border p-5 space-y-3">
          <h2 className="label-caps text-tea-text-dim">
            Commerce
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="WhatsApp Number"
              value={account.whatsapp_number ?? ''}
              onChange={(v) => update('whatsapp_number', v)}
              disabled={disabled}
              placeholder="+614XXXXXXXX"
              hint="Used for visitor questions and WhatsApp checkout. Include the country code."
            />
            <Field
              label="Contact Email"
              value={account.contact_email ?? ''}
              onChange={(v) => update('contact_email', v)}
              disabled={disabled}
              placeholder="hello@example.com"
              hint="Fallback contact for visitors who do not use WhatsApp."
            />
            <Field
              label="Default Currency"
              value={account.currency_default ?? ''}
              onChange={(v) => update('currency_default', v)}
              disabled={disabled}
              placeholder="AUD"
            />
            {/* Freight. It belongs on this screen and not in code because it is
                a negotiated number: it changes when the forwarder's price
                changes, and a rate that needs a deploy to edit is a rate that
                stays wrong. Quoted in the currency it is paid in, because a
                yuan rate translated to dollars once goes stale the moment the
                yuan moves. */}
            <Field
              label="Freight Rate per kg"
              value={freightValue}
              onChange={(v) => setFreightText(v)}
              disabled={disabled}
              placeholder="85"
              hint={freightHint}
            />
            <Field
              label="Freight Currency"
              value={account.default_shipping_rate_currency ?? ''}
              onChange={(v) => update('default_shipping_rate_currency', v.trim() === '' ? null : v.trim())}
              disabled={disabled}
              placeholder="Yuan"
              hint="The currency the freight rate above is quoted in. Yuan, USD, HKD."
            />
            <Field
              label="Timezone"
              value={account.timezone ?? ''}
              onChange={(v) => update('timezone', v)}
              disabled={disabled}
              placeholder="Australia/Melbourne"
              hint="Used for event timing and account operations."
            />
          </div>
          <label className="flex items-start gap-3 pt-2">
            <input
              type="checkbox"
              checked={!!account.public_enabled}
              onChange={(e) => update('public_enabled', e.target.checked)}
              disabled={disabled}
              className="accent-tea-gold mt-1"
            />
            <span>
              <span className="block text-ui-14 text-tea-text">Public shop enabled</span>
              <span className="block text-ui-12 text-tea-text-sec mt-0.5">
                When enabled, the store can appear publicly at <span className="font-mono">/store/{account.slug}</span>.
              </span>
            </span>
          </label>
        </div>

        {canEdit && (
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
              Save Changes
            </button>
          </div>
        )}
      </form>

      {/* Integrations, per-account third-party API keys (BYOK) */}
      {canEdit && (
        <div className="mt-10">
          <h2 className="label-caps text-tea-text-dim mb-3">
            Integrations
          </h2>
          <IntegrationsSection
            account={account}
            accountId={activeAccountId!}
            onAccountChange={setAccount}
          />
        </div>
      )}

      {/* Danger Zone */}
      {canEdit && (
        <div className="mt-10">
          <h2 className="label-caps text-tea-text-dim mb-3">
            Danger Zone
          </h2>
          <TransferOwnershipSection account={account} accountId={activeAccountId!} />
        </div>
      )}
    </div>
    </div>
  );
};

// ─── Launch Readiness ────────────────────────────────────────────────────────

const LaunchReadinessPanel: React.FC<{
  account: Account;
  audit: LaunchAudit;
  storefrontUrl: string;
  copied: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  /** Null when the viewer is not the owner, so nothing is claimed about them. */
  person: PersonReadinessInput | null;
}> = ({ account, audit, storefrontUrl, copied, onCopy, onRefresh, person }) => {
  const profileReady = !!account.public_enabled
    && !!account.location_country
    && !!account.currency_default
    && (!!account.whatsapp_number || !!account.contact_email)
    && !!account.tagline
    && !!account.description;
  const teamReady = audit.team.owners > 0 && audit.team.membersWithoutBundles === 0;
  const inventoryReady = audit.products.readyPublic > 0;
  // Being paid is part of opening the shop, not a separate concern: the server
  // now refuses to make a store public until the person it pays holds a public
  // payment method behind a published profile. The stage says so rather than
  // letting the refusal be the first anyone hears of it.
  const canBePaid = !person || (person.isPublished && person.publishedPaymentMethods > 0);
  const storefrontReady = !!account.public_enabled
    && audit.products.readyPublic > 0
    && (!!account.whatsapp_number || !!account.contact_email)
    && canBePaid;
  const saleReady = storefrontReady && audit.orders.total > 0;
  const eventReady = audit.events.upcoming > 0;

  const stages = [
    {
      id: 'account',
      label: 'Account',
      done: profileReady,
      detail: profileReady
        ? 'Store identity, contact, currency, and public state are ready.'
        : 'Finish public profile, contact path, currency, and location before sharing the store.',
      action: 'Finish profile',
      href: '#account-profile-form',
      checks: [
        { label: 'Public store enabled', done: !!account.public_enabled },
        { label: 'Location and AUD/default currency set', done: !!account.location_country && !!account.currency_default },
        { label: 'WhatsApp or email visible', done: !!account.whatsapp_number || !!account.contact_email },
        { label: 'Tagline and description written', done: !!account.tagline && !!account.description },
      ],
    },
    {
      id: 'team',
      label: 'Team',
      done: teamReady,
      detail: audit.loading
        ? 'Checking team access.'
        : `${audit.team.total} member${audit.team.total === 1 ? '' : 's'}, ${audit.team.pendingInvites} pending invite${audit.team.pendingInvites === 1 ? '' : 's'}.`,
      action: 'Review access',
      href: '/admin/access',
      checks: [
        { label: 'At least one owner', done: audit.team.owners > 0 },
        { label: 'Pending invites are visible', done: true },
        { label: 'No staff members without bundles', done: audit.team.membersWithoutBundles === 0 },
      ],
    },
    {
      id: 'inventory',
      label: 'Stock',
      done: inventoryReady,
      detail: audit.loading
        ? 'Checking opening stock.'
        : `${audit.products.total} active item${audit.products.total === 1 ? '' : 's'}, ${audit.products.readyPublic} ready for public sale.`,
      action: audit.products.total === 0 ? 'Import stock' : 'Review stock',
      href: '/admin/stock',
      checks: [
        { label: 'Opening stock exists', done: audit.products.total > 0 },
        { label: 'At least one public, priced, stocked item', done: audit.products.readyPublic > 0 },
        { label: 'Products have images', done: audit.products.total === 0 ? false : audit.products.withImages === audit.products.total },
        { label: 'Products have tea or ware type', done: audit.products.total === 0 ? false : audit.products.withType === audit.products.total },
      ],
    },
    {
      id: 'storefront',
      label: 'Storefront',
      done: storefrontReady,
      detail: storefrontReady
        ? 'The public page has products, a contact path, and somewhere for money to go.'
        : canBePaid
          ? 'Preview the public page and fix missing stock or contact before sharing.'
          : 'The shop cannot open until customers have somewhere to send payment.',
      action: canBePaid ? 'Open storefront' : 'Set up payment',
      href: canBePaid ? storefrontUrl : '/account/profile',
      external: canBePaid,
      checks: [
        { label: 'Public page enabled', done: !!account.public_enabled },
        { label: 'Public products available', done: audit.products.readyPublic > 0 },
        { label: 'Checkout/contact route exists', done: !!account.whatsapp_number || !!account.contact_email },
        ...(person ? [
          { label: 'Your Tea Master profile is published', done: person.isPublished },
          { label: 'A public payment method to be paid through', done: person.publishedPaymentMethods > 0 },
        ] : []),
      ],
    },
    {
      id: 'sale',
      label: 'First sale rehearsal',
      done: saleReady,
      detail: audit.orders.total > 0
        ? `${audit.orders.total} order${audit.orders.total === 1 ? '' : 's'} recorded, ${audit.orders.pending} pending.`
        : 'Run one test order before the first real customer message.',
      action: 'Practice order flow',
      href: '/admin/activity?tab=orders',
      checks: [
        { label: 'Storefront can accept an inquiry', done: storefrontReady },
        { label: 'At least one order recorded', done: audit.orders.total > 0 },
        { label: 'Pending orders are visible', done: audit.orders.total > 0 || audit.orders.pending === 0 },
      ],
    },
    {
      id: 'event',
      label: 'First event',
      done: eventReady,
      detail: audit.events.upcoming > 0
        ? `${audit.events.upcoming} upcoming event${audit.events.upcoming === 1 ? '' : 's'} ready.`
        : 'Optional for commerce launch, useful for testing RSVP and guest flow.',
      action: audit.events.upcoming > 0 ? 'Review events' : 'Create event',
      href: '/admin/events',
      checks: [
        { label: 'Event tool reachable', done: true },
        { label: 'Upcoming event created', done: audit.events.upcoming > 0 },
      ],
    },
  ];

  const readyCount = stages.filter(item => item.done).length;
  const nextStage = stages.find(item => !item.done);

  return (
    <section className="mb-6 bg-tea-surface border border-tea-border rounded-xl p-5 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Launch Center</h2>
          <p className="text-ui-13 text-tea-text-sec leading-[1.6] mt-1 max-w-2xl">
            Follow these steps before sharing this store with customers. The checks read live account data where the system can verify it. The full playbook gives operators the worksheet and linked setup path.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-ui-12 text-tea-text-sec">
            <span className="font-mono text-tea-text">{readyCount}</span> of {stages.length} launch steps ready
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={audit.loading}
            className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors tap-target"
            aria-label="Refresh launch status"
            title="Refresh"
          >
            <RefreshCw size={14} className={audit.loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {audit.error && (
        <div className="bg-tea-error/10 border border-tea-error/40 rounded-md px-4 py-3 text-ui-13 text-tea-error">
          {audit.error}
        </div>
      )}

      {nextStage && (
        <div className="bg-tea-bg border border-tea-border rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-tea-text-dim mb-1">Next useful step</p>
            <p className="text-ui-15 text-tea-text font-display">{nextStage.label}</p>
            <p className="text-ui-12 text-tea-text-sec leading-[1.5] mt-0.5">{nextStage.detail}</p>
          </div>
          <LaunchActionLink stage={nextStage} />
        </div>
      )}

      <div className="divide-y divide-tea-border border-y border-tea-border">
        {stages.map((stage, index) => (
          <LaunchStageRow key={stage.id} stage={stage} index={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          <p className="label-caps text-tea-text-dim mb-2">Storefront</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 min-w-0 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-11 text-tea-text-sec font-mono truncate">
              {storefrontUrl}
            </code>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors text-ui-12 tap-target"
              >
                <Copy size={12} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors text-ui-12 tap-target"
              >
                <ExternalLink size={12} />
                Open
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-start md:justify-end lg:self-end">
          {[
            { label: 'Import stock', href: '/admin/stock' },
            { label: 'Review access', href: '/admin/access' },
          ].map(step => (
            <a
              key={step.href}
              href={step.href}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12"
            >
              {step.label}
              <ArrowRight size={11} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

type LaunchStage = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  action: string;
  href: string;
  external?: boolean;
  checks: Array<{ label: string; done: boolean }>;
};

const LaunchStageRow: React.FC<{ stage: LaunchStage; index: number }> = ({ stage, index }) => (
  <div className="py-4 flex flex-col lg:flex-row lg:items-start gap-4">
    <div className="flex items-start gap-3 flex-1 min-w-0">
      <div className="pt-0.5 shrink-0">
        {stage.done ? (
          <CheckCircle2 size={16} className="text-tea-gold" />
        ) : (
          <Circle size={16} className="text-tea-text-dim" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-ui-11 text-tea-text-dim">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="font-display text-ui-17 text-tea-text">{stage.label}</h3>
          {!stage.done && <span className="text-ui-12 text-tea-text-sec italic">Needs attention</span>}
        </div>
        <p className="text-ui-13 text-tea-text-sec leading-[1.5] mt-1">{stage.detail}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {stage.checks.map(check => (
            <div key={check.label} className="flex items-start gap-2 min-w-0">
              {check.done ? (
                <CheckCircle2 size={12} className="text-tea-gold shrink-0 mt-0.5" />
              ) : (
                <Circle size={12} className="text-tea-text-dim shrink-0 mt-0.5" />
              )}
              <span className="text-ui-12 text-tea-text-sec leading-[1.45]">{check.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <LaunchActionLink stage={stage} />
  </div>
);

const LaunchActionLink: React.FC<{ stage: LaunchStage }> = ({ stage }) => (
  <a
    href={stage.href}
    target={stage.external ? '_blank' : undefined}
    rel={stage.external ? 'noreferrer' : undefined}
    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12 shrink-0"
  >
    {stage.action}
    {stage.external ? <ExternalLink size={11} /> : <ArrowRight size={11} />}
  </a>
);

// ─── Integrations (BYOK) ─────────────────────────────────────────────────────

const IntegrationsSection: React.FC<{
  account: Account;
  accountId: string;
  onAccountChange: (a: Account) => void;
}> = ({ account, accountId, onAccountChange }) => {
  const [editing, setEditing] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasKey = Boolean(account.has_openai_key);
  const last4 = account.openai_key_last4 || null;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.accounts.setOpenAIKey(accountId, keyInput.trim());
      onAccountChange({ ...account, has_openai_key: res.has_openai_key, openai_key_last4: res.openai_key_last4 });
      setKeyInput('');
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save key');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.accounts.clearOpenAIKey(accountId);
      onAccountChange({ ...account, has_openai_key: res.has_openai_key, openai_key_last4: res.openai_key_last4 });
    } catch (e: any) {
      setErr(e?.message || 'Failed to clear key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-tea-surface rounded-xl border border-tea-border p-5 space-y-3">
      <div>
        <h3 className="h3 text-tea-text">
          OpenAI API Key
        </h3>
        <p className="text-ui-12 text-tea-text-dim mt-1 leading-[1.5]">
          Used for the AI Enhance action on product photos. Stored encrypted; only the last
          four characters are shown for confirmation.
        </p>
      </div>

      {!editing && hasKey && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ui-12 text-tea-text font-mono">sk-…{last4 ?? '••••'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditing(true); setKeyInput(''); setErr(null); }}
              disabled={busy}
              className="px-3 py-1.5 text-ui-12 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="px-2 py-1 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {!editing && !hasKey && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ui-12 text-tea-text-dim">No key configured.</span>
          <button
            type="button"
            onClick={() => { setEditing(true); setKeyInput(''); setErr(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Add Key
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-12 text-tea-text font-mono placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setEditing(false); setKeyInput(''); setErr(null); }}
              disabled={busy}
              className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || keyInput.trim().length < 10}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {busy && <Loader2 className="animate-spin" size={12} />}
              Save Key
            </button>
          </div>
        </div>
      )}

      {err && <div className="text-ui-12 text-tea-error">{err}</div>}
    </div>
  );
};

// ─── Transfer Ownership ──────────────────────────────────────────────────────

type TransferStep = 'idle' | 'select-member' | 'confirm-name' | 'verify-password';

const TransferOwnershipSection: React.FC<{
  account: Account;
  accountId: string;
}> = ({ account, accountId }) => {
  const [step, setStep] = useState<TransferStep>('idle');
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.user_id === selectedMemberId) ?? null;
  const nameMatches = confirmName.trim() === account.name.trim();

  const openFlow = async () => {
    setStep('select-member');
    setSelectedMemberId('');
    setConfirmName('');
    setPasswordInput('');
    setTransferError(null);
    setLoadingMembers(true);
    try {
      const data = await api.accounts.listMembers(accountId);
      setMembers(data.filter((m) => m.role !== 'owner'));
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedMember) return;
    setTransferring(true);
    setTransferError(null);
    try {
      const result = await api.auth.verifyPassword(passwordInput);
      if (!result?.verified) {
        setTransferError('Incorrect password. Transfer cancelled.');
        setTransferring(false);
        return;
      }
      await api.accounts.transferOwnership(accountId, selectedMember.user_id);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed. Please try again.';
      setTransferError(msg.includes('401') || msg.toLowerCase().includes('incorrect') ? 'Incorrect password. Transfer cancelled.' : msg);
      setTransferring(false);
    }
  };

  return (
    <div className="bg-tea-surface rounded-xl border border-tea-border overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-4">
        <AlertTriangle size={16} className="text-tea-error mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="h3 text-tea-text">Transfer Ownership</p>
          <p className="text-ui-12 text-tea-text-dim mt-0.5 leading-[1.5]">
            Transfer this account to another team member. You will lose owner access.
          </p>
        </div>
        {step === 'idle' && (
          <button
            type="button"
            onClick={openFlow}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-ui-12 border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
          >
            Transfer <ArrowRight size={11} />
          </button>
        )}
      </div>

      {/* Gate 1: Select target member */}
      {step === 'select-member' && (
        <div className="border-t border-tea-border px-5 py-4 space-y-3">
          <p className="label-caps text-tea-text-dim">Step 1 of 3: Select new owner</p>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-ui-12 text-tea-text-dim py-2">
              <Loader2 size={12} className="animate-spin" /> Loading team members…
            </div>
          ) : members.length === 0 ? (
            <p className="text-ui-12 text-tea-text-sec py-2">No other team members. Add a member first.</p>
          ) : (
            <>
              <div>
                <label className="label-caps text-tea-text-sec mb-1.5 block">
                  New Owner
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
                >
                  <option value="">Select a team member</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('idle')}
                  className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedMemberId}
                  onClick={() => { setConfirmName(''); setStep('confirm-name'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  Next <ArrowRight size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Gate 2: Type exact account name */}
      {step === 'confirm-name' && selectedMember && (
        <div className="border-t border-tea-border px-5 py-4 space-y-3">
          <p className="label-caps text-tea-text-dim">Step 2 of 3: Confirm account name</p>
          <div className="bg-tea-bg border border-tea-border rounded-md px-4 py-3 text-ui-14 text-tea-text-sec space-y-1">
            <p>
              Transfer <span className="text-tea-text">{account.name}</span> to{' '}
              <span className="text-tea-text">{selectedMember.name || selectedMember.email}</span>?
            </p>
            <p className="text-ui-12 text-tea-text-dim">{selectedMember.email} · current role: {selectedMember.role}</p>
          </div>
          <div>
            <label className="label-caps text-tea-text-sec mb-1.5 block">
              Type the account name to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={account.name}
              autoFocus
              className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
            />
            <p className="mt-1 text-ui-12 text-tea-text-dim">
              Must match exactly: <span className="text-tea-text-sec font-mono">{account.name}</span>
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep('select-member')}
              className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!nameMatches}
              onClick={() => { setPasswordInput(''); setTransferError(null); setStep('verify-password'); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40"
            >
              Next <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Gate 3: Re-enter password */}
      {step === 'verify-password' && selectedMember && (
        <div className="border-t border-tea-border px-5 py-4 space-y-3">
          <p className="label-caps text-tea-text-dim">Step 3 of 3: Authorise</p>
          <div>
            <label className="label-caps text-tea-text-sec mb-1.5 block">
              Re-enter your password to authorise
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setTransferError(null); }}
              autoFocus
              className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
            />
          </div>
          {transferError && (
            <p className="text-ui-12 text-tea-error">{transferError}</p>
          )}
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep('confirm-name')}
              disabled={transferring}
              className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!passwordInput || transferring}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors disabled:opacity-40"
            >
              {transferring ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
              Transfer Ownership
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Field helpers ────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}> = ({ label, value, onChange, disabled, placeholder, hint }) => (
  <div>
    <label className="label-caps text-tea-text-sec mb-1.5 block">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none disabled:opacity-60"
    />
    {hint && <p className="mt-1 text-ui-12 text-tea-text-dim leading-[1.5]">{hint}</p>}
  </div>
);

const TextAreaField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}> = ({ label, value, onChange, disabled, placeholder, hint }) => (
  <div>
    <label className="label-caps text-tea-text-sec mb-1.5 block">
      {label}
    </label>
    <textarea
      value={value}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none disabled:opacity-60 resize-none"
    />
    {hint && <p className="mt-1 text-ui-12 text-tea-text-dim leading-[1.5]">{hint}</p>}
  </div>
);

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="label-caps text-tea-text-dim mb-1">{label}</div>
    <div className="text-ui-14 text-tea-text-sec font-mono">{value || '—'}</div>
  </div>
);

export default AccountSettingsView;
