import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./NotificationPanel.tsx', import.meta.url), 'utf8');

function containingButton(label: string): string {
  const labelIndex = source.indexOf(label);
  if (labelIndex < 0) throw new Error(`Missing NotificationPanel control: ${label}`);
  const buttonIndex = source.lastIndexOf('<button', labelIndex);
  return source.slice(buttonIndex, labelIndex);
}

describe('NotificationPanel compact controls', () => {
  it.each([
    'Copy All Pending',
    'Generate Reminders',
    "copiedId === notif.id ? 'Copied' : 'Copy'",
  ])('gives %s a mandatory tap target', label => {
    expect(containingButton(label)).toContain('tap-target');
  });
});
