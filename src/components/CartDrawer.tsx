
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CartItem } from '../types';
import { Icons } from './Icons';
import { useScrollLock } from '../hooks/useScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { fmtNum, fmtPrice } from '../utils/formatNumber';

// CONFIG
const TEAJIA_WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '+18313259164';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
}

type CheckoutStep = 'CART' | 'CHECKOUT';
type ShippingMethod = 'international' | 'pickup' | 'gojek';

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, cart, onRemoveItem, onUpdateQuantity }) => {
  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const [step, setStep] = useState<CheckoutStep>('CART');

  // Swipe to dismiss state — only triggered from drag handle (#21)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDragHandle = useRef(false);

  // Shipping Method State
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('international');

  // Customer Details State
  const [details, setDetails] = useState({
    name: '',
    contact: '', // Email or Phone
    phone: '',   // Phone number for local pickup/Go-Jek
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
    if (field === 'phone' && !value.trim()) return 'Phone number is required';
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

  const needsPhone = shippingMethod === 'pickup' || shippingMethod === 'gojek';
  const needsLocation = shippingMethod === 'international' || shippingMethod === 'gojek';
  const isFormValid = details.name.trim() && details.contact.trim()
    && (!needsPhone || details.phone.trim())
    && (!needsLocation || details.location.trim());

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
  const shippingLabel = shippingMethod === 'international'
    ? 'International Shipping'
    : shippingMethod === 'pickup'
    ? 'Local Pick Up'
    : 'Local Go-Jek Delivery';

  const orderMessage = useMemo(() => {
    const date = new Date().toLocaleDateString();
    let msg = `ORDER INQUIRY [TEAJIA]\nRef: ${orderRef}\nDate: ${date}\n\n`;
    msg += `CUSTOMER:\nName: ${details.name}\nContact: ${details.contact}\n`;
    if (details.phone) msg += `Phone: ${details.phone}\n`;
    msg += `Shipping: ${shippingLabel}\n`;
    if (shippingMethod === 'international') {
      msg += `Ship To: ${details.location}\n`;
    } else if (shippingMethod === 'gojek') {
      msg += `Delivery Address: ${details.location}\n`;
    }
    if (details.notes) msg += `Notes: ${details.notes}\n`;

    msg += `\nITEMS:\n`;
    cart.forEach(item => {
        const qtyLabel = item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`;
        msg += `- ${item.name} (${item.variant}): ${qtyLabel} @ $${fmtNum(item.totalPrice)}\n`;
    });

    msg += `\nTOTAL ESTIMATE: ${fmtPrice(subtotal)}`;
    if (shippingMethod === 'international') {
      msg += ` (excluding shipping)`;
    }
    msg += `\n\n`;
    if (shippingMethod === 'international') {
      msg += `Please confirm availability and shipping costs.`;
    } else if (shippingMethod === 'pickup') {
      msg += `Please confirm availability and arrange pick up.`;
    } else {
      msg += `Please confirm availability and arrange Go-Jek delivery.`;
    }
    return msg;
  }, [cart, details, subtotal, shippingMethod, shippingLabel]);

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
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-tea-bg text-tea-text-sec z-[100] shadow-2xl flex flex-col ${isOpen ? '' : 'translate-x-full'}`}
        style={{
          transform: isOpen ? `translateX(${touchOffset}px)` : 'translateX(100%)',
          opacity: isDragging ? swipeOpacity : 1,
          transition: isDragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Ambient warmth layer */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 85% 8%, rgba(184,146,78,0.09) 0%, rgba(184,146,78,0.04) 40%, transparent 70%)'
        }} />
        {/* Noise grain */}
        <div className="absolute inset-0 pointer-events-none" style={{
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }} />

        {/* Header */}
        <div className="flex flex-col relative z-10">
            {/* Mobile drag handle */}
            <div data-drag-handle className="md:hidden flex justify-center py-3 bg-tea-surface cursor-grab active:cursor-grabbing touch-pan-x">
                <div className="rounded-full transition-all duration-150" style={{
                  height: 3,
                  width: isDragging ? 64 : 48,
                  background: isDragging ? 'var(--tea-gold)' : 'rgba(184,146,78,0.2)'
                }} />
            </div>

            <div className="flex items-center justify-between px-6 py-5 bg-tea-surface border-b border-tea-border">
                {step !== 'CART' ? (
                    <button onClick={handleBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Back to cart">
                        <Icons.Back className="w-5 h-5 text-tea-text-dim" />
                    </button>
                ) : (
                    <div className="w-[44px]" />
                )}
                <div className="text-center">
                    <h2 className="text-tea-text tracking-wide" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>
                        {step === 'CART' ? 'Your Selection' : 'Request Order'}
                    </h2>
                    {step === 'CHECKOUT' && (
                        <p className="text-tea-text-dim mt-0.5" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>{orderRef}</p>
                    )}
                </div>
                <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Close cart">
                    <Icons.Close className="w-6 h-6 text-tea-text-dim" />
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative tea-card-scroll">

           {/* Undo remove toast */}
           {removedItem && (
               <div className="relative z-20 mb-4 animate-[slideUp_0.3s_ease-out]">
                   <div className="flex items-center justify-between px-4 py-3 rounded-sm bg-tea-elevated text-tea-text-sec">
                       <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)' }}>{removedItem.item.name} removed</span>
                       <button
                           onClick={() => {
                               clearTimeout(removedItem.undoTimeout);
                               onUpdateQuantity(removedItem.item.id, removedItem.item.quantityGrams);
                               setRemovedItem(null);
                           }}
                           className="ml-4 transition-colors text-tea-gold"
                           style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}
                       >
                           Undo
                       </button>
                   </div>
               </div>
           )}

           {/* STEP 1: CART ITEMS */}
           {step === 'CART' && (
               <div className="space-y-6 relative z-[1]">
                   {cart.length === 0 ? (
                       <div className="text-center py-20 opacity-35">
                           <Icons.Bag className="w-12 h-12 mx-auto mb-4 text-tea-text-dim" />
                           <p className="text-tea-text-dim italic" style={{ fontFamily: 'var(--font-serif)' }}>Your ledger is empty.</p>
                       </div>
                   ) : (
                       cart.map(item => (
                           <div key={item.id} className="flex gap-4 pb-4 border-b border-tea-border">
                               <div className="w-16 h-16 flex items-center justify-center overflow-hidden shrink-0 bg-tea-elevated" style={{ borderRadius: 2 }}>
                                   {item.image ? (
                                       <img src={item.image} className="w-full h-full object-cover" style={{ filter: 'sepia(0.2) brightness(0.9)' }} alt={item.name} loading="eager" />
                                   ) : (
                                       <Icons.Leaf className="w-6 h-6 text-tea-text-dim opacity-40" />
                                   )}
                               </div>
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start">
                                       <h3 className="text-tea-text" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 400, lineHeight: 1, marginBottom: 4 }}>{item.name}</h3>
                                       <button
                                           onClick={() => {
                                               const timeout = setTimeout(() => setRemovedItem(null), 5000);
                                               setRemovedItem({ item, undoTimeout: timeout });
                                               onRemoveItem(item.id);
                                           }}
                                           className="p-2 -mr-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-tea-text-dim"
                                           aria-label={`Remove ${item.name} from cart`}
                                       >
                                           <Icons.Close className="w-4 h-4" />
                                       </button>
                                   </div>
                                   <p className="text-tea-text-dim" style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 10 }}>{item.variant}</p>

                                   {/* Quantity stepper */}
                                   <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md bg-tea-accent-sub">
                                       <div className="flex items-center gap-2">
                                           <button
                                               onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - (item.category === 'tea' ? 10 : 1)))}
                                               className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors text-tea-text-sec"
                                               style={{ background: 'rgba(184,146,78,0.12)' }}
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
                                                   className="w-12 bg-transparent num text-xs text-center focus:outline-none text-tea-text border-b border-tea-border"
                                               />
                                               {item.category === 'tea' && <span className="num text-xs text-tea-text-dim">g</span>}
                                           </div>
                                           <button
                                               onClick={() => onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + (item.category === 'tea' ? 10 : 1)))}
                                               className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors text-tea-text-sec"
                                               style={{ background: 'rgba(184,146,78,0.12)' }}
                                               aria-label="Increase quantity"
                                           >+</button>
                                       </div>
                                       <span className="num text-sm text-tea-text font-medium">
                                           {fmtPrice(item.totalPrice)}
                                       </span>
                                   </div>
                               </div>
                           </div>
                       ))
                   )}
               </div>
           )}

           {/* STEP 2: CHECKOUT */}
           {step === 'CHECKOUT' && (
               <div className="space-y-5 relative z-10">
                   <p className="text-tea-text-dim italic" style={{ fontFamily: 'var(--font-serif)', fontSize: 14, marginBottom: 4 }}>
                       Fill in your details below. Your order inquiry will be generated automatically.
                   </p>

                   {/* Shipping Method Selector */}
                   <div>
                       <label className="block text-tea-text-dim mb-2" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Shipping Method</label>
                       <div className="grid grid-cols-1 gap-2">
                           {([
                             { key: 'international' as ShippingMethod, label: 'International Shipping', desc: 'Shipping cost calculated and confirmed separately' },
                             { key: 'pickup' as ShippingMethod, label: 'Local Pick Up', desc: 'Collect your order in person' },
                             { key: 'gojek' as ShippingMethod, label: 'Local Go-Jek', desc: 'Same-day delivery via Go-Jek (Bali area)' },
                           ]).map(opt => (
                             <button
                               key={opt.key}
                               type="button"
                               onClick={() => setShippingMethod(opt.key)}
                               className={`flex items-start gap-3 p-3 rounded-md text-left transition-all ${
                                 shippingMethod === opt.key ? 'bg-tea-accent-sub' : 'bg-tea-surface'
                               }`}
                               style={{
                                 border: `1px solid ${shippingMethod === opt.key ? 'rgba(184,146,78,0.35)' : 'var(--tea-border)'}`,
                               }}
                             >
                               <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{
                                 border: `2px solid ${shippingMethod === opt.key ? 'var(--tea-gold)' : 'rgba(128,115,95,0.3)'}`
                               }}>
                                 {shippingMethod === opt.key && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--tea-gold)' }} />}
                               </div>
                               <div>
                                 <span className="block text-tea-text" style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 400 }}>{opt.label}</span>
                                 <span className="block text-tea-text-dim" style={{ fontSize: 10, marginTop: 2 }}>{opt.desc}</span>
                               </div>
                             </button>
                           ))}
                       </div>
                   </div>

                   {/* Inset Form Panel */}
                   <div className="rounded-md p-4 space-y-4 bg-tea-surface border border-tea-border" style={{
                     boxShadow: 'inset 0 1px 0 0 rgba(184,146,78,0.04), inset 0 -1px 0 0 rgba(0,0,0,0.3)',
                   }}>
                       {/* Name */}
                       <div>
                           <label className="block text-tea-text-dim mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Name</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.name}
                                   onChange={(e) => handleFieldChange('name', e.target.value)}
                                   onBlur={() => handleFieldBlur('name')}
                                   aria-invalid={touched.name && !!errors.name}
                                   placeholder="Your full name"
                                   className="w-full bg-transparent focus:outline-none transition-colors text-tea-text"
                                   style={{
                                     borderBottom: `1px solid ${touched.name && errors.name ? '#c0392b' : 'rgba(184,146,78,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'var(--font-serif)',
                                     fontSize: 17,
                                     fontWeight: 400,
                                   }}
                               />
                               {details.name && !errors.name && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-green" />
                               )}
                           </div>
                           {touched.name && errors.name && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.name}</p>
                           )}
                       </div>

                       {/* Contact (Email) */}
                       <div>
                           <label className="block text-tea-text-dim mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Email</label>
                           <div className="relative">
                               <input
                                   type="email"
                                   inputMode="email"
                                   autoComplete="email"
                                   value={details.contact}
                                   onChange={(e) => handleFieldChange('contact', e.target.value)}
                                   onBlur={() => handleFieldBlur('contact')}
                                   aria-invalid={touched.contact && !!errors.contact}
                                   placeholder="your@email.com"
                                   className="w-full bg-transparent focus:outline-none transition-colors text-tea-text"
                                   style={{
                                     borderBottom: `1px solid ${touched.contact && errors.contact ? '#c0392b' : 'rgba(184,146,78,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'var(--font-serif)',
                                     fontSize: 17,
                                     fontWeight: 400,
                                   }}
                               />
                               {details.contact && !errors.contact && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-green" />
                               )}
                           </div>
                           {touched.contact && errors.contact && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.contact}</p>
                           )}
                       </div>

                       {/* Phone — shown for pickup & gojek */}
                       {needsPhone && (
                       <div>
                           <label className="block text-tea-text-dim mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Phone Number</label>
                           <div className="relative">
                               <input
                                   type="tel"
                                   inputMode="tel"
                                   autoComplete="tel"
                                   value={details.phone}
                                   onChange={(e) => handleFieldChange('phone', e.target.value)}
                                   onBlur={() => handleFieldBlur('phone')}
                                   aria-invalid={touched.phone && !!errors.phone}
                                   placeholder={shippingMethod === 'gojek' ? 'For Go-Jek driver coordination' : 'For pick up coordination'}
                                   className="w-full bg-transparent focus:outline-none transition-colors text-tea-text"
                                   style={{
                                     borderBottom: `1px solid ${touched.phone && errors.phone ? '#c0392b' : 'rgba(184,146,78,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'var(--font-serif)',
                                     fontSize: 17,
                                     fontWeight: 400,
                                   }}
                               />
                               {details.phone && !errors.phone && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-green" />
                               )}
                           </div>
                           {touched.phone && errors.phone && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.phone}</p>
                           )}
                       </div>
                       )}

                       {/* Shipping Location — international */}
                       {shippingMethod === 'international' && (
                       <div>
                           <label className="block text-tea-text-dim mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Shipping Location</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.location}
                                   onChange={(e) => handleFieldChange('location', e.target.value)}
                                   onBlur={() => handleFieldBlur('location')}
                                   aria-invalid={touched.location && !!errors.location}
                                   placeholder="City, Country"
                                   className="w-full bg-transparent focus:outline-none transition-colors text-tea-text"
                                   style={{
                                     borderBottom: `1px solid ${touched.location && errors.location ? '#c0392b' : 'rgba(184,146,78,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'var(--font-serif)',
                                     fontSize: 17,
                                     fontWeight: 400,
                                   }}
                               />
                               {details.location && !errors.location && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-green" />
                               )}
                           </div>
                           {touched.location && errors.location && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.location}</p>
                           )}
                       </div>
                       )}

                       {/* Delivery Address — gojek */}
                       {shippingMethod === 'gojek' && (
                       <div>
                           <label className="block text-tea-text-dim mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Delivery Address</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.location}
                                   onChange={(e) => handleFieldChange('location', e.target.value)}
                                   onBlur={() => handleFieldBlur('location')}
                                   aria-invalid={touched.location && !!errors.location}
                                   placeholder="Full address for Go-Jek delivery"
                                   className="w-full bg-transparent focus:outline-none transition-colors text-tea-text"
                                   style={{
                                     borderBottom: `1px solid ${touched.location && errors.location ? '#c0392b' : 'rgba(184,146,78,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'var(--font-serif)',
                                     fontSize: 17,
                                     fontWeight: 400,
                                   }}
                               />
                               {details.location && !errors.location && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-green" />
                               )}
                           </div>
                           {touched.location && errors.location && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.location}</p>
                           )}
                       </div>
                       )}

                       {/* Notes */}
                       <div>
                           <label className="block text-tea-text-dim mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Special Requests <span style={{ fontStyle: 'italic', textTransform: 'none' as const, letterSpacing: 0 }}>optional</span></label>
                           <textarea
                               value={details.notes}
                               onChange={(e) => setDetails({...details, notes: e.target.value})}
                               placeholder="Any special requests..."
                               className="w-full bg-transparent focus:outline-none resize-none text-tea-text-sec"
                               style={{
                                 borderBottom: '1px solid rgba(184,146,78,0.08)',
                                 padding: '6px 0',
                                 fontFamily: 'var(--font-serif)',
                                 fontSize: 15,
                                 fontWeight: 400,
                                 height: 60,
                               }}
                           />
                       </div>
                   </div>

                   {/* Message Preview */}
                   <div>
                       <label className="block text-tea-text-dim mb-1.5" style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Order Inquiry Preview</label>
                       <div className="overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto bg-tea-bg border border-tea-border" style={{
                         borderRadius: 4,
                         padding: 14,
                         fontFamily: 'var(--font-mono)',
                         fontSize: 11,
                         lineHeight: 1.6,
                         color: 'var(--tea-text-dim)',
                         boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)'
                       }}>
                           {orderMessage}
                       </div>
                   </div>

                   {/* Success Message */}
                   {successMessage.show && (
                       <div className="animate-[fadeIn_0.3s_ease-out] flex items-center gap-2 px-4 py-3 rounded-md" style={{
                         background: 'rgba(90,110,90,0.1)',
                         border: '1px solid rgba(90,110,90,0.25)',
                         color: '#5A6E5A'
                       }}>
                           <Icons.Check className="w-4 h-4" />
                           <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 500 }}>
                               {successMessage.type === 'whatsapp' && 'Opening WhatsApp...'}
                               {successMessage.type === 'email' && 'Opening email client...'}
                               {successMessage.type === 'copy' && 'Copied to clipboard!'}
                           </span>
                       </div>
                   )}

                   {/* Send Buttons */}
                   <div className="grid grid-cols-1 gap-2.5">
                       <button
                           onClick={handleWhatsApp}
                           disabled={!isFormValid}
                           className="flex items-center justify-center gap-2 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                           style={{
                             border: `1px solid ${preferredChannel === 'whatsapp' ? 'rgba(90,110,90,0.4)' : 'rgba(90,110,90,0.2)'}`,
                             background: preferredChannel === 'whatsapp' ? 'rgba(90,110,90,0.08)' : 'transparent',
                             color: '#5A6E5A',
                             borderRadius: 4,
                           }}
                       >
                           <Icons.Message className="w-4 h-4" />
                           <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 500 }}>Send via WhatsApp</span>
                           {preferredChannel === 'whatsapp' && <span style={{ fontSize: 11, marginLeft: 4 }}>&#10003;</span>}
                       </button>
                       <button
                           onClick={handleEmail}
                           disabled={!isFormValid}
                           className="flex items-center justify-center gap-2 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-tea-border"
                           style={{
                             background: preferredChannel === 'email' ? 'rgba(184,146,78,0.04)' : 'transparent',
                             color: 'var(--tea-text-sec)',
                             borderRadius: 4,
                             borderColor: preferredChannel === 'email' ? 'rgba(184,146,78,0.2)' : undefined,
                           }}
                       >
                           <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 500 }}>Send via Email</span>
                           {preferredChannel === 'email' && <span style={{ fontSize: 11, marginLeft: 4 }}>&#10003;</span>}
                       </button>
                       <button
                           onClick={handleCopy}
                           disabled={!isFormValid}
                           className="flex items-center justify-center gap-2 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-tea-border text-tea-text-dim"
                           style={{
                             background: 'transparent',
                             borderRadius: 4,
                           }}
                       >
                           <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 500 }}>Copy to Clipboard</span>
                       </button>
                   </div>

                   {recoveredCart && (
                       <p className="text-center text-tea-gold italic" style={{ fontSize: 12 }}>
                           Recovered your previous order request
                       </p>
                   )}

                   <p className="text-center text-tea-text-dim italic" style={{ fontSize: 11 }}>
                       Sending this message will initiate your order request with Teajia.
                   </p>
               </div>
           )}
        </div>

        {/* Footer */}
        <div className="relative z-20 bg-tea-surface border-t border-tea-border" style={{ padding: step === 'CART' ? '24px' : '0' }}>
            {step === 'CART' && (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center text-tea-text" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>
                        <span>Total</span>
                        <span className="num">{fmtPrice(subtotal)}</span>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={cart.length === 0}
                        className="w-full py-3.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(184,146,78,0.12)',
                          border: '1px solid rgba(184,146,78,0.25)',
                          color: 'var(--tea-gold-lt)',
                          fontSize: 11,
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 500,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const,
                          borderRadius: 4,
                        }}
                    >
                        Request This Order
                    </button>
                </div>
            )}
        </div>

      </div>
    </>
  );
};
