// People, the platform users list (review U1-5, U1-6): the two things the owner does most
// with a person's hosting sit on the person's own row, so letting someone host by link is
// one tap (their reach starts as "by their link only", the safest, and can be widened in
// the Hosting panel) and stopping all their hosting is two (the tap and its confirm).
export type HostingRowAction = 'let-host' | 'stop-all' | 'let-again';

export function hostingRowActions(
  user: { may_host?: boolean; hosting_stopped_at?: string | null },
  open: { stoppingOpen: boolean },
): HostingRowAction[] {
  const actions: HostingRowAction[] = [];
  if (!user.may_host) actions.push('let-host');
  if (open.stoppingOpen) actions.push(user.hosting_stopped_at ? 'let-again' : 'stop-all');
  return actions;
}
