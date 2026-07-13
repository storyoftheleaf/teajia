import React, { useState } from 'react';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import { useScrollLock } from '../../hooks/useScrollLock';
import { CONTACT_UNAVAILABLE, resolveContactChannels } from '../../lib/contact';
import { useAppStore } from '../../lib/store';

interface ProductInquiryProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  phone?: string;
  email?: string;
}

type InquiryChannel = 'choose' | 'email';

const INPUT_CLASS = 'w-full bg-tea-surface border border-tea-border p-3 text-tea-text text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold rounded-md';

export const ProductInquiry: React.FC<ProductInquiryProps> = ({ isOpen, onClose, productName, phone, email }) => {
  useScrollLock(isOpen);
  const activeAccount = useAppStore(s => s.activeAccount);
  const contact = resolveContactChannels({
    whatsappNumber: phone || activeAccount?.whatsapp_number,
    email: email || activeAccount?.contact_email,
    subject: `Inquiry about ${productName}`,
    message: `Hi, I'd like to inquire about: ${productName}`,
  });

  const [channel, setChannel] = useState<InquiryChannel>('choose');
  const [form, setForm] = useState({
    name: '',
    email: '',
    message: `I'm interested in ${productName}`,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const handoff = resolveContactChannels({
      email: email || activeAccount?.contact_email,
      subject: `Inquiry about ${productName}`,
      message: `Name: ${form.name}\nReply to: ${form.email}\n\n${form.message}`,
    }).email;
    if (handoff) window.location.href = handoff.href;
  };

  const handleWhatsApp = () => {
    const message = `Hi, I'd like to inquire about: ${productName}\n\nPlease let me know about availability and details. Thank you!`;
    if (contact.whatsapp) window.open(contact.whatsapp.href, '_blank');
    handleClose();
  };

  const handleClose = () => {
    setChannel('choose');
    setForm({ name: '', email: '', message: `I'm interested in ${productName}` });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-modal bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed z-modal inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md bg-tea-bg rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <h3 className="font-serif text-xl text-tea-text">
            {`Interested in ${productName}?`}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-md hover:bg-tea-text/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Icons.Close className="w-5 h-5 text-tea-text" />
          </button>
        </div>

        <div className="p-6 pt-4">
          {channel === 'choose' ? (
            /* Channel selection */
            <div className="space-y-3">
              <p className="text-sm text-tea-text-sec mb-4">
                How would you like to reach us?
              </p>

              {/* WhatsApp — primary */}
              {contact.whatsapp && <button
                onClick={handleWhatsApp}
                className="w-full flex items-center gap-4 p-4 rounded-md border border-tea-border hover:border-tea-gold/50 hover:bg-tea-gold/5 transition-all duration-200 group min-h-[56px]"
              >
                <Icons.Message className="w-5 h-5 text-tea-green shrink-0" />
                <div className="text-left flex-1">
                  <span className="text-sm font-medium text-tea-text block">WhatsApp</span>
                  <span className="text-xs text-tea-text-sec">Quick and direct — chat with us now</span>
                </div>
                <span className="text-tea-text/30 group-hover:text-tea-gold group-hover:translate-x-0.5 transition-all">&rarr;</span>
              </button>}

              {/* Email form — secondary */}
              {contact.email && <button
                onClick={() => setChannel('email')}
                className="w-full flex items-center gap-4 p-4 rounded-md border border-tea-border hover:border-tea-gold/50 hover:bg-tea-gold/5 transition-all duration-200 group min-h-[56px]"
              >
                <Icons.Mail className="w-5 h-5 text-tea-gold shrink-0" />
                <div className="text-left flex-1">
                  <span className="text-sm font-medium text-tea-text block">Send a Message</span>
                  <span className="text-xs text-tea-text-sec">Leave your details and we'll follow up</span>
                </div>
                <span className="text-tea-text/30 group-hover:text-tea-gold group-hover:translate-x-0.5 transition-all">&rarr;</span>
              </button>}
              {contact.unavailable && <p className="py-6 text-center text-sm text-tea-text-sec">{CONTACT_UNAVAILABLE}</p>}
            </div>
          ) : (
            /* Email form */
            <div className="space-y-4">
              <button
                onClick={() => setChannel('choose')}
                className="text-xs text-tea-text-sec hover:text-tea-text flex items-center gap-1 mb-2 transition-colors"
              >
                <Icons.Back className="w-3 h-3" /> Back to options
              </button>
              <div>
                <label className="block text-xs uppercase tracking-wider text-tea-text-sec mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="your name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                {errors.name && <p className="text-tea-error text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-tea-text-sec mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  className={INPUT_CLASS}
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
                {errors.email && <p className="text-tea-error text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-tea-text-sec mb-1.5">
                  Message
                </label>
                <textarea
                  className={`${INPUT_CLASS} resize-none h-24`}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>

              <Button
                variant="primary"
                fullWidth
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.email.trim()}
              >
                Send Inquiry
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
