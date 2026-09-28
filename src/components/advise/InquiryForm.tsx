import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import { INQUIRY_OPTIONS, InquiryFormData } from '../../types/advise';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { fetchWithTimeout, getApiOrigin } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  SERVICE_GUIDANCE, buildInquiryVision, guidanceAdvice, restoreGuidanceAnswers, serviceForInterest,
  type GuidanceAnswers, type ServiceKey,
} from './serviceGuidance';

interface InquiryFormProps {
  isOpen: boolean;
  onClose: () => void;
  preselect?: string;
}

function emptyInquiry(preselect?: string): InquiryFormData {
  return {
    name: '',
    email: '',
    location: '',
    whatsapp: '',
    interests: preselect ? [preselect] : [],
    vision: '',
    referral: '',
  };
}

export function restoreInquiryDraft(value: unknown, preselect?: string): InquiryFormData {
  const fallback = emptyInquiry(preselect);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const draft = value as Record<string, unknown>;
  const scalar = (field: keyof Omit<InquiryFormData, 'interests'>): string =>
    typeof draft[field] === 'string' ? draft[field] : (fallback[field] ?? '');
  return {
    name: scalar('name'),
    email: scalar('email'),
    location: scalar('location'),
    whatsapp: scalar('whatsapp'),
    vision: scalar('vision'),
    referral: scalar('referral'),
    interests: (() => {
      const saved = Array.isArray(draft.interests) && draft.interests.every(item => typeof item === 'string')
        ? draft.interests as string[] : [];
      if (!preselect) return saved;
      const selectedService = serviceForInterest(preselect);
      return [preselect, ...saved.filter(item => item !== preselect && (!selectedService || serviceForInterest(item) === selectedService || serviceForInterest(item) === null))];
    })(),
  };
}

export function inquiryMailto(data: InquiryFormData): string {
  const details = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.whatsapp ? `WhatsApp: ${data.whatsapp}` : '',
    data.location ? `Location: ${data.location}` : '',
    data.interests.length ? `Interests: ${data.interests.join(', ')}` : '',
    data.referral ? `Referral: ${data.referral}` : '',
  ].filter(Boolean);
  const body = [...details, '', data.vision].join('\n');
  return `mailto:hello@teajia.com?subject=${encodeURIComponent(`Tea inquiry from ${data.name}`)}&body=${encodeURIComponent(body)}`;
}

