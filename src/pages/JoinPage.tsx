import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Step = 'code' | 'identity';

const CODE_LENGTH = 6;

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
          className="w-10 h-12 text-center text-ui-28 bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none text-tea-text font-display font-light tracking-[0.05em] caret-tea-gold disabled:opacity-50"
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
      navigate(`/session/${result.session_id}`, { replace: true });
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

  return (
    <div className="min-h-dvh bg-tea-bg text-tea-text flex flex-col px-6 pt-14 pb-12">
      <div className="text-center text-ui-11 tracking-[0.18em] uppercase text-tea-text-sec">
        Tasting · Tea Jia
      </div>

      {step === 'code' && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <h1 className="font-display font-light text-[36px] leading-tight text-center mb-12">
            Enter your code
          </h1>

          <CodeCells
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(null); }}
            onComplete={() => { /* user advances manually with Continue */ }}
          />

          {error && (
            <p className="mt-6 text-center text-ui-13 text-red-400">{error}</p>
          )}

          <div className="mt-12 flex justify-center">
            <button
              type="button"
              disabled={code.length !== CODE_LENGTH}
              onClick={goToIdentity}
              className="text-tea-gold-lt hover:text-tea-gold disabled:opacity-30 text-ui-15 tracking-wide transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 'identity' && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <h1 className="font-display font-light text-[36px] leading-tight text-center mb-2">
            Your name
          </h1>
          <p className="text-center text-ui-13 text-tea-text-sec mb-10">
            Code <span className="text-tea-text">{code}</span>
          </p>

          <label className="block mb-8">
            <span className="block text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-2">
              First name
            </span>
            <input
              autoFocus
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none py-2 text-tea-text text-ui-17"
            />
          </label>

          <label className="block mb-3">
            <span className="block text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-2">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none py-2 text-tea-text text-ui-17 lowercase"
            />
            {emailPreview && (
              <span className="mt-2 block text-ui-12 text-tea-text-sec">{emailPreview}</span>
            )}
          </label>

          <p className="text-ui-12 text-tea-text-sec mb-10">
            We will save your notes to this email so you can come back to them later.
          </p>

          {error && (
            <p className="mb-4 text-center text-ui-13 text-red-400">{error}</p>
          )}

          <button
            type="button"
            disabled={submitting || !firstName.trim() || !email.includes('@')}
            onClick={submit}
            className="w-full rounded-full bg-tea-gold text-tea-bg py-3 text-ui-15 tracking-wide disabled:opacity-40 transition-opacity"
          >
            {submitting ? 'Joining…' : 'Join the tasting →'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="mt-6 mx-auto block text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Already on Teajia? Sign in
          </button>

          <button
            type="button"
            onClick={() => setStep('code')}
            className="mt-3 mx-auto block text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
