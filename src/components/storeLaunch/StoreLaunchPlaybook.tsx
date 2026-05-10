import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Package,
  Store,
  Users,
} from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { Account } from '../../types';

type PlaybookMode = 'public' | 'admin';

type Worksheet = {
  storeName: string;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  ownerEmail: string;
  firstStaffEmail: string;
  publicContactName: string;
  publicContactEmail: string;
  publicWhatsapp: string;
  openingStockCount: string;
  firstPublicTea: string;
  firstEventName: string;
  launchDate: string;
};

const EMPTY_WORKSHEET: Worksheet = {
  storeName: '',
  city: '',
  country: '',
  currency: '',
  timezone: '',
  ownerEmail: '',
  firstStaffEmail: '',
  publicContactName: '',
  publicContactEmail: '',
  publicWhatsapp: '',
  openingStockCount: '',
  firstPublicTea: '',
  firstEventName: '',
  launchDate: '',
};

const STORAGE_KEY = 'teajia-store-launch-details';

const toWorksheetFromAccount = (account?: Account | null): Partial<Worksheet> => {
  if (!account) return {};
  return {
    storeName: account.name || '',
    city: account.location_city || '',
    country: account.location_country || '',
    currency: account.currency_default || '',
    timezone: account.timezone || '',
    publicContactEmail: account.contact_email || '',
    publicWhatsapp: account.whatsapp_number || '',
  };
};

const fieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: keyof Worksheet; label: string; placeholder: string; type?: string; hint?: string }>;
}> = [
  {
    title: 'Store identity',
    description: 'What customers will see, where the store is based, and how prices and dates should appear.',
    fields: [
      { key: 'storeName', label: 'Store name', placeholder: 'Teajia Melbourne' },
      { key: 'city', label: 'City', placeholder: 'Melbourne' },
      { key: 'country', label: 'Country', placeholder: 'Australia' },
      { key: 'currency', label: 'Price currency', placeholder: 'AUD', hint: 'The currency customers expect to see on prices.' },
      { key: 'timezone', label: 'Local time zone', placeholder: 'Australia/Melbourne', hint: 'Used for event times and internal records.' },
      { key: 'launchDate', label: 'Target launch date', placeholder: '2026-06-01', type: 'date' },
    ],
  },
  {
    title: 'Store access',
    description: 'The people who can sign in and work inside the store account.',
    fields: [
      { key: 'ownerEmail', label: 'Store owner login email', placeholder: 'owner@example.com', type: 'email', hint: 'This person controls the store account and can invite others.' },
      { key: 'firstStaffEmail', label: 'First staff login email', placeholder: 'staff@example.com', type: 'email', hint: 'Optional. Add someone who helps with orders, stock, or events.' },
    ],
  },
  {
    title: 'Customer contact',
    description: 'How visitors get in touch when they want to ask about tea or place an order.',
    fields: [
      { key: 'publicContactName', label: 'Person customers hear from', placeholder: 'Store contact name', hint: 'Shown in your customer process, not used as a login.' },
      { key: 'publicContactEmail', label: 'Public customer email', placeholder: 'hello@example.com', type: 'email', hint: 'Use the email customers should write to.' },
      { key: 'publicWhatsapp', label: 'Public WhatsApp number', placeholder: '+614XXXXXXXX', hint: 'Use the number customers should message. Include the country code.' },
    ],
  },
  {
    title: 'Opening stock',
    description: 'The first items that will appear in the public store after they are added in admin.',
    fields: [
      { key: 'openingStockCount', label: 'How many items are ready to add?', placeholder: '12', hint: 'This is a planning count. The real products are added in admin inventory.' },
      { key: 'firstPublicTea', label: 'First item customers should see', placeholder: '2024 Alishan Oolong', hint: 'This should become a real inventory item with price, stock, and description.' },
      { key: 'firstEventName', label: 'First event, optional', placeholder: 'Opening tasting' },
    ],
  },
];

