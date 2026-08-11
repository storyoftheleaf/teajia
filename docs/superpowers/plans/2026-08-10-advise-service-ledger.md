# Advice Service Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the existing `/advise` service section as an editorial ledger with subtle tonal section separation while preserving the page's writing, photograph, inquiry behavior, and locked bottom navigation.

**Architecture:** Keep the work inside the existing `AdvisePage` module and express the approved surfaces with existing Tailwind theme tokens. Add a focused Playwright contract for content preservation, hierarchy, responsive overflow, tonal separation, and the unchanged bottom navigation; do not add a new component system or alter routes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Framer Motion, React Router, Playwright

---

## File structure

- Modify `src/components/AdvisePage.tsx`: restructure the page bands, service ledger, session offering grid, contextual `/for-your-space` link, and floating inquiry positioning.
- Create `tests/advise-layout.spec.ts`: protect the approved content, hierarchy, responsive overflow, tonal separation, inquiry trigger, and locked bottom bar.
- Do not modify `src/components/BottomTabBar.tsx` or any navigation component.

### Task 1: Add the Advice layout contract

**Files:**
- Create: `tests/advise-layout.spec.ts`

- [ ] **Step 1: Write the failing Playwright coverage**

Create `tests/advise-layout.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const SERVICES = [
  ['design', 'Tea House Design & Curation', '$5,000 – $100,000+', 'From concept through opening. Design, curation, tea selection, training, and operations.'],
  ['sourcing', 'Tea Curation & Sourcing', 'By inquiry', 'Direct sourcing from Taiwan, China, and trusted origins, for collectors, spaces, and communities.'],
  ['sessions', 'Sessions & Guidance', 'From $50', 'In the Bali studio or wherever you are.'],
] as const;

const OFFERINGS = [
  ['Open Sit', 'Free', 'Share tea at the studio. Event based or appointment.'],
  ['Guided Practice Setup', '$265', '2+ hours. Leave fully equipped. Includes $100 teaware credit.'],
  ['Group Ceremonial', 'Inquire', 'Up to 24 across two tearooms.'],
  ['Private & Events', 'From $500', 'Your gathering, your venue or ours. Retreats, dinners, festivals, celebrations.'],
] as const;

async function openAdvise(page: Page, theme: 'dark' | 'light' = 'dark') {
  await page.addInitScript(selectedTheme => localStorage.setItem('teajia_theme', selectedTheme), theme);
  await page.goto('/advise', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Tea spaces, sourcing, guidance.' })).toBeVisible();
}

test('preserves the Advice writing and groups the full offer into one ledger', async ({ page }) => {
  await openAdvise(page);
  const ledger = page.getByTestId('advise-services');
  await expect(ledger.getByRole('article')).toHaveCount(3);

  for (const [id, title, price, description] of SERVICES) {
    const row = ledger.locator(`[data-service-id="${id}"]`);
    await expect(row.getByRole('heading', { name: title })).toBeVisible();
    await expect(row.getByText(price, { exact: true })).toBeVisible();
    await expect(row.getByText(description, { exact: true })).toBeVisible();
  }

  const design = ledger.locator('[data-service-id="design"]');
  await expect(design.getByRole('link', { name: /Hotels, studios, and teams/i })).toHaveAttribute('href', '/for-your-space');

  const sessions = ledger.locator('[data-service-id="sessions"]');
  for (const [name, price, description] of OFFERINGS) {
    const offering = sessions.locator(`[data-offering-name="${name}"]`);
    await expect(offering.getByRole('heading', { name })).toBeVisible();
    await expect(offering.getByText(price, { exact: true })).toBeVisible();
    await expect(offering.getByText(description, { exact: true })).toBeVisible();
  }
});

test('uses distinct theme-aware section surfaces in dark and light modes', async ({ page }) => {
  for (const theme of ['dark', 'light'] as const) {
    await openAdvise(page, theme);
    const colors = await page.getByTestId('advise-page').evaluate(root => {
      const read = (id: string) => {
        const element = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        return element ? getComputedStyle(element).backgroundColor : '';
      };
      return {
        hero: read('advise-hero'),
        services: read('advise-services-band'),
        testimonial: read('advise-testimonial-band'),
        closing: read('advise-closing-band'),
      };
    });
    expect(colors.services).not.toBe(colors.hero);
    expect(colors.services).not.toBe(colors.testimonial);
    expect(colors.closing).not.toBe(colors.testimonial);
  }
});

test('stays within mobile width and leaves the locked bottom bar unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdvise(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);

  const bottomBar = page.getByTestId('bottom-tab-bar');
  await expect(bottomBar).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Read' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Craft' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Advise' })).toHaveAttribute('aria-current', 'page');
  await expect(bottomBar.getByRole('button', { name: 'Shop' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Start a conversation', exact: true })).toHaveClass(/bottom-nav-gap/);
});

test('keeps the existing conversation action wired to the inquiry form', async ({ page }) => {
  await openAdvise(page);
  await page.getByRole('button', { name: /Every engagement begins with a conversation/i }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
});
```

