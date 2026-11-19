import { expect, test, type BrowserContext } from './fixtures';

// This acceptance fixture uses the disposable seeded D1 sandbox described in DELIVERY.
test.skip(process.env.TEAJIA_SESSION_POLICY_FIXTURES !== '1', 'Requires the isolated Sessions D1 fixture');
test('approved Sessions and member policy through real local Worker and D1', async ({ browser, request, baseURL }, info) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const origin = new URL(baseURL!).origin;
  const contexts: BrowserContext[] = [];
  const login = async (identifier: string) => {
    const response = await request.post('/api/auth/login', { data: { identifier, password: 'sandbox' } });
    expect(response.ok()).toBe(true);
    const result = await response.json();
    if (result.active_account_id !== 'acc_teajia_bali') {
      const switched = await request.post('/api/accounts/switch', {
        headers: { Authorization: 'Bearer ' + result.token }, data: { account_id: 'acc_teajia_bali' },
      });
      expect(switched.ok()).toBe(true);
      return (await switched.json()).token as string;
    }
    return result.token as string;
  };
  const hostToken = await login('sandbox');
  const memberToken = await login('member');
  const peerToken = await login('peer');
  const open = async (token?: string) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    contexts.push(context);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    if (token) await context.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
    return context.newPage();
  };
  const headers = (token: string) => ({ Authorization: 'Bearer ' + token, 'X-Teajia-Account': 'acc_teajia_bali' });
  try {
    const host = await open(hostToken);
    await host.goto('/admin/events/policy-event?tab=post-session');
    await host.getByRole('button', { name: 'Finish session', exact: true }).click();
    await host.getByRole('dialog').getByRole('button', { name: 'Finish session', exact: true }).click();
    await expect(host.getByText('Session finished', { exact: true })).toBeVisible();
    await host.reload();
    await expect(host.getByRole('button', { name: 'Finish session', exact: true })).toHaveCount(0);
    const recapText = host.getByPlaceholder('Notes about the session, observations, highlights...');
    await expect(recapText).toHaveValue('Original host draft');
    await recapText.fill('Chosen attendee recap');
    await host.getByRole('button', { name: 'Share recap with attendees', exact: true }).click();
    const dialog = host.getByRole('dialog', { name: 'Share recap with attendees?' });
    await expect(dialog.getByText('Chosen attendee recap', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Private host observation')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Share recap', exact: true }).click();
    await expect(host.getByText('Recap shared with attendees')).toBeVisible();
    await recapText.fill('Unshared replacement draft');
    const savedDraft = host.waitForResponse(response => response.url().endsWith('/post-session') && response.request().method() === 'POST');
    await host.getByRole('button', { name: 'Save Post-Session', exact: true }).click();
    expect((await savedDraft).ok()).toBe(true);

    const member = await open(memberToken);
    await member.goto('/m/policy-attendee-token');
    await expect(member.getByText('Chosen attendee recap', { exact: true }).first()).toBeVisible();
    await expect(member.getByText('Unshared replacement draft')).toHaveCount(0);
    const reflection = member.getByRole('region', { name: 'Private reflection' });
    await reflection.getByRole('textbox').fill('Only my private reflection');
    await expect(reflection.getByRole('textbox')).toHaveValue('Only my private reflection');
    const privateWrite = member.waitForRequest(req => req.url().endsWith('/reflection') && req.method() === 'PUT');
    await reflection.getByRole('button', { name: 'Save reflection', exact: true }).click();
    expect((await privateWrite).postDataJSON()).toEqual({ reflection: 'Only my private reflection' });
    await expect(reflection.getByRole('status')).toHaveText('Private reflection saved');
    await member.screenshot({ path: info.outputPath('private-reflection.png'), animations: 'disabled', scale: 'css' });
    await member.reload();
    await expect(member.getByRole('region', { name: 'Private reflection' }).getByRole('textbox')).toHaveValue('Only my private reflection');
    await member.getByRole('link', { name: 'My session archive' }).click();
    const archive = member.getByRole('region', { name: 'Private session archive' });
    await expect(archive.getByText('Only my private reflection', { exact: true })).toBeVisible();
    await archive.getByRole('button', { name: 'Edit reflection' }).click();
    await archive.getByRole('textbox').fill('Revised in my private archive');
    await archive.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(archive.getByText('Revised in my private archive', { exact: true })).toBeVisible();
    const freshMember = await open(memberToken);
    await freshMember.goto('/account/journey');
    await expect(freshMember.getByRole('region', { name: 'Private session archive' }).getByText('Revised in my private archive')).toBeVisible();

    const hostPrivate = await request.get('/api/rsvp/policy-attendee-token/reflection', { headers: headers(hostToken) });
    expect(hostPrivate.status()).toBe(404);
    const peerPrivate = await request.get('/api/rsvp/policy-attendee-token/reflection', { headers: headers(peerToken) });
    expect(peerPrivate.status()).toBe(404);
    expect((await request.get('/api/rsvp/policy-attendee-token/reflection')).status()).toBe(401);
    expect((await request.get('/api/events/policy-evening/recap')).status()).toBe(404);
    expect((await request.get('/api/rsvp/policy-no-show-token/post-session')).status()).toBe(403);
    const legacy = await request.get('/api/events/policy-legacy/recap');
    expect(legacy.ok()).toBe(true);
    expect(await legacy.json()).toMatchObject({ post_session: { session_notes: 'Legacy published recap' } });

    const visitor = await open();
    await visitor.goto('/share/policy-invite');
    await expect(visitor.getByRole('link', { name: 'Sign in to save', exact: true })).toHaveAttribute('href', /returnTo=%2Fshare%2Fpolicy-invite/);
    await member.goto('/share/policy-invite');
    await member.getByRole('button', { name: 'Save card', exact: true }).click();
    await member.getByRole('button', { name: 'Open saved card', exact: true }).click();
    await expect(member).toHaveURL(/\/account\/collection\?card=claim_/);
    const received = member.getByRole('region', { name: 'Received cards' });
    await expect(received.getByRole('heading', { name: 'Shared tea reference', exact: true })).toBeVisible();
    const cardUrl = member.url();
    await member.screenshot({ path: info.outputPath('received-card.png'), animations: 'disabled', scale: 'css' });
    await member.reload();
    await expect(received.getByRole('heading', { name: 'Shared tea reference', exact: true })).toBeVisible();
    await freshMember.goto('/share/policy-invite');
    await freshMember.getByRole('button', { name: 'Save card', exact: true }).click();
    await freshMember.getByRole('button', { name: 'Open saved card', exact: true }).click();
    await expect(freshMember).toHaveURL(cardUrl);
    await freshMember.getByRole('button', { name: 'Back to cards' }).click();
    await expect(freshMember.getByRole('region', { name: 'Received cards' }).getByRole('button', { name: /Shared tea reference/ })).toBeVisible();
    const peer = await open(peerToken);
    await peer.goto(cardUrl);
    await expect(peer.getByText('This saved card is unavailable in this account.')).toBeVisible();
    await expect(peer.getByRole('region', { name: 'Received cards' }).getByRole('heading', { name: 'Shared tea reference' })).toHaveCount(0);

    const alternate = await request.post('/api/accounts/switch', { headers: headers(memberToken), data: { account_id: 'acc_teajia_australia' } });
    expect(alternate.ok()).toBe(true);
    const otherTable = await open((await alternate.json()).token);
    await otherTable.goto(cardUrl);
    await expect(otherTable.getByText('This saved card is unavailable in this account.')).toBeVisible();

    await host.goto('/admin/tasting-events/new?eventId=policy-event');
    await expect(host.getByRole('combobox', { name: 'RSVP event (optional)' })).toHaveValue('policy-event');
    await host.getByRole('button', { name: 'Fixture Oolong Oolong', exact: true }).click();
    await host.getByRole('button', { name: 'Create group tasting', exact: true }).click();
    await expect(host.getByText('RSVP event · Fixture Tea Evening')).toBeVisible();
    const sessionId = new URL(host.url()).pathname.split('/').pop()!;
    const invite = await request.post(`/api/sessions/${sessionId}/join`, { headers: headers(memberToken), data: {} });
    expect(invite.ok()).toBe(true);
    const sessionState = await request.get(`/api/sessions/${sessionId}`, { headers: headers(memberToken) });
    const teaId = (await sessionState.json()).teas[0].id;
    const verdict = await request.post(`/api/sessions/${sessionId}/teas/${teaId}/verdict`, {
      headers: headers(memberToken), data: { verdict: 'like', notes: 'Private tasting prose', tasting_data: { quality: 8, notes: [{ text: 'Private tasting prose' }] } },
    });
    expect(verdict.ok()).toBe(true);
    const live = await request.get(`/api/sessions/${sessionId}/host-live`, { headers: headers(hostToken) });
    const liveBody = await live.json();
    expect(JSON.stringify(liveBody)).not.toContain('Private tasting prose');
    expect(liveBody.verdicts[0].tasting_data.quality).toBe(8);
    await host.goto(`/admin/tasting-events/${sessionId}/live`);
    await expect(host.getByText('8', { exact: true })).toBeVisible();
    await expect(host.getByText('Private tasting prose')).toHaveCount(0);
    await host.getByRole('button', { name: 'Complete tasting', exact: true }).click();
    await host.getByRole('dialog').getByRole('button', { name: 'End session', exact: true }).click();
    await expect(host.getByText('Completed', { exact: true })).toBeVisible();
    await freshMember.goto('/session/' + sessionId);
    await expect(freshMember.getByText(/Fixture Oolong/).first()).toBeVisible();
    expect(await freshMember.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
