import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Check } from 'lucide-react';

type Step = 'code' | 'identity';

const CODE_LENGTH = 6;
const TOTAL_STEPS = 2;

function CodeCells({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: () => void;
  disabled?: boolean;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (idx: number, digit: string) => {
    const cleaned = digit.replace(/\D/g, '');
    if (!cleaned) return;
    const chars = value.padEnd(CODE_LENGTH, ' ').split('');
    chars[idx] = cleaned[0];
    const next = chars.join('').replace(/\s+$/g, '');
    onChange(next.slice(0, CODE_LENGTH));
    if (idx < CODE_LENGTH - 1) inputs.current[idx + 1]?.focus();
    if (next.length === CODE_LENGTH) onComplete();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        const chars = value.split('');
        chars[idx] = '';
        onChange(chars.join(''));
      } else if (idx > 0) {
        inputs.current[idx - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < CODE_LENGTH - 1) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    if (pasted.length === CODE_LENGTH) {
      inputs.current[CODE_LENGTH - 1]?.blur();
      onComplete();
    } else {
      inputs.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-3" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-10 h-12 text-center text-ui-28 bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none text-tea-text font-display font-normal tracking-[0.05em] caret-tea-gold disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function JoinPage() {
  const navigate = useNavigate();
  const { code: codeFromUrl } = useParams<{ code?: string }>();
  const { redeemJoinCode } = useAuth();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState((codeFromUrl ?? '').replace(/\D/g, '').slice(0, CODE_LENGTH));
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codeFromUrl && codeFromUrl.length === CODE_LENGTH && /^\d+$/.test(codeFromUrl)) {
      setStep('identity');
    }
  }, [codeFromUrl]);

  const goToIdentity = () => {
    if (code.length !== CODE_LENGTH) return;
    setError(null);
    setStep('identity');
  };

  const submit = async () => {
    setError(null);
    if (!firstName.trim()) { setError('First name required'); return; }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) { setError('Enter a valid email'); return; }

    setSubmitting(true);
    try {
      const result = await redeemJoinCode({ code, first_name: firstName.trim(), email: cleanEmail });
      setSessionId(result.session_id);
      setConfirmed(true);
    } catch (err: any) {
      setError(err?.message || 'Could not join. Check the code and try again.');
      setSubmitting(false);
    }
  };

  const emailPreview = (() => {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) return null;
    const [, domain] = trimmed.split('@');
    if (!domain || !domain.includes('.')) return 'Double-check the domain';
    return null;
  })();

  const currentStepNumber = step === 'code' ? 1 : 2;

  // Confirmation state
  if (confirmed && sessionId) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
            <Check size={28} className="text-tea-gold" />
          </div>
          <h1 className="h2">You're in</h1>
          <p className="subtitle mt-2">Welcome to the tasting, {firstName.trim()}.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/session/${sessionId}`, { replace: true })}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
        >
          Enter the Tasting
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap w-full">
      <p className="text-center label-caps text-tea-text-dim mb-8">
        Step {currentStepNumber} of {TOTAL_STEPS} · Tasting
      </p>

      {step === 'code' && (
        <div>
          <div className="text-center mb-10">
            <h1 className="h2">Enter your code</h1>
            <p className="subtitle mt-2">Six digits from your host.</p>
          </div>

          <CodeCells
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(null); }}
            onComplete={() => { /* user advances manually with Continue */ }}
          />

          {error && (
            <p className="mt-6 text-center text-ui-13 text-tea-error">{error}</p>
          )}

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              disabled={code.length !== CODE_LENGTH}
              onClick={goToIdentity}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'identity' && (
        <div>
          <div className="text-center mb-8">
            <h1 className="h2">Your name</h1>
            <p className="subtitle mt-2">
              Code <span className="text-tea-text not-italic">{code}</span>
            </p>
          </div>

          <div className="space-y-6">
            <label className="block">
              <span className="block label-caps text-tea-text-sec mb-1.5">First name</span>
              <input
                autoFocus
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none py-2 text-tea-text text-ui-17"
              />
            </label>

            <label className="block">
              <span className="block label-caps text-tea-text-sec mb-1.5">Email</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none py-2 text-tea-text text-ui-17 lowercase"
              />
              {emailPreview && (
                <span className="mt-2 block text-ui-12 text-tea-text-dim">{emailPreview}</span>
              )}
            </label>

            <p className="text-ui-12 text-tea-text-dim">
              We will save your notes to this email so you can come back to them later.
            </p>
          </div>

          {error && (
            <p className="mt-6 text-center text-ui-13 text-tea-error">{error}</p>
          )}

          <div className="mt-10 flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('code')}
              className="px-3 py-2 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || !firstName.trim() || !email.includes('@')}
              onClick={submit}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Joining…' : 'Join the Tasting'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="mt-8 mx-auto block link-text hover:opacity-80 transition-opacity"
          >
            Already on Teajia? Sign in
          </button>
        </div>
      )}
    </div>
  );
}