- [ ] **Step 2: Run the contract and verify the expected failure**

Run `npx playwright test tests/advise-layout.spec.ts --project='Desktop Chrome' --reporter=list`.

Expected: FAIL because the ledger test ids, row attributes, and approved band structure do not exist yet.

### Task 2: Build the approved page composition

**Files:**
- Modify: `src/components/AdvisePage.tsx:1-13`
- Modify: `src/components/AdvisePage.tsx:131-237`
- Modify: `src/components/AdvisePage.tsx:244-352`
- Modify: `src/components/AdvisePage.tsx:420-470`

- [ ] **Step 1: Import shared typography presets**

Add:

```ts
import { TYPOGRAPHY_CLASSES } from '../designTokens';
```

- [ ] **Step 2: Recompose the main return into four bands**

Keep the existing `Helmet`, `PageHeader`, hero heading, photograph, biography, and inquiry button JSX verbatim. Replace their outer composition and the sections after them with:

```tsx
<div data-testid="advise-page" className="w-full animate-[fadeIn_0.6s_ease-out]">
  <Helmet>
    <title>Advise · Teajia</title>
    <meta name="description" content="Tea space design, sourcing guidance, ceremony training. Twenty years of practice distilled into services for those who take tea seriously." />
  </Helmet>
  <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />

  <div data-testid="advise-hero" className="bg-tea-bg">
    <div className="max-w-[1400px] mx-auto">
      <div
        ref={heroReveal.ref}
        className={`pt-14 md:pt-20 lg:pt-24 pb-10 md:pb-14 ${heroReveal.className}`}
        style={heroReveal.style}
      >
        <h2
          className="text-[2rem] md:text-[2.8rem] lg:text-[3.5rem] font-normal text-tea-text leading-[1.1] tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Tea spaces, sourcing,<br /> guidance.
        </h2>
      </div>

      <div
        ref={bioReveal.ref}
        className={`flex flex-col md:flex-row gap-10 md:gap-14 pb-24 md:pb-32 ${bioReveal.className}`}
        style={bioReveal.style}
      >
        <div className="relative shrink-0 w-full md:w-[340px]">
          <img
            src="https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_600/v1773837991/2021-06-27_IMG_7745_Original_ehkz30.jpg"
            alt=""
            width={600}
            height={750}
            className="w-full aspect-[3/2] md:aspect-[4/5] object-cover bg-tea-surface rounded-xl"
            loading="lazy"
          />
        </div>
        <div className="flex flex-col justify-center max-w-[460px]">
          <p
            className="text-[1.05rem] md:text-[1.15rem] font-normal text-tea-text leading-[1.4] tracking-[-0.005em] mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Twenty years in tea culture.<br className="hidden md:block" />
            Taiwan, China, Japan, Bali, and beyond.
          </p>
          <p className="text-ui-14 text-tea-text-sec leading-[1.85] mb-4" style={{ fontFamily: 'var(--font-body)' }}>
            We work with individuals deepening their personal tea practice, with collectors seeking rare and aged teas, and with retreat centers, hotels, and private residences ready to bring tea culture into their spaces. For larger projects, that means everything from room design and teaware curation to tea sourcing and staff training.
          </p>
          <p className="text-ui-14 text-tea-text-sec leading-[1.85]" style={{ fontFamily: 'var(--font-body)' }}>
            A background in design and visual art shapes every detail. Two decades of sourcing relationships across Asia ground every recommendation. An international practice rooted in Bali.
          </p>
          <button
            onClick={() => openInquiry('')}
            className="text-ui-11 uppercase tracking-[0.1em] text-tea-gold hover:text-tea-gold/70 font-medium transition-colors duration-300 text-left mt-8 min-h-[44px]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Every engagement begins with a conversation <span className="ml-1">&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div data-testid="advise-services-band" className="-mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10 bg-tea-surface/40 border-y border-tea-border">
    <div ref={servicesReveal.ref} className={`max-w-[1400px] mx-auto ${servicesReveal.className}`} style={servicesReveal.style}>
      <Services />
    </div>
  </div>

  <div data-testid="advise-testimonial-band" className="bg-tea-bg">
    <div className="max-w-[1400px] mx-auto"><Testimonial /></div>
  </div>

  <div data-testid="advise-closing-band" className="-mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10 bg-tea-surface/20 border-t border-tea-border">
    <div className="max-w-[1400px] mx-auto"><ClosingCTA onOpenInquiry={() => openInquiry('')} /></div>
  </div>

  <FloatingInquiryCTA onOpenInquiry={() => openInquiry('')} />
  <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
</div>
```

Delete the detached B2B link and standalone `divider-warm` elements. The B2B route moves into the first service row, while the band boundaries provide the separators.

- [ ] **Step 3: Replace `Services` with the editorial ledger**

Use this complete replacement:

