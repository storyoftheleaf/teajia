export interface VerificationEmailEnv {
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
}

export type VerificationDeliveryResult =
  | { delivered: true; providerMessageId: string }
  | { delivered: false; retryable: boolean; reason: 'provider_not_configured' | 'provider_unavailable' | 'provider_rejected' };

export async function deliverVerificationCode(
  env: VerificationEmailEnv,
  input: { email: string; code: string; purpose: 'signin' | 'event' },
  fetcher: typeof fetch = fetch,
): Promise<VerificationDeliveryResult> {
  if (!env.RESEND_API_KEY || !env.SENDER_EMAIL) {
    console.error('[verification] email provider is not configured');
    return { delivered: false, retryable: false, reason: 'provider_not_configured' };
  }

  let response: Response;
  try {
    response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.SENDER_NAME || 'Teajia'} <${env.SENDER_EMAIL}>`,
        to: [input.email],
        subject: input.purpose === 'signin' ? 'Your Teajia sign-in code' : 'Your Teajia verification code',
        html: `<p>Your Teajia code is <strong>${input.code}</strong>.</p><p>It expires in 10 minutes.</p>`,
      }),
    });
  } catch {
    console.error('[verification] email delivery failed due to a network error');
    return { delivered: false, retryable: true, reason: 'provider_unavailable' };
  }

  if (!response.ok) {
    console.error(`[verification] email delivery failed status=${response.status}`);
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    return { delivered: false, retryable, reason: retryable ? 'provider_unavailable' : 'provider_rejected' };
  }

  try {
    const body = await response.json() as { id?: unknown };
    if (typeof body.id !== 'string' || body.id.trim().length === 0) {
      console.error('[verification] email provider returned an invalid response');
      return { delivered: false, retryable: true, reason: 'provider_unavailable' };
    }
    return { delivered: true, providerMessageId: body.id };
  } catch {
    console.error('[verification] email provider returned an invalid response');
    return { delivered: false, retryable: true, reason: 'provider_unavailable' };
  }
}