const setupSteps = [
  {
    id: 'profile',
    icon: Store,
    title: 'Create the store profile',
    publicCopy: 'Write the public name, location, customer contact, and short introduction first.',
    adminCopy: 'Save the name, description, country, currency, timezone, and public contact path.',
    adminHref: '/admin/account-settings#account-profile-form',
    publicHref: '/for-your-space#inquiry',
    action: 'Open profile setup',
    publicAction: 'Ask about opening a store',
  },
  {
    id: 'people',
    icon: Users,
    title: 'Set store access',
    publicCopy: 'Decide who can sign in as the owner and who else needs staff access.',
    adminCopy: 'Invite the owner and staff with presets so nobody starts with unclear permissions.',
    adminHref: '/admin/access',
    publicHref: '/signin',
    action: 'Invite people',
    publicAction: 'Sign in after invite',
  },
  {
    id: 'stock',
    icon: Package,
    title: 'Add opening stock',
    publicCopy: 'Prepare the first items customers can actually ask about or buy.',
    adminCopy: 'Import the first batch, then make at least one item public, priced, and in stock.',
    adminHref: '/admin/inventory',
    publicHref: '/store-launch-playbook#store-details',
    action: 'Add inventory',
    publicAction: 'Enter opening stock',
  },
  {
    id: 'storefront',
    icon: ClipboardCheck,
    title: 'Preview the storefront',
    publicCopy: 'The storefront should answer what is available, where this store is based, and how to ask for it.',
    adminCopy: 'Open the public page and test it as a first-time customer before sharing the link.',
    adminHref: null,
    publicHref: '/find-a-table',
    action: 'Open storefront',
    publicAction: 'See public stores',
  },
  {
    id: 'sale',
    icon: CheckCircle2,
    title: 'Rehearse the first sale',
    publicCopy: 'Make sure a real customer can ask, get the price, pay, and know what happens next.',
    adminCopy: 'Run one practice order so the operator knows where customer work appears.',
    adminHref: '/admin/activity?tab=orders',
    publicHref: '/store-launch-playbook#store-details',
    action: 'Practice order flow',
    publicAction: 'Plan first customer message',
  },
  {
    id: 'event',
    icon: CalendarDays,
    title: 'Prepare the first event',
    publicCopy: 'Optional for launch, but useful when a store will bring people into a room.',
    adminCopy: 'Create a tasting event, check RSVP flow, and confirm the public invitation reads clearly.',
    adminHref: '/admin/events',
    publicHref: '/events',
    action: 'Create event',
    publicAction: 'See event examples',
  },
] as const;

const primaryFields: Array<keyof Worksheet> = [
  'storeName',
  'country',
  'currency',
  'publicContactEmail',
  'openingStockCount',
  'firstPublicTea',
];

