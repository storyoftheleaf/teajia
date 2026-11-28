// The one box for email about tea: on sign-up, and each line of the account
// page's Email section. Words come from src/lib/emailConsent.ts.

export function EmailConsentBox({ id, checked, onChange, label, disabled = false }: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-h-tap cursor-pointer items-start gap-3 py-2 font-body text-ui-14 text-tea-text">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0"
        style={{ accentColor: 'rgb(var(--tea-gold-rgb))' }}
      />
      <span>{label}</span>
    </label>
  );
}