```tsx
const Services: React.FC = () => (
  <section data-testid="advise-services" aria-labelledby="advise-services-title" className="py-16 md:py-20 lg:py-24">
    <p id="advise-services-title" className={`${TYPOGRAPHY_CLASSES.label} mb-5 text-tea-text-dim`}>Services</p>
    <div className="border-y border-tea-border">
      {SERVICES.map((svc, index) => {
        const isDesign = svc.id === 'design';
        return (
          <motion.article
            key={svc.id}
            data-service-id={svc.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 border-b border-tea-border py-9 last:border-b-0 md:grid-cols-[2.25rem_minmax(13rem,0.82fr)_minmax(18rem,1.18fr)] md:gap-x-8 md:py-12 lg:gap-x-14"
          >
            <span className={`${TYPOGRAPHY_CLASSES.label} pt-1 text-tea-gold`}>{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <h3 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{svc.label}</h3>
              <span className={`${TYPOGRAPHY_CLASSES.mono} mt-3 block uppercase tracking-[0.1em] text-tea-gold/70 tabular-nums`}>{svc.price}</span>
            </div>
            <div className="col-start-2 mt-5 min-w-0 md:col-start-3 md:mt-0">
              <p className="font-body text-ui-14 leading-[1.8] text-tea-text-sec">{svc.desc}</p>
              {isDesign && (
                <Link to="/for-your-space" className="tap-target group mt-5 inline-flex min-h-[44px] items-center gap-2 font-sans text-ui-12 uppercase tracking-[0.1em] text-tea-text-sec transition-colors duration-200 hover:text-tea-text">
                  <span>Hotels, studios, and teams</span>
                  <span className="text-tea-gold/60 transition-colors duration-200 group-hover:text-tea-gold">&rarr;</span>
                </Link>
              )}
              {'offerings' in svc && svc.offerings && (
                <div className="mt-7 grid grid-cols-1 border-t border-tea-border min-[520px]:grid-cols-2">
                  {svc.offerings.map((offering, offeringIndex) => (
                    <div key={offering.name} data-offering-name={offering.name} className={`border-b border-tea-border py-5 min-[520px]:px-5 ${offeringIndex % 2 === 0 ? 'min-[520px]:border-r min-[520px]:pl-0' : 'min-[520px]:pr-0'}`}>
                      <div className="flex items-baseline justify-between gap-4">
                        <h4 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{offering.name}</h4>
                        <span className={`${TYPOGRAPHY_CLASSES.mono} shrink-0 uppercase tracking-[0.1em] text-tea-gold/70 tabular-nums`}>{offering.price}</span>
                      </div>
                      <p className="mt-2 font-sans text-ui-12 leading-relaxed text-tea-text-sec">{offering.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.article>
        );
      })}
    </div>
  </section>
);
```

- [ ] **Step 4: Align testimonial, closing, and floating action spacing**

Set `Testimonial`'s motion section class to `py-20 text-center md:py-28 lg:py-32`. Set `ClosingCTA`'s motion section class to `pb-32 pt-16 text-center md:pb-40 md:pt-24`. Keep their content unchanged.

In `FloatingInquiryCTA`, replace `right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]` with `right-5 bottom-nav-gap`. Do not edit `src/components/BottomTabBar.tsx`.

- [ ] **Step 5: Run focused static verification**

Run `npm run lint` and expect exit 0.

Run `npm run lint:colors` and expect exit 0 with no new Advice-page violations.

### Task 3: Verify responsive behavior and interactions

**Files:**
- Test: `tests/advise-layout.spec.ts`
- Verify: `src/components/AdvisePage.tsx`

- [ ] **Step 1: Run the focused contract on desktop and mobile**

Run `npx playwright test tests/advise-layout.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list`.

Expected: 8 tests pass.

- [ ] **Step 2: Re-run existing inquiry delivery coverage**

Run `npx playwright test tests/inquiry-delivery.spec.ts --project='Desktop Chrome' --reporter=list`.

Expected: all three tests pass.

- [ ] **Step 3: Run the required mobile audit**

Run `npm run test:mobile`.

Expected: the audit passes with no JavaScript errors or horizontal overflow.

- [ ] **Step 4: Inspect the actual page in both themes**

Open `http://localhost:7777/advise` at 390×844 and at a desktop width of at least 1280px. In dark and light themes, confirm the original photograph and copy remain, the three surface tones are restrained and distinct, the session layout responds correctly, the inquiry triggers still work, and the bottom bar is visually and behaviorally unchanged.

- [ ] **Step 5: Review and commit only Advice-scoped files**

Run `git diff -- src/components/AdvisePage.tsx tests/advise-layout.spec.ts` and inspect the complete task diff.

Run `git status --short` and confirm unrelated work remains unstaged.

Stage only `src/components/AdvisePage.tsx` and `tests/advise-layout.spec.ts`.

Commit with message `feat: refine advice service presentation`.

Expected: the commit contains exactly those two files. `src/components/BottomTabBar.tsx` must not appear in the diff or commit.