export const StoreLaunchPlaybook: React.FC<{
  mode: PlaybookMode;
  account?: Account | null;
  storefrontUrl?: string | null;
}> = ({ mode, account, storefrontUrl }) => {
  const [storeDetails, setStoreDetails] = useState<Worksheet>(() => ({ ...EMPTY_WORKSHEET, ...toWorksheetFromAccount(account) }));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setStoreDetails((current) => ({ ...current, ...JSON.parse(saved), ...toWorksheetFromAccount(account) }));
      }
    } catch {
      setStoreDetails((current) => ({ ...current, ...toWorksheetFromAccount(account) }));
    }
  }, [account]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storeDetails));
    } catch {
      /* Local persistence is optional. */
    }
  }, [storeDetails]);

  const completedFields = primaryFields.filter((field) => storeDetails[field].trim().length > 0).length;
  const completionLabel = `${completedFields} of ${primaryFields.length} launch basics entered`;
  const isAdmin = mode === 'admin';

  const effectiveStorefrontUrl = storefrontUrl || (account?.slug ? `${window.location.origin}/store/${account.slug}` : null);

  const steps = useMemo(() => (
    setupSteps.map((step) => ({
      ...step,
      href: step.id === 'storefront' && effectiveStorefrontUrl ? effectiveStorefrontUrl : isAdmin ? step.adminHref : step.publicHref,
      copy: isAdmin ? step.adminCopy : step.publicCopy,
      label: isAdmin ? step.action : step.publicAction,
      external: step.id === 'storefront' && Boolean(effectiveStorefrontUrl),
    }))
  ), [effectiveStorefrontUrl, isAdmin]);

  const launchBrief = useMemo(() => {
    const lines = [
      `Store: ${storeDetails.storeName || 'Not set'}`,
      `Location: ${[storeDetails.city, storeDetails.country].filter(Boolean).join(', ') || 'Not set'}`,
      `Currency: ${storeDetails.currency || 'Not set'}`,
      `Timezone: ${storeDetails.timezone || 'Not set'}`,
      `Owner email: ${storeDetails.ownerEmail || 'Not set'}`,
      `Customer contact name: ${storeDetails.publicContactName || 'Not set'}`,
      `Public contact: ${storeDetails.publicContactEmail || storeDetails.publicWhatsapp || 'Not set'}`,
      `Opening stock count: ${storeDetails.openingStockCount || 'Not set'}`,
      `First public item: ${storeDetails.firstPublicTea || 'Not set'}`,
      `First event: ${storeDetails.firstEventName || 'Optional or not set'}`,
      `Target launch: ${storeDetails.launchDate || 'Not set'}`,
    ];
    return lines.join('\n');
  }, [storeDetails]);

  const copyBrief = async () => {
    await navigator.clipboard.writeText(launchBrief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const updateField = (key: keyof Worksheet, value: string) => {
    setStoreDetails((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className={isAdmin ? 'h-full overflow-y-auto bg-tea-bg' : 'min-h-screen bg-tea-bg pb-nav-gap'}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <header className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
          <div className="min-w-0">
            <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-3`}>
              Store launch playbook
            </p>
            <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text max-w-3xl`}>
              Open a new Teajia store without guessing the steps.
            </h1>
            <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec mt-4 max-w-3xl`}>
              This page collects the details needed to open a store. Some fields help plan the launch; the real store profile, staff access, and inventory are saved inside admin after the store account exists.
            </p>
          </div>
          <div className="bg-tea-surface border border-tea-border rounded-md p-4">
            <p className="text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim mb-2">
              Progress
            </p>
            <p className="font-display text-ui-28 text-tea-text">{completedFields}/{primaryFields.length}</p>
            <p className="text-ui-12 text-tea-text-sec mt-1">{completionLabel}</p>
            {isAdmin && effectiveStorefrontUrl && (
              <a
                href={effectiveStorefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Open public storefront
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </header>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            ['1', 'Enter store details', 'Name, location, customer contact, opening stock, and the people who need access.'],
            ['2', 'Share the opening brief', 'Copy the summary or send the page to the person opening the store.'],
            ['3', 'Finish inside admin', 'After the invite is accepted, the admin page links to the real setup screens.'],
          ].map(([number, title, body]) => (
            <div key={number} className="bg-tea-surface border border-tea-border rounded-md p-4">
              <p className="font-mono text-ui-11 text-tea-text-dim mb-2">{number}</p>
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{title}</h2>
              <p className="text-ui-12 text-tea-text-sec leading-[1.5] mt-1">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          {steps.slice(0, 3).map((step, index) => (
            <PlaybookStep key={step.id} step={step} index={index} />
          ))}
        </section>

        <section id="store-details" className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="bg-tea-surface border border-tea-border rounded-md p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div>
                  <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Store opening details</h2>
                <p className="text-ui-13 text-tea-text-sec leading-[1.6] mt-2 max-w-2xl">
                  Enter the information a store needs before customers see it. Login access, customer contact, and inventory are separate on purpose.
                </p>
              </div>
              <button
                type="button"
                onClick={copyBrief}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-tea-border px-3 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
              >
                <Copy size={12} />
                {copied ? 'Copied' : 'Copy brief'}
              </button>
            </div>

            <div className="space-y-8">
              {fieldGroups.map((group) => (
                <fieldset key={group.title} className="space-y-4">
                  <div>
                    <legend className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{group.title}</legend>
                    <p className="text-ui-12 text-tea-text-sec leading-[1.5] mt-1">{group.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.fields.map((field) => (
                      <label key={field.key} className="block min-w-0">
                        <span className="block text-ui-11 uppercase tracking-[0.14em] text-tea-text-dim mb-1.5">
                          {field.label}
                        </span>
                        <input
                          type={field.type || 'text'}
                          value={storeDetails[field.key]}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-md border border-tea-border bg-tea-bg px-3 py-2.5 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:outline-none focus:ring-2 focus:ring-tea-gold/40"
                        />
                        {field.hint && (
                          <span className="mt-1.5 block text-ui-11 leading-[1.45] text-tea-text-sec">
                            {field.hint}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-tea-surface border border-tea-border rounded-md p-5">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>What must be true</h2>
              <div className="mt-4 space-y-3">
                {[
                  ['The public store has a name, country, currency, and customer contact path.', storeDetails.storeName && storeDetails.country && storeDetails.currency && (storeDetails.publicContactEmail || storeDetails.publicWhatsapp)],
                  ['At least one owner login email is known.', storeDetails.ownerEmail],
                  ['At least one launch item is ready to become a real product in admin.', storeDetails.openingStockCount && storeDetails.firstPublicTea],
                  ['The customer contact person and contact method are clear.', storeDetails.publicContactName && (storeDetails.publicContactEmail || storeDetails.publicWhatsapp)],
                  ['The first event is either planned or deliberately skipped.', storeDetails.firstEventName || !isAdmin],
                ].map(([label, done]) => (
                  <div key={label as string} className="flex items-start gap-2">
                    {done ? (
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-tea-gold" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 rounded-full border border-tea-border shrink-0" />
                    )}
                    <p className="text-ui-13 leading-[1.5] text-tea-text-sec">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-tea-surface border border-tea-border rounded-md p-5">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>
                {isAdmin ? 'Direct setup links' : 'Where each step happens'}
              </h2>
              <div className="mt-4 divide-y divide-tea-border border-y border-tea-border">
                {steps.map((step) => (
                  <ActionLink key={step.id} href={step.href} label={step.label} external={step.external} />
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {steps.slice(3).map((step, index) => (
            <PlaybookStep key={step.id} step={step} index={index + 3} />
          ))}
        </section>
      </div>
    </div>
  );
};

type SetupStep = (typeof setupSteps)[number];

type RenderStep = SetupStep & {
  href: string | null;
  copy: string;
  label: string;
  external: boolean;
};

const PlaybookStep: React.FC<{ step: RenderStep; index: number }> = ({ step, index }) => {
  const Icon = step.icon;
  return (
    <article className="bg-tea-surface border border-tea-border rounded-md p-5 flex flex-col min-w-0">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md border border-tea-border bg-tea-bg flex items-center justify-center shrink-0 text-tea-text-sec">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-ui-11 text-tea-text-dim">{String(index + 1).padStart(2, '0')}</p>
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mt-0.5`}>{step.title}</h2>
        </div>
      </div>
      <p className="text-ui-13 text-tea-text-sec leading-[1.6] mt-4 flex-1">{step.copy}</p>
      <ActionLink href={step.href} label={step.label} external={step.external} prominent />
    </article>
  );
};

const ActionLink: React.FC<{
  href: string | null;
  label: string;
  external?: boolean;
  prominent?: boolean;
}> = ({ href, label, external = false, prominent = false }) => {
  const className = prominent
    ? 'mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-tea-border px-3 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors'
    : 'flex items-center justify-between gap-3 py-3 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors';

  if (!href) {
    return (
      <span className={`${className} opacity-60`}>
        {label}
        <ArrowRight size={12} />
      </span>
    );
  }

  if (external || href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
        <ExternalLink size={12} />
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {label}
      <ArrowRight size={12} />
    </Link>
  );
};

export default StoreLaunchPlaybook;
