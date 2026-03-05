
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CartItem } from '../types';
import { Icons } from './Icons';
import { useScrollLock } from '../hooks/useScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';

// CONFIG
const TEAJIA_WHATSAPP_NUMBER = '+1234567890'; // TODO: Update with actual business number

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
}

type CheckoutStep = 'CART' | 'CHECKOUT';

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, cart, onRemoveItem, onUpdateQuantity }) => {
  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const [step, setStep] = useState<CheckoutStep>('CART');

  // Swipe to dismiss state — only triggered from drag handle (#21)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDragHandle = useRef(false);

  // Customer Details State
  const [details, setDetails] = useState({
    name: '',
    contact: '', // Email or Phone
    location: '',
    notes: ''
  });

  // Option 4: Success state for animation
  const [successMessage, setSuccessMessage] = useState<{ show: boolean; type: 'whatsapp' | 'email' | 'copy' }>({ show: false, type: 'copy' });

  // Undo remove (#68)
  const [removedItem, setRemovedItem] = useState<{ item: CartItem; undoTimeout: ReturnType<typeof setTimeout> } | null>(null);

  // Order reference (#73)
  const orderRef = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 900 + 100);
    return `TJ-${y}${m}${day}-${rand}`;
  }, []);

  // Option 7: Session persistence and abandoned cart recovery
  const [recoveredCart, setRecoveredCart] = useState(false);

  // Form validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: string): string => {
    if (field === 'name' && !value.trim()) return 'Name is required';
    if (field === 'contact' && !value.trim()) return 'Email or phone is required';
    if (field === 'location' && !value.trim()) return 'Location is required';
    return '';
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = details[field as keyof typeof details] || '';
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleFieldChange = (field: string, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const isFormValid = details.name.trim() && details.contact.trim() && details.location.trim();

  // Option 2: Device detection for smart button selection
  const [isLikelyMobile, setIsLikelyMobile] = useState(false);
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    // Option 1: Load saved details from localStorage
    const savedDetails = localStorage.getItem('teajia_cartDetails');
    if (savedDetails) {
      try {
        setDetails(JSON.parse(savedDetails));
      } catch (e) {
        // Silently fail if corrupted
      }
    }

    // Option 7: Check for abandoned cart in sessionStorage
    const sessionCart = sessionStorage.getItem('teajia_cartState');
    const sessionDetails = sessionStorage.getItem('teajia_cartDetails');
    if (sessionCart && isOpen && cart.length === 0) {
      setRecoveredCart(true);
    }

    // Option 2: Detect device type
    const isMobile = window.innerWidth < 768;
    setIsLikelyMobile(isMobile);
    setPreferredChannel(isMobile ? 'whatsapp' : 'email');

    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsLikelyMobile(newIsMobile);
      setPreferredChannel(newIsMobile ? 'whatsapp' : 'email');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Option 7: Save cart state to sessionStorage
  useEffect(() => {
    if (cart.length > 0) {
      sessionStorage.setItem('teajia_cartState', JSON.stringify(cart));
    }
  }, [cart]);

  // Option 1: Save details to localStorage whenever they change
  useEffect(() => {
    if (details.name || details.contact) {
      localStorage.setItem('teajia_cartDetails', JSON.stringify(details));
    }
  }, [details]);

  // Reset to initial step when drawer closes
  useEffect(() => {
    if (!isOpen) {
        const timeout = setTimeout(() => {
            setStep('CART');
            setShowOptionalFields(false);
            setSuccessMessage({ show: false, type: 'copy' });
            setRecoveredCart(false);
            setTouchOffset(0);
            setIsDragging(false);
        }, 500); // Wait for transition to finish
        return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Swipe to dismiss handlers — gated on drag handle only (#21)
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    isDragHandle.current = !!target.closest('[data-drag-handle]');
    if (!isDragHandle.current) return;
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragHandle.current || touchStart === null) return;
    const currentX = e.touches[0].clientX;
    const offset = currentX - touchStart;
    if (offset > 0) setTouchOffset(offset);
  };

  const handleTouchEnd = () => {
    if (!isDragHandle.current || touchStart === null) return;
    const threshold = 150;
    if (touchOffset > threshold) onClose();
    setTouchStart(null);
    setTouchOffset(0);
    setIsDragging(false);
    isDragHandle.current = false;
  };

  // Calculate swipe progress for visual feedback
  const swipeProgress = touchOffset / 150; // 0 to 1+ based on threshold
  const swipeOpacity = Math.max(0.3, 1 - swipeProgress * 0.7);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cart]);

  const handleNext = () => {
    if (step === 'CART' && cart.length > 0) setStep('CHECKOUT');
  };

  const handleBack = () => {
    if (step === 'CHECKOUT') setStep('CART');
    else onClose();
  };

  // --- Message Generation ---
  const orderMessage = useMemo(() => {
    const date = new Date().toLocaleDateString();
    let msg = `ORDER INQUIRY [TEAJIA]\nRef: ${orderRef}\nDate: ${date}\n\n`;
    msg += `CUSTOMER:\nName: ${details.name}\nContact: ${details.contact}\nShipping To: ${details.location}\n`;
    if (details.notes) msg += `Notes: ${details.notes}\n`;

    msg += `\nITEMS:\n`;
    cart.forEach(item => {
        const qtyLabel = item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`;
        msg += `- ${item.name} (${item.variant}): ${qtyLabel} @ $${item.totalPrice.toFixed(2)}\n`;
    });

    msg += `\nTOTAL ESTIMATE: $${subtotal.toFixed(2)}\n\n`;
    msg += `Please confirm availability and shipping costs.`;
    return msg;
  }, [cart, details, subtotal]);

  // Option 4: Show success message with animation
  const showSuccess = (type: 'whatsapp' | 'email' | 'copy') => {
    setSuccessMessage({ show: true, type });
    setTimeout(() => setSuccessMessage({ show: false, type }), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(orderMessage);
    showSuccess('copy');
  };

  const handleEmail = () => {
    const subject = `Tea Order Inquiry - ${details.name}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderMessage)}`);
    showSuccess('email');
  };

  // Option 3: Use dedicated WhatsApp number
  const handleWhatsApp = () => {
    const cleanNumber = String(TEAJIA_WHATSAPP_NUMBER).replace(/\D/g, '');
    const waLink = cleanNumber && cleanNumber !== '1234567890'
      ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(orderMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(orderMessage)}`;
    window.open(waLink);
    showSuccess('whatsapp');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      {/* Drawer Panel */}
      <div
        ref={focusTrapRef}
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-[#F3F0E7] dark:bg-[#1a1a1a] z-[100] shadow-2xl flex flex-col ${isOpen ? '' : 'translate-x-full'}`}
        style={{
          transform: isOpen ? `translateX(${touchOffset}px)` : 'translateX(100%)',
          opacity: isDragging ? swipeOpacity : 1,
          transition: isDragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {/* Header */}
        <div className="flex flex-col">
            {/* Mobile drag handle — swipe-to-dismiss is gated here (#21) */}
            <div data-drag-handle className="md:hidden flex justify-center py-3 bg-[#E6E2D6] dark:bg-[#242424] cursor-grab active:cursor-grabbing touch-pan-x">
                <div className={`h-1 rounded-full transition-all duration-150 ${
                  isDragging
                    ? 'bg-tea-seal w-16'
                    : 'bg-tea-charcoal/20 dark:bg-white/20 w-12'
                }`}></div>
            </div>

            <div className="flex items-center justify-between p-6 border-b border-tea-charcoal/10 dark:border-white/10 bg-[#E6E2D6] dark:bg-[#242424]">
                {/* Left: Back (checkout step) or empty spacer */}
                {step !== 'CART' ? (
                    <button onClick={handleBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Back to cart">
                        <Icons.Back className="w-5 h-5 text-tea-charcoal/50 hover:text-tea-charcoal dark:hover:text-white" />
                    </button>
                ) : (
                    <div className="w-[44px]" />
                )}
                {/* Centre: Title + reference */}
                <div className="text-center">
                    <h2 className="text-lg font-serif text-tea-charcoal dark:text-white tracking-wide">
                        {step === 'CART' ? 'Your Selection' : 'Request Order'}
                    </h2>
                    {step === 'CHECKOUT' && (
                        <p className="text-[10px] font-mono text-tea-charcoal/40 dark:text-white/40 mt-0.5">{orderRef}</p>
                    )}
                </div>
                {/* Right: Close */}
                <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Close cart">
                    <Icons.Close className="w-6 h-6 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white" />
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
           {/* Texture */}
           <div className="absolute inset-0 opacity-[0.1] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none"></div>
           
           {/* Undo remove toast (#68) */}
           {removedItem && (
               <div className="relative z-20 mb-4 animate-[slideUp_0.3s_ease-out]">
                   <div className="flex items-center justify-between bg-tea-charcoal dark:bg-white/10 text-tea-paper dark:text-white px-4 py-3 rounded-sm">
                       <span className="text-xs font-sans">{removedItem.item.name} removed</span>
                       <button
                           onClick={() => {
                               clearTimeout(removedItem.undoTimeout);
                               // Re-add the item
                               onUpdateQuantity(removedItem.item.id, removedItem.item.quantityGrams);
                               setRemovedItem(null);
                           }}
                           className="text-tea-seal text-xs uppercase tracking-widest font-medium ml-4 hover:text-tea-seal/80 transition-colors"
                       >
                           Undo
                       </button>
                   </div>
               </div>
           )}

           {/* STEP 1: CART ITEMS */}
           {step === 'CART' && (
               <div className="space-y-6 relative z-10">
                   {cart.length === 0 ? (
                       <div className="text-center py-20 opacity-40">
                           <Icons.Bag className="w-12 h-12 mx-auto mb-4" />
                           <p className="font-serif italic">Your ledger is empty.</p>
                       </div>
                   ) : (
                       cart.map(item => (
                           <div key={item.id} className="flex gap-4 border-b border-tea-charcoal/5 dark:border-white/10 pb-4">
                               <div className="w-16 h-16 bg-tea-charcoal/5 dark:bg-white/10 flex items-center justify-center overflow-hidden rounded-[1px] shrink-0">
                                   {item.image ? (
                                       <img src={item.image} className="w-full h-full object-cover sepia-[0.3]" alt={item.name} loading="eager" />
                                   ) : (
                                       <Icons.Leaf className="w-6 h-6 opacity-20" />
                                   )}
                               </div>
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start">
                                       <h3 className="font-serif text-tea-charcoal dark:text-white text-lg leading-none mb-1">{item.name}</h3>
                                       {/* Remove button always visible (#67) */}
                                       <button
                                           onClick={() => {
                                               const timeout = setTimeout(() => setRemovedItem(null), 5000);
                                               setRemovedItem({ item, undoTimeout: timeout });
                                               onRemoveItem(item.id);
                                           }}
                                           className="text-tea-charcoal/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 p-2 -mr-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                           aria-label={`Remove ${item.name} from cart`}
                                       >
                                           <Icons.Close className="w-4 h-4" />
                                       </button>
                                   </div>
                                   <p className="text-[10px] uppercase tracking-wider text-tea-charcoal/50 dark:text-white/50 mb-3">{item.variant}</p>

                                   {/* Quantity stepper with +/− buttons (#23/#63) */}
                                   <div className="flex items-center justify-between gap-3 bg-white/30 dark:bg-white/5 px-2 py-1.5 rounded-[1px]">
                                       <div className="flex items-center gap-2">
                                           <button
                                               onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - (item.category === 'tea' ? 10 : 1)))}
                                               className="w-7 h-7 flex items-center justify-center rounded-sm bg-white/40 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 transition-colors text-tea-charcoal dark:text-white font-medium text-base leading-none"
                                               aria-label="Decrease quantity"
                                           >−</button>
                                           <div className="flex items-center gap-1">
                                               <input
                                                   type="number"
                                                   inputMode="numeric"
                                                   min={1}
                                                   max={9999}
                                                   value={item.quantityGrams}
                                                   onChange={(e) => {
                                                     const val = parseInt(e.target.value);
                                                     if (isNaN(val)) return;
                                                     onUpdateQuantity(item.id, Math.min(9999, Math.max(1, val)));
                                                   }}
                                                   onBlur={(e) => {
                                                     const val = parseInt(e.target.value);
                                                     if (isNaN(val) || val < 1) onUpdateQuantity(item.id, 1);
                                                   }}
                                                   className="w-12 bg-transparent font-mono text-xs text-tea-charcoal dark:text-white border-b border-tea-charcoal/20 dark:border-white/20 focus:outline-none focus:border-tea-seal text-center"
                                               />
                                               {item.category === 'tea' && <span className="font-mono text-xs text-tea-charcoal/50 dark:text-white/50">g</span>}
                                           </div>
                                           <button
                                               onClick={() => onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + (item.category === 'tea' ? 10 : 1)))}
                                               className="w-7 h-7 flex items-center justify-center rounded-sm bg-white/40 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 transition-colors text-tea-charcoal dark:text-white font-medium text-base leading-none"
                                               aria-label="Increase quantity"
                                           >+</button>
                                       </div>
                                       <span className="font-mono text-sm text-tea-charcoal dark:text-white font-medium">
                                           ${item.totalPrice.toFixed(2)}
                                       </span>
                                   </div>
                               </div>
                           </div>
                       ))
                   )}
               </div>
           )}

           {/* STEP 2: CHECKOUT (Combined Details + Message) */}
           {step === 'CHECKOUT' && (
               <div className="space-y-6 relative z-10">
                   <p className="font-serif text-sm text-tea-charcoal/70 dark:text-white/70 italic mb-4">
                       Fill in your details below. Your order inquiry will be generated automatically.
                   </p>

                   {/* Required Fields Form */}
                   <div className="space-y-4 p-4 bg-white/30 dark:bg-white/5 rounded-lg border border-tea-charcoal/10 dark:border-white/10">
                       <div>
                           <label className="block text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mb-1">Name *</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.name}
                                   onChange={(e) => handleFieldChange('name', e.target.value)}
                                   onBlur={() => handleFieldBlur('name')}
                                   className={`w-full bg-white/50 dark:bg-white/5 border-b p-2 focus:outline-none dark:text-white font-serif text-lg placeholder:text-tea-charcoal/20 dark:placeholder:text-white/20 transition-colors ${
                                       touched.name && errors.name
                                           ? 'border-red-500 focus:border-red-500'
                                           : 'border-tea-charcoal/20 dark:border-white/20 focus:border-tea-seal'
                                   }`}
                                   placeholder="Your full name"
                               />
                               {details.name && !errors.name && (
                                   <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                               )}
                           </div>
                           {touched.name && errors.name && (
                               <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                           )}
                       </div>
                       <div>
                           <label className="block text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mb-1">Contact *</label>
                           <div className="relative">
                               <input
                                   type="email"
                                   inputMode="email"
                                   autoComplete="email"
                                   value={details.contact}
                                   onChange={(e) => handleFieldChange('contact', e.target.value)}
                                   onBlur={() => handleFieldBlur('contact')}
                                   className={`w-full bg-white/50 dark:bg-white/5 border-b p-2 focus:outline-none dark:text-white font-serif text-lg placeholder:text-tea-charcoal/20 dark:placeholder:text-white/20 transition-colors ${
                                       touched.contact && errors.contact
                                           ? 'border-red-500 focus:border-red-500'
                                           : 'border-tea-charcoal/20 dark:border-white/20 focus:border-tea-seal'
                                   }`}
                                   placeholder="your@email.com"
                               />
                               {details.contact && !errors.contact && (
                                   <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                               )}
                           </div>
                           {touched.contact && errors.contact && (
                               <p className="text-red-500 text-xs mt-1">{errors.contact}</p>
                           )}
                       </div>
                       <div>
                           <label className="block text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mb-1">Shipping Location *</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.location}
                                   onChange={(e) => handleFieldChange('location', e.target.value)}
                                   onBlur={() => handleFieldBlur('location')}
                                   className={`w-full bg-white/50 dark:bg-white/5 border-b p-2 focus:outline-none dark:text-white font-serif text-lg placeholder:text-tea-charcoal/20 dark:placeholder:text-white/20 transition-colors ${
                                       touched.location && errors.location
                                           ? 'border-red-500 focus:border-red-500'
                                           : 'border-tea-charcoal/20 dark:border-white/20 focus:border-tea-seal'
                                   }`}
                                   placeholder="City, Country"
                               />
                               {details.location && !errors.location && (
                                   <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                               )}
                           </div>
                           {touched.location && errors.location && (
                               <p className="text-red-500 text-xs mt-1">{errors.location}</p>
                           )}
                       </div>
                       <div>
                           <label className="block text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mb-1">Special Requests (Optional)</label>
                           <textarea
                               value={details.notes}
                               onChange={(e) => setDetails({...details, notes: e.target.value})}
                               className="w-full bg-white/50 dark:bg-white/5 border-b border-tea-charcoal/20 dark:border-white/20 p-2 focus:outline-none focus:border-tea-seal dark:text-white font-serif text-base h-20 resize-none placeholder:text-tea-charcoal/20 dark:placeholder:text-white/20"
                               placeholder="Any special requests..."
                           />
                       </div>
                   </div>

                   {/* Message Preview */}
                   <div>
                       <label className="block text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mb-2">Order Inquiry Preview</label>
                       <div className="bg-[#FFFDF5] dark:bg-[#2a2a2a] border border-tea-charcoal/10 dark:border-white/10 p-4 font-mono text-xs leading-relaxed text-tea-charcoal/80 dark:text-white/80 shadow-inner overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                           {orderMessage}
                       </div>
                   </div>

                   {/* Option 4: Success Message Animation */}
                   {successMessage.show && (
                       <div className="animate-[fadeIn_0.3s_ease-out] bg-tea-green/10 dark:bg-tea-green/20 border border-tea-green/30 dark:border-tea-green/40 text-tea-green dark:text-tea-green px-4 py-3 rounded-[1px] flex items-center gap-2">
                           <Icons.Check className="w-4 h-4" />
                           <span className="text-xs uppercase tracking-widest font-medium">
                               {successMessage.type === 'whatsapp' && 'Opening WhatsApp...'}
                               {successMessage.type === 'email' && 'Opening email client...'}
                               {successMessage.type === 'copy' && 'Copied to clipboard!'}
                           </span>
                       </div>
                   )}

                   <div className="grid grid-cols-1 gap-3">
                       {/* Option 2: Smart Device Detection - Highlight Preferred Channel */}
                       <button
                           onClick={handleWhatsApp}
                           disabled={!details.name || !details.contact || !details.location}
                           className={`flex items-center justify-center gap-2 py-3 border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                               preferredChannel === 'whatsapp'
                                   ? 'border-tea-green/50 bg-tea-green/10 dark:bg-tea-green/20 text-tea-green shadow-md'
                                   : 'border-tea-green/30 dark:border-tea-green/30 bg-tea-green/5 dark:bg-tea-green/10 hover:bg-tea-green/10 dark:hover:bg-tea-green/20 text-tea-green'
                           }`}
                       >
                           <Icons.Message className="w-4 h-4" />
                           <span className="text-[10px] uppercase tracking-widest">Send via WhatsApp</span>
                           {preferredChannel === 'whatsapp' && <span className="text-xs ml-1">✓</span>}
                       </button>
                       <button
                           onClick={handleEmail}
                           disabled={!details.name || !details.contact || !details.location}
                           className={`flex items-center justify-center gap-2 py-3 border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                               preferredChannel === 'email'
                                   ? 'border-tea-charcoal/30 dark:border-white/30 bg-tea-charcoal/10 dark:bg-white/10 text-tea-charcoal dark:text-white shadow-md'
                                   : 'border-tea-charcoal/10 dark:border-white/10 hover:bg-tea-charcoal/5 dark:hover:bg-white/5 text-tea-charcoal dark:text-white'
                           }`}
                       >
                           <span className="text-[10px] uppercase tracking-widest">Send via Email</span>
                           {preferredChannel === 'email' && <span className="text-xs ml-1">✓</span>}
                       </button>
                       <button
                           onClick={handleCopy}
                           disabled={!details.name || !details.contact || !details.location}
                           className="flex items-center justify-center gap-2 py-3 border border-tea-charcoal/10 dark:border-white/10 hover:bg-tea-charcoal/5 dark:hover:bg-white/5 text-tea-charcoal dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                           <span className="text-[10px] uppercase tracking-widest">Copy to Clipboard</span>
                       </button>
                   </div>

                   {/* Abandoned Cart Recovery Indicator */}
                   {recoveredCart && (
                       <p className="text-center text-xs text-tea-seal italic">
                           Recovered your previous order request
                       </p>
                   )}

                   <p className="text-center text-xs text-tea-charcoal/40 dark:text-white/40 italic">
                       Sending this message will initiate your order request with Teajia.
                   </p>
               </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-tea-charcoal/10 dark:border-white/10 bg-[#E6E2D6] dark:bg-[#242424] relative z-20">
            {step === 'CART' && (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-serif text-xl text-tea-charcoal dark:text-white">
                        <span>Total</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-tea-seal text-tea-paper uppercase tracking-[0.2em] text-xs hover:bg-tea-seal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Request This Order
                    </button>
                </div>
            )}

            {step === 'CHECKOUT' && (
                <p className="text-xs text-center text-tea-charcoal/60 dark:text-white/60 mb-4">
                    Send your order inquiry via WhatsApp, Email, or copy to clipboard
                </p>
            )}
        </div>

      </div>
    </>
  );
};
