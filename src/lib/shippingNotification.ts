export interface ShippingPaymentNotification {
  state: 'not_requested' | 'pending' | 'sending' | 'accepted' | 'retry_scheduled' | 'config_required' | 'review_required' | 'suppressed' | 'needs_contact';
  channel: 'email' | 'whatsapp' | null;
  code?: string;
  accepted_at?: string | null;
}

/** Operational delivery status, never a claim that the customer read a message. */
export function shippingNotificationMessage(notification: ShippingPaymentNotification | null): string | null {
  if (!notification || notification.state === 'not_requested') return null;
  const channel = notification.channel === 'whatsapp' ? 'WhatsApp' : notification.channel === 'email' ? 'email' : null;
  switch (notification.state) {
    case 'pending': return `Shipping payment request queued${channel ? ` for ${channel}` : ''}.`;
    case 'sending': return `Sending the shipping payment request${channel ? ` by ${channel}` : ''}.`;
    case 'accepted': return `Shipping payment request sent${channel ? ` by ${channel}` : ''}.`;
    case 'retry_scheduled': return 'Shipping saved. The payment request is waiting to retry automatically.';
    case 'needs_contact': return 'Shipping saved. The customer needs an email address or an agreed WhatsApp number before the payment request can be sent.';
    case 'review_required': return 'Shipping saved. The payment request needs review; check its send status before sending another message.';
    case 'config_required':
      if (notification.code === 'whatsapp_template_pending') return 'Shipping saved. WhatsApp approval is pending; this request will send automatically after approval.';
      if (notification.code === 'secure_link_unavailable') return 'Shipping saved. The private payment link is unavailable, so the request has not been sent.';
      return `Shipping saved. ${channel === 'WhatsApp' ? 'WhatsApp sending' : 'Automatic sending'} is not ready, so the payment request has not been sent.`;
    case 'suppressed': return 'No shipping payment request is needed for this order.';
  }
}
