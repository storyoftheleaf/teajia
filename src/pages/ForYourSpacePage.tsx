import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '';

/* ── Use cases ─────────────────────────────────────── */
const USE_CASES = [
  {
    id: 'events',
    label: 'Private Events & Ceremonies',
    desc: 'A tea ceremony for a dinner, retreat, or gathering. We bring the tea, the setup, and the knowledge — you bring your people.',
  },
  {
    id: 'supply',
    label: 'Ongoing Supply & Integration',
    desc: 'A curated tea selection for your hotel, studio, or restaurant — sourced well, presented thoughtfully, with guidance on how to serve it.',
  },
  {
    id: 'team',
    label: 'Team & Cultural Experiences',
    desc: 'A session that slows things down and brings people together. Works for offsites, team days, and cultural programming.',
  },
] as const;

/* ── What to expect bullets ─────────────────────────── */
const PROCESS_STEPS = [
  "Initial conversation — you tell us what you're building, we listen",
  'A curated tea selection matched to your space and guests',
  'Basics on preparation, service, and how to talk about the tea',
  'Ongoing support if you want it — re-orders, seasonal updates, questions',
];

/* ── Inquiry types ───────────────────────────────────── */
const INQUIRY_TYPES = [
  { value: 'Private Event', label: 'Private Event' },
  { value: 'Ongoing Supply', label: 'Ongoing Supply' },
  { value: 'Team Experience', label: 'Team Experience' },
  { value: 'Other', label: 'Other' },
] as const;

type InquiryType = typeof INQUIRY_TYPES[number]['value'];
type ContactMethod = 'email' | 'whatsapp';

interface FormState {
  name: string;
  organization: string;
  inquiryType: InquiryType | '';
  description: string;
  contactMethod: ContactMethod;
  contactValue: string;
}

/* ── Floating label input ────────────────────────────── */
interface FloatingFieldProps {
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea';
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  error?: string;
}

const FloatingField: React.FC<FloatingFieldProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  required,
  autoComplete,
  error,
}) => {
  const [focused, setFocused] = useState(false);
  const isActive = focused || value.length > 0;

  const baseClass = `
    w-full bg-transparent border-0 border-b font-sans text-base pt-5 pb-2 px-0
    outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1
    focus-visible:ring-offset-tea-bg transition-colors duration-200 text-tea-text
    ${focused ? 'border-tea-gold' : 'border-tea-border'}
  `;

  return (
    <div className="relative mb-7">
      <label
        className={`absolute left-0 font-sans pointer-events-none transition-all duration-200 ${
          isActive ? 'top-0 text-ui-11 tracking-wide text-tea-gold' : 'top-5 text-base text-tea-text/40'
        }`}
      >
        {label}
        {required && <span className="ml-0.5 text-tea-gold">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          className={baseClass}
          style={{ resize: 'vertical', minHeight: '6rem' }}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          aria-label={label}
          autoComplete={autoComplete}
        />
      ) : (
        <input
          type={type}
          className={baseClass}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          aria-label={label}
          autoComplete={autoComplete}
        />
      )}
      {error && <p className="text-tea-error text-xs mt-1">{error}</p>}
    </div>
  );
};

