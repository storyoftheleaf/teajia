import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Copy, ExternalLink, Loader2, Save, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { Account, AccountMember, AccountRole } from '../../types';
import type { TeaEvent } from '../../types/events';

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

type LaunchProductAudit = {
  total: number;
  publicCount: number;
  priced: number;
  stocked: number;
  withImages: number;
  withType: number;
  readyPublic: number;
};

type LaunchTeamAudit = {
  total: number;
  owners: number;
  activeMembers: number;
  pendingInvites: number;
  membersWithoutBundles: number;
};

type LaunchAudit = {
  loading: boolean;
  error: string | null;
  products: LaunchProductAudit;
  team: LaunchTeamAudit;
  events: {
    total: number;
    upcoming: number;
  };
  orders: {
    total: number;
    pending: number;
  };
};

const EMPTY_LAUNCH_AUDIT: LaunchAudit = {
  loading: true,
  error: null,
  products: {
    total: 0,
    publicCount: 0,
    priced: 0,
    stocked: 0,
    withImages: 0,
    withType: 0,
    readyPublic: 0,
  },
  team: {
    total: 0,
    owners: 0,
    activeMembers: 0,
    pendingInvites: 0,
    membersWithoutBundles: 0,
  },
  events: {
    total: 0,
    upcoming: 0,
  },
  orders: {
    total: 0,
    pending: 0,
  },
};

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
  const [launchAudit, setLaunchAudit] = useState<LaunchAudit>(EMPTY_LAUNCH_AUDIT);

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

  const loadLaunchAudit = async () => {
    if (!activeAccountId) return;
    setLaunchAudit((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [productsRaw, accessRaw, eventsRaw, invoicesRaw] = await Promise.allSettled([
        api.products.list(),
        api.accounts.getAccess(activeAccountId),
        api.events.listAdmin(),
        api.invoices.list(100),
      ]);

      const products = productsRaw.status === 'fulfilled' && Array.isArray(productsRaw.value)
        ? productsRaw.value as any[]
        : [];
      const members = accessRaw.status === 'fulfilled'
        ? accessRaw.value.members || []
        : [];
      const events = eventsRaw.status === 'fulfilled' && Array.isArray(eventsRaw.value)
        ? eventsRaw.value as TeaEvent[]
        : [];
      const invoices = invoicesRaw.status === 'fulfilled' && Array.isArray(invoicesRaw.value)
        ? invoicesRaw.value as any[]
        : [];

      const activeProducts = products.filter((p) => p.status !== 'Archived');
      const publicProducts = activeProducts.filter((p) => p.is_public !== false);
      const pricedProducts = activeProducts.filter((p) =>
        Number(p.retail_price_per_gram_usd) > 0 || Number(p.fixed_retail_price_usd) > 0
      );
      const stockedProducts = activeProducts.filter((p) =>
        Number(p.stock_grams) > 0 || Number(p.quantity_units) > 0
      );
      const imageProducts = activeProducts.filter((p) => Boolean(p.image_url));
      const typedProducts = activeProducts.filter((p) => Boolean(p.type));
      const readyPublicProducts = publicProducts.filter((p) =>
        (Number(p.stock_grams) > 0 || Number(p.quantity_units) > 0)
        && (Number(p.retail_price_per_gram_usd) > 0 || Number(p.fixed_retail_price_usd) > 0)
        && Boolean(p.product_name)
      );
      const now = Date.now();
      const upcomingEvents = events.filter((event: any) => {
        const date = new Date(event.eventDate || event.event_date || event.date || '').getTime();
        return Number.isFinite(date) && date >= now && event.status !== 'archived';
      });

      setLaunchAudit({
        loading: false,
        error: null,
        products: {
          total: activeProducts.length,
          publicCount: publicProducts.length,
          priced: pricedProducts.length,
          stocked: stockedProducts.length,
          withImages: imageProducts.length,
          withType: typedProducts.length,
          readyPublic: readyPublicProducts.length,
        },
        team: {
          total: members.length,
          owners: members.filter((m: AccountMember) => m.role === 'owner').length,
          activeMembers: members.filter((m: AccountMember) => m.status !== 'invited').length,
          pendingInvites: members.filter((m: AccountMember) => m.status === 'invited' || (m.invited_at && !m.joined_at)).length,
          membersWithoutBundles: members.filter((m: AccountMember) => m.role === 'staff' && (m.bundles?.length || 0) === 0).length,
        },
        events: {
          total: events.length,
          upcoming: upcomingEvents.length,
        },
        orders: {
          total: invoices.length,
          pending: invoices.filter((invoice) => invoice.status === 'Pending').length,
        },
      });
    } catch (err: any) {
      setLaunchAudit((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Could not load launch status.',
      }));
    }
  };

  useEffect(() => {
    if (!activeAccountId || !account) return;
    void loadLaunchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, account?.id]);

  const update = <K extends keyof Account>(key: K, value: Account[K]) => {
    setAccount((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !activeAccountId) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
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
      });
      setAccount(updated);
      setActiveAccount(updated);
      setSaveMsg('Saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
              Save Changes
            </button>
          </div>
        )}
      </form>

      {/* Integrations — per-account third-party API keys (BYOK) */}
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
}> = ({ account, audit, storefrontUrl, copied, onCopy, onRefresh }) => {
  const profileReady = !!account.public_enabled
    && !!account.location_country
    && !!account.currency_default
    && (!!account.whatsapp_number || !!account.contact_email)
    && !!account.tagline
    && !!account.description;
  const teamReady = audit.team.owners > 0 && audit.team.membersWithoutBundles === 0;
  const inventoryReady = audit.products.readyPublic > 0;
  const storefrontReady = !!account.public_enabled
    && audit.products.readyPublic > 0
    && (!!account.whatsapp_number || !!account.contact_email);
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
      label: 'Inventory',
      done: inventoryReady,
      detail: audit.loading
        ? 'Checking opening stock.'
        : `${audit.products.total} active item${audit.products.total === 1 ? '' : 's'}, ${audit.products.readyPublic} ready for public sale.`,
      action: audit.products.total === 0 ? 'Import stock' : 'Review stock',
      href: '/admin/inventory',
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
        ? 'The public page has products and a contact path.'
        : 'Preview the public page and fix missing stock or contact before sharing.',
      action: 'Open storefront',
      href: storefrontUrl,
      external: true,
      checks: [
        { label: 'Public page enabled', done: !!account.public_enabled },
        { label: 'Public products available', done: audit.products.readyPublic > 0 },
        { label: 'Checkout/contact route exists', done: !!account.whatsapp_number || !!account.contact_email },
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
            { label: 'Open playbook', href: '/admin/launch-playbook' },
            { label: 'Import stock', href: '/admin/inventory' },
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
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
          <p className="label-caps text-tea-text-dim">Step 1 of 3 — Select new owner</p>
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
                  <option value="">— select a team member —</option>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
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
          <p className="label-caps text-tea-text-dim">Step 2 of 3 — Confirm account name</p>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
            >
              Next <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Gate 3: Re-enter password */}
      {step === 'verify-password' && selectedMember && (
        <div className="border-t border-tea-border px-5 py-4 space-y-3">
          <p className="label-caps text-tea-text-dim">Step 3 of 3 — Authorise</p>
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
