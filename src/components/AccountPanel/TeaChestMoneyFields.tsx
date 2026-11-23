import { enteredNumber } from '../../admin/productUpdatePayload';
import { personalTeaCurrencies, readPersonalTeaMoney } from '../../lib/personalTeaMoney';

export interface MoneyFieldsValue {
  amount: string;
  currency: string;
}

export const emptyMoneyFields: MoneyFieldsValue = { amount: '', currency: '' };

interface TeaChestMoneyFieldsProps {
  label: string;
  value: MoneyFieldsValue;
  onChange: (value: MoneyFieldsValue) => void;
  fieldClass: string;
  required?: boolean;
  positive?: boolean;
}

export function TeaChestMoneyFields({ label, value, onChange, fieldClass, required, positive }: TeaChestMoneyFieldsProps) {
  const money = readPersonalTeaMoney(enteredNumber(value.amount), value.currency);
  const invalid = Boolean(value.amount && value.currency && (!money || (positive && money.amount === 0)));
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block min-w-0 space-y-1 text-ui-13 text-tea-text-sec">
        <span>{label}</span>
        <input type="number" inputMode="decimal" min={0} step="any" required={required} aria-invalid={invalid || undefined}
          className={fieldClass} value={value.amount} onChange={event => onChange({ ...value, amount: event.target.value })} />
      </label>
      <label className="block min-w-0 space-y-1 text-ui-13 text-tea-text-sec">
        <span>Currency</span>
        <select required={required} className={fieldClass} value={value.currency}
          onChange={event => onChange({ ...value, currency: event.target.value })}>
          <option value="">Select currency</option>
          {personalTeaCurrencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
        </select>
      </label>
      {invalid && <p className="col-span-2 text-ui-12 text-tea-text-sec">
        {positive && money?.amount === 0 ? 'Enter a sale price greater than zero.' : 'Check the amount and decimal places for this currency.'}
      </p>}
    </div>
  );
}