/* ── Main page component ─────────────────────────────── */
export const ForYourSpacePage: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    name: '',
    organization: '',
    inquiryType: '',
    description: '',
    contactMethod: 'email',
    contactValue: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof FormState) => (v: string) =>
    setForm(prev => ({ ...prev, [field]: v }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.organization.trim()) e.organization = 'Organization is required';
    if (!form.inquiryType) e.inquiryType = 'Please choose a type';
    if (!form.description.trim()) e.description = 'A brief description helps us respond better';
    if (!form.contactValue.trim()) e.contactValue = form.contactMethod === 'email' ? 'Email is required' : 'WhatsApp number is required';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    // Build a pre-filled WhatsApp message
    const lines = [
      `*Business Inquiry — Teajia*`,
      ``,
      `*Name:* ${form.name}`,
      `*Organization:* ${form.organization}`,
      `*Type:* ${form.inquiryType}`,
      `*Description:* ${form.description}`,
    ];
    if (form.contactMethod === 'email') {
      lines.push(`*Contact email:* ${form.contactValue}`);
    } else {
      lines.push(`*WhatsApp:* ${form.contactValue}`);
    }
    const message = lines.join('\n');
    const url = buildWhatsAppUrl(WHATSAPP_NUMBER, message);
    window.open(url, '_blank');
    setSubmitted(true);
  };

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <Helmet>
        <title>For Your Space — Teajia</title>
        <meta
          name="description"
          content="Bring tea to your hotel, studio, or team. Events, ongoing supply, and cultural experiences — curated and guided."
        />
      </Helmet>

      {/* Back nav */}
      <div className="pt-6 pb-2">
        <button
          onClick={() => navigate('/advise')}
          className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors duration-200 min-h-[44px]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <Icons.ChevronLeft className="w-4 h-4" />
          <span className="text-ui-13">Advise</span>
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto">

        {/* ── Hero ── */}
        <div className="pt-10 md:pt-14 pb-14 md:pb-20 max-w-[640px]">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2.2rem] md:text-[3rem] lg:text-[3.5rem] font-light text-tea-text leading-[1.1] tracking-[-0.02em] mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Bring tea to your space.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-ui-15 text-tea-text-sec leading-[1.9]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            For boutique hotels, yoga studios, retreat centers, and teams who want something more considered than a kettle in the corner. We work with the space, not against it.
          </motion.p>
        </div>

        {/* ── Use cases ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="pb-20 md:pb-28"
        >
          <div className="flex flex-col gap-0 max-w-[560px]">
            {USE_CASES.map((uc, i) => (
              <React.Fragment key={uc.id}>
                {i > 0 && <div className="h-px bg-tea-border/20" />}
                <div className="py-10">
                  <h3
                    className="text-[1.15rem] md:text-[1.3rem] font-light text-tea-text mb-3 tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {uc.label}
                  </h3>
                  <p
                    className="text-ui-14 text-tea-text/75 leading-[1.85]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {uc.desc}
                  </p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </motion.section>

        {/* ── Divider ── */}
        <div className="divider-warm my-4 md:my-8" />

        {/* ── What to expect ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="py-20 md:py-28 max-w-[560px]"
        >
          <p
            className="text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-8"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            What to expect
          </p>
          <ul className="space-y-5">
            {PROCESS_STEPS.map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span
                  className="shrink-0 text-ui-10 uppercase tracking-[0.12em] text-tea-gold/60 pt-[3px]"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="text-ui-14 text-tea-text-sec leading-[1.85]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {step}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* ── Divider ── */}
        <div className="divider-warm my-4 md:my-8" />

        {/* ── Store operator playbook ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="py-16 md:py-20 max-w-[640px]"
        >
          <p
            className="text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-5"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Becoming a store
          </p>
          <h2
            className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-4`}
          >
            Work through the launch playbook before your account is opened.
          </h2>
          <p
            className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec mb-7`}
          >
            The playbook shows the exact fields, people, stock, storefront checks, and first-sale rehearsal every new store needs. Once your account exists, the same path appears inside admin with links to save each part.
          </p>
          <Link
            to="/store-launch-playbook"
            className="inline-flex min-h-[44px] items-center gap-2 border border-tea-border px-4 py-2 text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text transition-colors"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Open store launch playbook
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </motion.section>

        {/* ── Divider ── */}
        <div className="divider-warm my-4 md:my-8" />

        {/* ── Inquiry form ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="py-20 md:py-28 max-w-[480px]"
          id="inquiry"
        >
          {submitted ? (
            <div className="animate-[fadeIn_0.5s_ease-out]">
              <p
                className="font-serif text-xl text-tea-text mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Opening WhatsApp…
              </p>
              <p
                className="text-ui-13 text-tea-text-sec leading-[1.8] mb-8"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Your message has been composed. Send it to start the conversation. If WhatsApp didn't open, you can reach us at{' '}
                <a
                  href="mailto:hello@teajia.com"
                  className="text-tea-gold hover:text-tea-gold/70 transition-colors"
                >
                  hello@teajia.com
                </a>
                .
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-ui-11 uppercase tracking-[0.1em] text-tea-text-sec hover:text-tea-text transition-colors duration-200 min-h-[44px]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Edit inquiry
              </button>
            </div>
          ) : (
            <>
              <p
                className="font-serif text-lg text-tea-text mb-10"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Tell us what you're building.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <FloatingField
                  label="Your name"
                  value={form.name}
                  onChange={set('name')}
                  required
                  autoComplete="name"
                  error={errors.name}
                />
                <FloatingField
                  label="Organization or venue"
                  value={form.organization}
                  onChange={set('organization')}
                  required
                  autoComplete="organization"
                  error={errors.organization}
                />

                {/* Type of inquiry — select */}
                <div className="relative mb-7">
                  <label
                    className={`block font-sans text-ui-11 uppercase tracking-[0.12em] mb-2 ${
                      form.inquiryType ? 'text-tea-gold' : 'text-tea-text/40'
                    }`}
                  >
                    Type of inquiry<span className="ml-0.5 text-tea-gold">*</span>
                  </label>
                  <select
                    value={form.inquiryType}
                    onChange={e => set('inquiryType')(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-tea-border font-sans text-base pb-2 px-0
                               outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1
                               focus-visible:ring-offset-tea-bg transition-colors duration-200 text-tea-text
                               appearance-none cursor-pointer"
                    aria-label="Type of inquiry"
                    required
                  >
                    <option value="" disabled className="bg-tea-bg text-tea-text-sec">
                      Choose one…
                    </option>
                    {INQUIRY_TYPES.map(t => (
                      <option key={t.value} value={t.value} className="bg-tea-bg text-tea-text">
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <Icons.ChevronDown className="absolute right-0 bottom-3 w-4 h-4 text-tea-text-sec pointer-events-none" />
                  {errors.inquiryType && (
                    <p className="text-tea-error text-xs mt-1">{errors.inquiryType}</p>
                  )}
                </div>

                <FloatingField
                  label="Brief description — a few sentences is plenty"
                  type="textarea"
                  value={form.description}
                  onChange={set('description')}
                  required
                  error={errors.description}
                />

                {/* Contact method */}
                <div className="mb-7">
                  <p
                    className="font-sans text-ui-11 uppercase tracking-[0.12em] text-tea-text/40 mb-4"
                  >
                    How should we reach you?
                  </p>
                  <div className="flex gap-3 mb-5">
                    {(['email', 'whatsapp'] as ContactMethod[]).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          set('contactMethod')(method);
                          set('contactValue')('');
                        }}
                        className={`flex-1 py-2.5 px-4 text-ui-11 uppercase tracking-[0.1em] border transition-all duration-200 min-h-[44px]
                          ${form.contactMethod === method
                            ? 'border-tea-gold bg-tea-gold/8 text-tea-gold'
                            : 'border-tea-border text-tea-text-sec hover:border-tea-gold/40'
                          }`}
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        {method === 'email' ? 'Email' : 'WhatsApp'}
                      </button>
                    ))}
                  </div>
                  <FloatingField
                    label={form.contactMethod === 'email' ? 'your@email.com' : 'WhatsApp number'}
                    type={form.contactMethod === 'email' ? 'email' : 'tel'}
                    value={form.contactValue}
                    onChange={set('contactValue')}
                    required
                    autoComplete={form.contactMethod === 'email' ? 'email' : 'tel'}
                    error={errors.contactValue}
                  />
                </div>

                <div className="mt-8">
                  <button
                    type="submit"
                    className="w-full bg-tea-gold text-tea-bg text-ui-11 uppercase tracking-[0.15em] font-medium
                               py-3 px-6 hover:bg-tea-gold/90 transition-colors duration-300
                               active:scale-[0.98] min-h-[44px]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    Send via WhatsApp <span className="ml-1">&rarr;</span>
                  </button>
                </div>

                <p
                  className="text-ui-11 text-tea-text-sec mt-4 text-center leading-relaxed"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  This opens a pre-filled WhatsApp message. No account needed.
                </p>
              </form>
            </>
          )}
        </motion.section>

      </div>

      {/* Mobile bottom nav clearance */}
      <div className="h-[calc(1rem+64px+env(safe-area-inset-bottom,0px))] lg:h-8" />
    </div>
  );
};

export default ForYourSpacePage;
