import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ShopTeaCredit } from '../../lib/hostCreditApi';
import { Button } from '../../components/shared/Button';
import { HostLines, type DecisionNotice, type SpendChoice } from './TeaCreditSection';

// A8-10 (todo/review/findings/A8.md): from a host's detail, the owner decides a
// waiting use of credit in two clicks, Approve and then Approve anyway when it
// is over the shop's ceiling, without going back to the list.

const host = {
  account_id: 'shop', shop_name: 'Teajia', currency: 'USD', pending: 0, earned: 10, reversed: 0, spent: 0,
  held: 8, debt: 0, available: 2, host_user_id: 'host', host_name: 'Rayi',
};
const data: ShopTeaCredit = {
  terms: { percent: 10, ceilingUsd: 5 },
  hosts: [host],
  lines: [],
  second_look: [],
  spend_requests: [
    { id: 'ask', host_user_id: 'host', host_name: 'Rayi', invoice_id: 'inv', invoice_number: 'A8-1', amount: 8, currency: 'USD', status: 'held', requested_at: '2026-11-25T10:00:00Z', decided_at: null, over_ceiling: false },
    { id: 'old', host_user_id: 'host', host_name: 'Rayi', invoice_id: 'inv0', invoice_number: 'A8-0', amount: 3, currency: 'USD', status: 'approved', requested_at: '2026-11-20T10:00:00Z', decided_at: '2026-11-21T10:00:00Z', over_ceiling: false },
  ],
};

/** Expands the detail's own hook-free parts down to its Buttons, so a click can be pressed. */
function buttons(node: React.ReactNode): Array<{ label: string; onClick: () => void }> {
  const found: Array<{ label: string; onClick: () => void }> = [];
  const walk = (value: React.ReactNode): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!React.isValidElement(value)) return;
    const element = value as React.ReactElement<Record<string, any>>;
    if (element.type === Button) {
      found.push({ label: React.Children.toArray(element.props.children).join(''), onClick: element.props.onClick });
      return;
    }
    if (typeof element.type === 'function') { walk((element.type as (props: unknown) => React.ReactNode)(element.props)); return; }
    walk(element.props.children);
  };
  walk(node);
  return found;
}

function detail(notice: DecisionNotice, onDecide: (choice: SpendChoice) => void) {
  return <HostLines data={data} host={host} onBack={() => {}} notice={notice} busy={false} onDecide={onDecide} />;
}

describe("a host's detail in Sales", () => {
  it('puts Decline and Approve beside a waiting use of credit, and only that one', () => {
    const html = renderToStaticMarkup(detail(null, () => {}));
    expect(html).toContain('Order A8-1');
    expect(html).toContain('>Decline<');
    expect(html).toContain('>Approve<');
    expect(buttons(detail(null, () => {})).map(button => button.label)).toEqual(['Back', 'Decline', 'Approve']);
  });

  it('approves an over-ceiling request in two clicks, keeping the confirmation', () => {
    const choices: SpendChoice[] = [];
    let notice: DecisionNotice = null;
    // The worker's answer to each choice: over the ceiling until confirmed.
    const answer = (choice: SpendChoice) => {
      choices.push(choice);
      notice = choice.confirm ? null : { id: choice.id, text: 'More than the ceiling. Approve again to confirm it.', confirm: true };
    };
    const press = (label: string) => {
      const button = buttons(detail(notice, answer)).find(candidate => candidate.label === label);
      expect(button, label).toBeTruthy();
      button!.onClick();
    };
    press('Approve');
    expect(renderToStaticMarkup(detail(notice, answer))).toContain('More than the ceiling');
    press('Approve anyway');
    expect(choices).toEqual([{ id: 'ask', approve: true, confirm: false }, { id: 'ask', approve: true, confirm: true }]);
  });

  it('declines from the detail in one click', () => {
    const choices: SpendChoice[] = [];
    buttons(detail(null, choice => choices.push(choice))).find(button => button.label === 'Decline')!.onClick();
    expect(choices).toEqual([{ id: 'ask', approve: false }]);
  });
});
