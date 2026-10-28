import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/** Shares the drawer's dismissable-layer and focus stack, including when a
 * review opens from inside Tea details. A separate body portal/focus trap
 * would become inert behind the drawer. */
export function TeaReviewDialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-modal flex min-h-0 flex-col bg-tea-bg text-tea-text outline-none" onInteractOutside={event => event.preventDefault()}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
