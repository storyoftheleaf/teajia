import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailConsentApi, type MyEmailConsent } from '../../lib/emailConsentApi';
import { ACCOUNT_EMAIL_HOSTS_HEADING, ACCOUNT_EMAIL_TEAJIA_LABEL, ORDER_EMAILS_LINE } from '../../lib/emailConsent';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { EmailConsentBox } from '../shared/EmailConsentBox';

// The account page's Email section: Teajia's letters, and host by host which
// hosts may write. Each tick is saved as it is made, with its time.

const KEY = ['account', 'email-consent'] as const;

export function EmailConsentSettings() {
  const queryClient = useQueryClient();
  const consent = useQuery({ queryKey: KEY, queryFn: emailConsentApi.get, retry: false });
  const saved = (next: MyEmailConsent) => queryClient.setQueryData(KEY, next);
  const teajia = useMutation({ mutationFn: emailConsentApi.setTeajia, onSuccess: saved });
  const host = useMutation({
    mutationFn: ({ hostUserId, allowed }: { hostUserId: string; allowed: boolean }) => emailConsentApi.setHost(hostUserId, allowed),
    onSuccess: saved,
  });
  const busy = teajia.isPending || host.isPending;
  const failed = teajia.isError || host.isError;

  return (
    <section aria-labelledby="email-heading" className="border border-tea-border rounded-md bg-tea-surface p-4 md:p-5" data-testid="email-consent-settings">
      <h2 id="email-heading" className={TYPOGRAPHY_CLASSES.h3}>Email</h2>
      {consent.isPending && <p role="status" className="mt-3 text-ui-12 text-tea-text-dim">Checking…</p>}
      {consent.isError && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-ui-12 text-tea-text-sec">
          <span>Could not load your email choices.</span>
          <button type="button" className="tap-target min-h-tap text-tea-gold" onClick={() => void consent.refetch()}>Try again</button>
        </div>
      )}
      {consent.data && (
        <div className="mt-2">
          <EmailConsentBox id="email-teajia" checked={consent.data.teajia.consent} disabled={busy}
            onChange={value => teajia.mutate(value)} label={ACCOUNT_EMAIL_TEAJIA_LABEL} />
          {consent.data.hosts.length > 0 && (
            <fieldset className="mt-3 border-t border-tea-border pt-3">
              <legend className="label-caps text-tea-text-sec">{ACCOUNT_EMAIL_HOSTS_HEADING}</legend>
              {consent.data.hosts.map(row => (
                <EmailConsentBox key={row.host_user_id} id={`email-host-${row.host_user_id}`} checked={row.allowed} disabled={busy}
                  onChange={allowed => host.mutate({ hostUserId: row.host_user_id, allowed })} label={row.name} />
              ))}
            </fieldset>
          )}
          <p className="mt-2 text-ui-13 text-tea-text-sec">{ORDER_EMAILS_LINE}</p>
          {failed && <p role="alert" className="mt-2 text-ui-12 text-tea-text">That did not save. Try again.</p>}
        </div>
      )}
    </section>
  );
}
