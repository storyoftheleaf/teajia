import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icons } from './Icons';
import { Button } from './shared/Button';
import { useScrollLock } from '../hooks/useScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';

export type ServiceType = 'teaching' | 'design' | 'general';
export type TeachingFormat = 'online' | 'one-on-one' | 'online-training';

interface GuidanceInquiryModalProps {
  onClose: () => void;
  initialServiceType?: ServiceType;
}

const SERVICE_OPTIONS: { id: ServiceType; label: string; description: string }[] = [
  { id: 'teaching', label: 'Tea Education', description: 'Learn about tea through guided sessions' },
  { id: 'design', label: 'Tea Space Design', description: 'Create your ideal tea environment' },
  { id: 'general', label: 'General Inquiry', description: 'Something else in mind' },
];

const TEACHING_FORMAT_OPTIONS: { id: TeachingFormat; label: string; description: string }[] = [
  { id: 'online', label: 'Online Group Sessions', description: 'Join virtual tea sessions with others' },
  { id: 'one-on-one', label: 'One-on-One Sessions', description: 'Personalized private sessions (in-person or virtual)' },
  { id: 'online-training', label: 'Online Training Course', description: 'Self-paced learning with guidance' },
];

export const GuidanceInquiryModal: React.FC<GuidanceInquiryModalProps> = ({ onClose, initialServiceType }) => {
  useScrollLock(true);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    vision: '',
    serviceType: initialServiceType || '' as ServiceType | '',
    teachingFormat: '' as TeachingFormat | '',
    experienceLevel: '' as 'beginner' | 'intermediate' | 'advanced' | '',
    spaceType: '' as 'home' | 'commercial' | 'outdoor' | '',
    budget: '' as 'under-5k' | '5k-15k' | '15k-50k' | 'over-50k' | '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(!!initialServiceType);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);

      // Close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-modal bg-tea-text/90 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]"
      onClick={onClose}
    >
      <div
        ref={focusTrapRef}
        className="bg-tea-bg max-w-md md:max-w-2xl w-full p-8 rounded-lg relative shadow-2xl animate-[scaleIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-tea-text/40 hover:text-tea-gold transition-colors duration-300"
        >
          <Icons.Close className="w-5 h-5" />
        </button>

        {!submitted ? (
          <>
            {/* Header */}
            <h2 className="font-serif text-3xl text-tea-text mb-2">
              Get Guidance
            </h2>
            <p className="text-tea-text/70 text-sm mb-6">
              Tell us about your vision and we'll reach out to start a conversation.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Service Type Selection */}
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                  What are you interested in?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {SERVICE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, serviceType: option.id, teachingFormat: '', spaceType: '', budget: '' }))}
                      className={`p-3 text-left rounded-sm border transition-all duration-200 ${
                        formData.serviceType === option.id
                          ? 'border-tea-gold bg-tea-gold/8'
                          : 'border-tea-border hover:border-tea-gold/50'
                      }`}
                    >
                      <div className="font-medium text-tea-text text-sm">{option.label}</div>
                      <div className="text-xs text-tea-text/60">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Teaching Format (conditional) */}
              {formData.serviceType === 'teaching' && (
                <div className="animate-[fadeIn_0.2s_ease-out]">
                  <label className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                    Preferred Format
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {TEACHING_FORMAT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, teachingFormat: option.id }))}
                        className={`p-3 text-left rounded-sm border transition-all duration-200 ${
                          formData.teachingFormat === option.id
                            ? 'border-tea-gold bg-tea-gold/8'
                            : 'border-tea-border hover:border-tea-gold/50'
                        }`}
                      >
                        <div className="font-medium text-tea-text text-sm">{option.label}</div>
                        <div className="text-xs text-tea-text/60">{option.description}</div>
                      </button>
                    ))}
                  </div>

                  {/* Experience Level */}
                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                      Your Experience Level
                    </label>
                    <div className="flex gap-2">
                      {['beginner', 'intermediate', 'advanced'].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, experienceLevel: level as 'beginner' | 'intermediate' | 'advanced' }))}
                          className={`flex-1 py-2 px-3 text-xs uppercase tracking-wider rounded-sm border transition-all ${
                            formData.experienceLevel === level
                              ? 'border-tea-gold bg-tea-gold text-white'
                              : 'border-tea-border text-tea-text/70 hover:border-tea-gold/50'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Design-specific fields (conditional) */}
              {formData.serviceType === 'design' && (
                <div className="animate-[fadeIn_0.2s_ease-out] space-y-4">
                  {/* Space Type */}
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                      Type of Space
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: 'home', label: 'Home' },
                        { id: 'commercial', label: 'Commercial' },
                        { id: 'outdoor', label: 'Outdoor' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, spaceType: option.id as 'home' | 'commercial' | 'outdoor' }))}
                          className={`flex-1 py-2 px-3 text-xs uppercase tracking-wider rounded-sm border transition-all ${
                            formData.spaceType === option.id
                              ? 'border-tea-gold bg-tea-gold text-white'
                              : 'border-tea-border text-tea-text/70 hover:border-tea-gold/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Budget Range */}
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                      Budget Range (Optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'under-5k', label: 'Under $5K' },
                        { id: '5k-15k', label: '$5K - $15K' },
                        { id: '15k-50k', label: '$15K - $50K' },
                        { id: 'over-50k', label: 'Over $50K' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, budget: option.id as 'under-5k' | '5k-15k' | '15k-50k' | 'over-50k' }))}
                          className={`py-2 px-3 text-xs rounded-sm border transition-all ${
                            formData.budget === option.id
                              ? 'border-tea-gold bg-tea-gold text-white'
                              : 'border-tea-border text-tea-text/70 hover:border-tea-gold/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Name & Email - side by side on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-tea-surface border border-tea-gold/10 rounded-sm text-tea-text placeholder-tea-text-dim placeholder-tea-text-dim focus:outline-none focus:border-tea-gold transition-colors duration-300"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-tea-surface border border-tea-gold/10 rounded-sm text-tea-text placeholder-tea-text-dim placeholder-tea-text-dim focus:outline-none focus:border-tea-gold transition-colors duration-300"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Phone (optional) */}
              <div>
                <label htmlFor="phone" className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                  Phone <span className="text-tea-text/40">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-tea-surface border border-tea-gold/10 rounded-sm text-tea-text placeholder-tea-text-dim placeholder-tea-text-dim focus:outline-none focus:border-tea-gold transition-colors duration-300"
                  placeholder="Your phone number"
                />
              </div>

              {/* Vision / Message */}
              <div>
                <label htmlFor="vision" className="block text-xs uppercase tracking-[0.15em] text-tea-text/80 mb-2">
                  {formData.serviceType === 'design' ? 'Describe Your Vision' : formData.serviceType === 'teaching' ? 'What Would You Like to Learn?' : 'Tell Us More'}
                </label>
                <textarea
                  id="vision"
                  name="vision"
                  value={formData.vision}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-tea-surface border border-tea-gold/10 rounded-sm text-tea-text placeholder-tea-text-dim placeholder-tea-text-dim focus:outline-none focus:border-tea-gold transition-colors duration-300 resize-none h-24"
                  placeholder={
                    formData.serviceType === 'design'
                      ? "Describe the tea space you're imagining..."
                      : formData.serviceType === 'teaching'
                      ? "What aspects of tea are you most curious about?"
                      : "How can we help you on your tea journey?"
                  }
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
                icon={!isSubmitting ? <Icons.Send className="w-4 h-4" /> : undefined}
                className="mt-6 uppercase tracking-wider text-xs"
              >
                {isSubmitting ? 'Sending...' : 'Send Inquiry'}
              </Button>

              {/* Info Text */}
              <p className="text-xs text-tea-text/60 text-center mt-4">
                We'll reach out within 24 hours to discuss your project.
              </p>
            </form>
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-tea-gold/8 rounded-full flex items-center justify-center mb-6">
                <Icons.Check className="w-8 h-8 text-tea-gold" />
              </div>

              <h3 className="font-serif text-2xl text-tea-text mb-3">
                Thank You!
              </h3>

              <p className="text-tea-text/70 mb-6">
                We've received your inquiry and will be in touch soon.
              </p>

              <button
                onClick={onClose}
                className="px-6 py-2 bg-tea-gold/8 hover:bg-tea-gold/15 text-tea-gold uppercase tracking-wider text-xs font-medium rounded-sm transition-colors duration-300"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