export const InquiryForm: React.FC<InquiryFormProps> = ({ isOpen, onClose, preselect }) => {
  const [formData, setFormData] = useState<InquiryFormData>(() => emptyInquiry(preselect));
  const [service, setService] = useState<ServiceKey | null>(() => serviceForInterest(preselect));
  const [guidanceAnswers, setGuidanceAnswers] = useState<GuidanceAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [deliveryError, setDeliveryError] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  // Store trigger element to restore focus on close (#14)
  const triggerRef = useRef<HTMLElement | null>(null);

  // Drag-to-dismiss state (mobile bottom sheet)
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchStartY = useRef(0);
  const isDraggingSheet = useRef(false);

  useScrollLock(isOpen);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset and animate in when opened
  useEffect(() => {
    if (isOpen) {
      // Save trigger element for focus restoration (#14)
      triggerRef.current = document.activeElement as HTMLElement;
      setSubmitted(false);
      setDeliveryError(false);
      setDraftSaved(false);
      try {
        const restored = JSON.parse(localStorage.getItem('teajia_inquiry_draft') || 'null');
        const draft = restored && typeof restored === 'object' && !Array.isArray(restored) ? restored as Record<string, unknown> : null;
        const restoredForm = restoreInquiryDraft(restored, preselect);
        const savedService = typeof draft?.guidanceService === 'string' && draft.guidanceService in SERVICE_GUIDANCE
          ? draft.guidanceService as ServiceKey : null;
        const chosenService = serviceForInterest(preselect) ?? savedService
          ?? restoredForm.interests.map(interest => serviceForInterest(interest)).find(Boolean) ?? null;
        setFormData(restoredForm);
        setService(chosenService);
        setGuidanceAnswers(draft?.guidanceService === chosenService ? restoreGuidanceAnswers(draft.guidanceAnswers, chosenService) : {});
      } catch {
        setFormData(emptyInquiry(preselect));
        setService(serviceForInterest(preselect));
        setGuidanceAnswers({});
      }
      setSheetDragY(0);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      // Restore focus to trigger (#14)
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [isOpen, preselect]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  // Drag-to-dismiss handlers (mobile)
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.sheet-drag-handle')) {
      isDraggingSheet.current = true;
      sheetTouchStartY.current = e.touches[0].clientY;
    }
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingSheet.current) return;
    const diff = e.touches[0].clientY - sheetTouchStartY.current;
    if (diff > 0) {
      setSheetDragY(diff);
    }
  };

  const handleSheetTouchEnd = () => {
    if (!isDraggingSheet.current) return;
    isDraggingSheet.current = false;
    if (sheetDragY > 100) {
      handleClose();
    }
    setSheetDragY(0);
  };

  const toggleInterest = (option: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(option)
        ? prev.interests.filter(i => i !== option)
        : [...prev.interests, option],
    }));
  };

  const chooseService = (next: ServiceKey) => {
    if (next === service) return;
    setService(next);
    setGuidanceAnswers({});
    setFormData(prev => ({
      ...prev,
      interests: [SERVICE_GUIDANCE[next].interest, ...prev.interests.filter(item => serviceForInterest(item) === null)],
    }));
  };

  const [optionalOpen, setOptionalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveToLocalStorage = (entry: InquiryFormData & { timestamp: string; guidanceService: ServiceKey | null; guidanceAnswers: GuidanceAnswers }): boolean => {
    try {
      localStorage.setItem('teajia_inquiry_draft', JSON.stringify(entry));
      return true;
    } catch (err) {
      console.error('[InquiryForm] Failed to save locally:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    const vision = buildInquiryVision(service, guidanceAnswers, formData.vision);
    if (!vision) newErrors.vision = 'Choose a service or add a short note';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setDeliveryError(false);
    setSubmitting(true);

    const entry = { ...formData, timestamp: new Date().toISOString(), guidanceService: service, guidanceAnswers };
    const payload = {
      source: 'consult',
      name: formData.name,
      email: formData.email,
      whatsapp: formData.whatsapp,
      location: formData.location,
      vision,
      interests: formData.interests,
      referral: formData.referral,
    };

    // Keep an offline draft, but only show success after confirmed API delivery.
    const apiUrl = getApiOrigin();
    try {
      if (!apiUrl) throw new Error('API origin is not configured');
      const res = await fetchWithTimeout(`${apiUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      setSubmitted(true);
      try { localStorage.removeItem('teajia_inquiry_draft'); } catch { /* delivery still succeeded */ }
      setTimeout(handleClose, 1500);
    } catch (err) {
      console.warn('[InquiryForm] API submission failed, saving draft locally:', err);
      setDraftSaved(saveToLocalStorage(entry));
      setDeliveryError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const reducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className={`fixed inset-0 z-modal flex items-end md:items-center md:justify-center transition-colors ${reducedMotion ? '' : 'duration-300'} ${isVisible ? 'bg-tea-text/40' : 'bg-tea-text/0'}`}
    >
      <div
        ref={focusTrapRef}
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        className={`
          w-full md:max-w-[620px] md:rounded-xl rounded-t-xl
          max-h-[90vh] md:max-h-[85vh] overflow-y-auto overscroll-contain
          bg-tea-bg
          transition-all ${reducedMotion ? '' : 'duration-250 ease-out'}
          ${isVisible
            ? 'translate-y-0 md:translate-y-0 opacity-100 md:scale-100'
            : 'translate-y-full md:translate-y-0 opacity-0 md:scale-95'
          }
        `}
        style={{ transform: isVisible ? `translateY(${sheetDragY}px)` : undefined }}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden sheet-drag-handle flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-tea-border rounded-full" />
        </div>

        {/* Close button */}
        <div className="sticky top-0 z-10 flex justify-end p-4 pb-0 bg-tea-bg">
          <button
            onClick={handleClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-tea-surface transition-colors"
            aria-label="Close inquiry form"
          >
            <Icons.Close className="w-5 h-5 text-tea-text-sec" />
          </button>
        </div>

        <div className="px-6 sm:px-8 md:px-10 pb-nav-gap-lg">
          {submitted ? (
            <div className="flex items-center justify-center min-h-[200px] animate-[fadeIn_0.4s_ease-out]">
              <p className="font-serif text-xl text-center text-tea-text">
                Thank you. I'll be in touch soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="animate-[fadeIn_0.3s_ease-out]">
              <h2 className={`${TYPOGRAPHY_CLASSES.h2} mb-2 text-tea-text`}>Find a place to begin.</h2>
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mb-7 text-tea-text-sec`}>A few choices help us make the first conversation useful. “Not sure yet” is a good answer.</p>

              <fieldset className="mb-8">
                <legend className={`${TYPOGRAPHY_CLASSES.label} mb-3 text-tea-text-dim`}>What brings you here?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(SERVICE_GUIDANCE) as ServiceKey[]).map(key => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={service === key}
                      onClick={() => chooseService(key)}
                      className={`min-h-[52px] rounded-md border px-3 py-3 text-left text-ui-14 leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold ${service === key ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border bg-tea-surface text-tea-text-sec hover:bg-tea-accent-sub'}`}
                    >
                      {SERVICE_GUIDANCE[key].title}
                    </button>
                  ))}
                </div>
              </fieldset>

              {service && (
                <section className="mb-8" aria-label={`${SERVICE_GUIDANCE[service].title} guidance`}>
                  <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mb-6 text-tea-text-sec`}>{SERVICE_GUIDANCE[service].intro}</p>
                  {SERVICE_GUIDANCE[service].questions.map(question => (
                    <fieldset key={question.id} className="mb-6">
                      <legend className={`${TYPOGRAPHY_CLASSES.label} mb-3 text-tea-text-dim`}>{question.prompt}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {question.options.map(option => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={guidanceAnswers[question.id] === option}
                            onClick={() => setGuidanceAnswers(prev => ({ ...prev, [question.id]: option }))}
                            className={`min-h-[44px] rounded-md border px-3 py-2 text-left text-ui-14 leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold ${guidanceAnswers[question.id] === option ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:bg-tea-accent-sub'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <div className="rounded-md border border-tea-border bg-tea-accent-sub px-4 py-4" aria-live="polite">
                    <p className={`${TYPOGRAPHY_CLASSES.label} mb-2 text-tea-text-dim`}>A useful starting point</p>
                    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>{guidanceAdvice(service, guidanceAnswers)}</p>
                  </div>
                </section>
              )}

              <FloatingField
                label="Anything else you want Adrian to know? (optional)"
                type="textarea"
                value={formData.vision}
                onChange={v => setFormData(p => ({ ...p, vision: v }))}
                autoComplete="off"
                error={errors.vision}
              />

              <h3 className={`${TYPOGRAPHY_CLASSES.h3} mb-2 mt-9 text-tea-text`}>How can Adrian reach you?</h3>
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mb-7 text-tea-text-sec`}>Your answers will travel with your message. A name and email are enough to continue.</p>

              {/* Required fields */}
              <FloatingField
                label="Your name"
                type="text"
                value={formData.name}
                onChange={v => setFormData(p => ({ ...p, name: v }))}
                required
                autoComplete="name"
                error={errors.name}
              />

              <FloatingField
                label="your@email.com"
                type="email"
                value={formData.email}
                onChange={v => setFormData(p => ({ ...p, email: v }))}
                required
                autoComplete="email"
                error={errors.email}
              />

              {/* Collapsible optional section */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setOptionalOpen(prev => !prev)}
                  className="flex items-center gap-2 text-sm text-tea-text-sec hover:text-tea-gold transition-colors duration-200 py-2"
                  aria-expanded={optionalOpen}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${optionalOpen ? 'rotate-180' : ''}`} />
                  <span className="font-sans">Tell us more (optional)</span>
                </button>

                {optionalOpen && (
                  <div className="mt-4 animate-[fadeIn_0.2s_ease-out]">
                    <FloatingField
                      label="WhatsApp number (for Bali-based conversations)"
                      type="text"
                      value={formData.whatsapp}
                      onChange={v => setFormData(p => ({ ...p, whatsapp: v }))}
                      autoComplete="tel"
                    />

                    <FloatingField
                      label="City or country"
                      type="text"
                      value={formData.location}
                      onChange={v => setFormData(p => ({ ...p, location: v }))}
                      autoComplete="address-level2"
                    />

                    {/* Interests checkboxes */}
                    <fieldset className="mb-6">
                      <legend className="font-sans text-sm mb-4 text-tea-text-sec">
                        What brings you here?
                      </legend>
                      <div className="space-y-4">
                        {INQUIRY_OPTIONS.map(option => (
                          <label
                            key={option}
                            className="flex items-center gap-3 cursor-pointer group min-h-[44px]"
                          >
                            <span
                              className={`
                                w-[18px] h-[18px] rounded-md border flex-shrink-0 flex items-center justify-center
                                transition-colors duration-200
                                ${formData.interests.includes(option)
                                  ? 'border-transparent bg-tea-gold'
                                  : 'border-tea-border'
                                }
                              `}
                            >
                              {formData.interests.includes(option) && (
                                <Icons.Check className="w-3 h-3 text-tea-bg" />
                              )}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={formData.interests.includes(option)}
                              onChange={() => toggleInterest(option)}
                            />
                            <span className="font-sans text-sm text-tea-text">
                              {option}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <FloatingField
                      label="How did you hear about us? (friend, article, Instagram…)"
                      type="text"
                      value={formData.referral}
                      onChange={v => setFormData(p => ({ ...p, referral: v }))}
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>

              <div className="mt-8">
                {deliveryError && (
                  <div role="alert" className="mb-4 text-ui-14 leading-relaxed text-tea-text-sec">
                    Your message was not delivered. {draftSaved ? 'Your draft is saved on this device; ' : 'This browser could not save your draft; '}retry below or{' '}
                    <a className="text-tea-text underline underline-offset-4 hover:text-tea-gold" href={inquiryMailto({ ...formData, vision: buildInquiryVision(service, guidanceAnswers, formData.vision) })}>
                      email hello@teajia.com
                    </a>.
                  </div>
                )}
                <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
                  {deliveryError ? 'Retry' : 'Send'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* Floating label input component */
interface FloatingFieldProps {
  label: string;
  type: 'text' | 'email' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  error?: string;
}

const FloatingField: React.FC<FloatingFieldProps> = ({ label, type, value, onChange, required, autoComplete, error }) => {
  const [focused, setFocused] = useState(false);
  const isActive = focused || value.length > 0;

  const sharedClass = `
    w-full bg-transparent border-0 border-b font-sans text-base pt-5 pb-2 px-0
    outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors duration-200
    text-tea-text
    ${focused ? 'border-tea-gold' : 'border-tea-border'}
  `;

  return (
    <div className="relative mb-6">
      <label
        className={`
          absolute left-0 font-sans pointer-events-none
          transition-all duration-200
          ${isActive
            ? 'top-0 text-ui-11 tracking-wide text-tea-gold'
            : 'top-5 text-base text-tea-text-dim'
          }
        `}
      >
        {label}
        {required && <span className="ml-0.5 text-tea-gold">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          className={sharedClass}
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
          className={sharedClass}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          aria-label={label}
          autoComplete={autoComplete}
        />
      )}
      {error && <p className="text-tea-gold text-xs mt-1">{error}</p>}
    </div>
  );
};
