
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

      {/* Drawer Panel — Alcove-inspired warm dark aesthetic */}
      <div
        ref={focusTrapRef}
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] z-[100] shadow-2xl flex flex-col ${isOpen ? '' : 'translate-x-full'}`}
        style={{
          background: '#1c1b19',
          color: '#c0b49a',
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
          background: 'radial-gradient(ellipse at 85% 8%, rgba(181,101,29,0.09) 0%, rgba(181,101,29,0.04) 40%, transparent 70%)'
        }} />
        {/* Noise grain */}
        <div className="absolute inset-0 pointer-events-none" style={{
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }} />

        {/* Header */}
        <div className="flex flex-col relative z-10">
            {/* Mobile drag handle */}
            <div data-drag-handle className="md:hidden flex justify-center py-3 cursor-grab active:cursor-grabbing touch-pan-x" style={{ background: '#1e1d1b' }}>
                <div className="rounded-full transition-all duration-150" style={{
                  height: 3,
                  width: isDragging ? 64 : 48,
                  background: isDragging ? '#b5651d' : 'rgba(200,170,120,0.2)'
                }} />
            </div>

            <div className="flex items-center justify-between px-6 py-5" style={{
              borderBottom: '1px solid rgba(200,170,120,0.08)',
              background: '#1e1d1b'
            }}>
                {step !== 'CART' ? (
                    <button onClick={handleBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Back to cart">
                        <Icons.Back className="w-5 h-5" style={{ color: '#8a7e6a' }} />
                    </button>
                ) : (
                    <div className="w-[44px]" />
                )}
                <div className="text-center">
                    <h2 style={{ color: '#ede6d8', fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 300, letterSpacing: '0.02em' }}>
                        {step === 'CART' ? 'Your Selection' : 'Request Order'}
                    </h2>
                    {step === 'CHECKOUT' && (
                        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#6a6050', marginTop: 2 }}>{orderRef}</p>
                    )}
                </div>
                <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Close cart">
                    <Icons.Close className="w-6 h-6" style={{ color: '#6a6050' }} />
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
           
           {/* Undo remove toast */}
           {removedItem && (
               <div className="relative z-20 mb-4 animate-[slideUp_0.3s_ease-out]">
                   <div className="flex items-center justify-between px-4 py-3 rounded-sm" style={{ background: '#252420', color: '#c0b49a' }}>
                       <span style={{ fontSize: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>{removedItem.item.name} removed</span>
                       <button
                           onClick={() => {
                               clearTimeout(removedItem.undoTimeout);
                               onUpdateQuantity(removedItem.item.id, removedItem.item.quantityGrams);
                               setRemovedItem(null);
                           }}
                           className="ml-4 transition-colors"
                           style={{ color: '#b5651d', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}
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
                       <div className="text-center py-20" style={{ opacity: 0.35 }}>
                           <Icons.Bag className="w-12 h-12 mx-auto mb-4" style={{ color: '#8a7e6a' }} />
                           <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', color: '#8a7e6a' }}>Your ledger is empty.</p>
                       </div>
                   ) : (
                       cart.map(item => (
                           <div key={item.id} className="flex gap-4 pb-4" style={{ borderBottom: '1px solid rgba(200,170,120,0.08)' }}>
                               <div className="w-16 h-16 flex items-center justify-center overflow-hidden shrink-0" style={{ borderRadius: 2, background: '#252420' }}>
                                   {item.image ? (
                                       <img src={item.image} className="w-full h-full object-cover" style={{ filter: 'sepia(0.2) brightness(0.9)' }} alt={item.name} loading="eager" />
                                   ) : (
                                       <Icons.Leaf className="w-6 h-6" style={{ color: '#6a6050', opacity: 0.4 }} />
                                   )}
                               </div>
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start">
                                       <h3 style={{ fontFamily: 'Fraunces, serif', color: '#ede6d8', fontSize: 18, fontWeight: 300, lineHeight: 1, marginBottom: 4 }}>{item.name}</h3>
                                       <button
                                           onClick={() => {
                                               const timeout = setTimeout(() => setRemovedItem(null), 5000);
                                               setRemovedItem({ item, undoTimeout: timeout });
                                               onRemoveItem(item.id);
                                           }}
                                           className="p-2 -mr-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                           style={{ color: '#6a6050' }}
                                           aria-label={`Remove ${item.name} from cart`}
                                       >
                                           <Icons.Close className="w-4 h-4" />
                                       </button>
                                   </div>
                                   <p style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#8a7e6a', marginBottom: 10 }}>{item.variant}</p>

                                   {/* Quantity stepper */}
                                   <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md" style={{ background: 'rgba(200,170,120,0.08)' }}>
                                       <div className="flex items-center gap-2">
                                           <button
                                               onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - (item.category === 'tea' ? 10 : 1)))}
                                               className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors"
                                               style={{ background: 'rgba(200,170,120,0.12)', color: '#c0b49a' }}
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
                                                   className="w-12 bg-transparent num text-xs text-center focus:outline-none"
                                                   style={{ color: '#ede6d8', borderBottom: '1px solid rgba(200,170,120,0.15)' }}
                                               />
                                               {item.category === 'tea' && <span className="num text-xs" style={{ color: '#6a6050' }}>g</span>}
                                           </div>
                                           <button
                                               onClick={() => onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + (item.category === 'tea' ? 10 : 1)))}
                                               className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors"
                                               style={{ background: 'rgba(200,170,120,0.12)', color: '#c0b49a' }}
                                               aria-label="Increase quantity"
                                           >+</button>
                                       </div>
                                       <span className="num text-sm" style={{ color: '#ede6d8', fontWeight: 400 }}>
                                           {fmtPrice(item.totalPrice)}
                                       </span>
                                   </div>
                               </div>
                           </div>
                       ))
                   )}
               </div>
           )}

           {/* STEP 2: CHECKOUT — Alcove-inspired */}
           {step === 'CHECKOUT' && (
               <div className="space-y-5 relative z-10">
                   <p style={{ fontFamily: 'Fraunces, serif', fontSize: 14, color: '#8a7e6a', fontStyle: 'italic', marginBottom: 4 }}>
                       Fill in your details below. Your order inquiry will be generated automatically.
                   </p>

                   {/* Shipping Method Selector */}
                   <div>
                       <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a7e6a', marginBottom: 8 }}>Shipping Method</label>
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
                               className="flex items-start gap-3 p-3 rounded-md text-left transition-all"
                               style={{
                                 border: `1px solid ${shippingMethod === opt.key ? 'rgba(181,101,29,0.5)' : 'rgba(200,170,120,0.08)'}`,
                                 background: shippingMethod === opt.key ? 'rgba(181,101,29,0.08)' : '#1e1d1b',
                               }}
                             >
                               <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{
                                 border: `2px solid ${shippingMethod === opt.key ? '#b5651d' : 'rgba(154,144,128,0.3)'}`
                               }}>
                                 {shippingMethod === opt.key && <div className="w-2 h-2 rounded-full" style={{ background: '#b5651d' }} />}
                               </div>
                               <div>
                                 <span style={{ display: 'block', fontFamily: 'Fraunces, serif', fontSize: 14, fontWeight: 300, color: '#ede6d8' }}>{opt.label}</span>
                                 <span style={{ display: 'block', fontSize: 10, color: '#6a6050', marginTop: 2 }}>{opt.desc}</span>
                               </div>
                             </button>
                           ))}
                       </div>
                   </div>

                   {/* Inset Form Panel — Alcove-style */}
                   <div className="rounded-md p-4 space-y-4" style={{
                     background: '#1e1d1b',
                     boxShadow: 'inset 0 1px 0 0 rgba(200,170,120,0.04), inset 0 -1px 0 0 rgba(0,0,0,0.3)',
                     border: '1px solid rgba(200,170,120,0.06)'
                   }}>
                       {/* Name */}
                       <div>
                           <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a7e6a', marginBottom: 4 }}>Name</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.name}
                                   onChange={(e) => handleFieldChange('name', e.target.value)}
                                   onBlur={() => handleFieldBlur('name')}
                                   aria-invalid={touched.name && !!errors.name}
                                   placeholder="Your full name"
                                   className="w-full focus:outline-none transition-colors"
                                   style={{
                                     background: 'transparent',
                                     borderBottom: `1px solid ${touched.name && errors.name ? '#c0392b' : 'rgba(200,170,120,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'Fraunces, serif',
                                     fontSize: 17,
                                     fontWeight: 300,
                                     color: '#ede6d8',
                                   }}
                               />
                               {details.name && !errors.name && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#7a9a72' }} />
                               )}
                           </div>
                           {touched.name && errors.name && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.name}</p>
                           )}
                       </div>

                       {/* Contact (Email) */}
                       <div>
                           <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a7e6a', marginBottom: 4 }}>Email</label>
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
                                   className="w-full focus:outline-none transition-colors"
                                   style={{
                                     background: 'transparent',
                                     borderBottom: `1px solid ${touched.contact && errors.contact ? '#c0392b' : 'rgba(200,170,120,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'Fraunces, serif',
                                     fontSize: 17,
                                     fontWeight: 300,
                                     color: '#ede6d8',
                                   }}
                               />
                               {details.contact && !errors.contact && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#7a9a72' }} />
                               )}
                           </div>
                           {touched.contact && errors.contact && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.contact}</p>
                           )}
                       </div>

                       {/* Phone — shown for pickup & gojek */}
                       {needsPhone && (
                       <div>
                           <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a7e6a', marginBottom: 4 }}>Phone Number</label>
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
                                   className="w-full focus:outline-none transition-colors"
                                   style={{
                                     background: 'transparent',
                                     borderBottom: `1px solid ${touched.phone && errors.phone ? '#c0392b' : 'rgba(200,170,120,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'Fraunces, serif',
                                     fontSize: 17,
                                     fontWeight: 300,
                                     color: '#ede6d8',
                                   }}
                               />
                               {details.phone && !errors.phone && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#7a9a72' }} />
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
                           <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a7e6a', marginBottom: 4 }}>Shipping Location</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.location}
                                   onChange={(e) => handleFieldChange('location', e.target.value)}
                                   onBlur={() => handleFieldBlur('location')}
                                   aria-invalid={touched.location && !!errors.location}
                                   placeholder="City, Country"
                                   className="w-full focus:outline-none transition-colors"
                                   style={{
                                     background: 'transparent',
                                     borderBottom: `1px solid ${touched.location && errors.location ? '#c0392b' : 'rgba(200,170,120,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'Fraunces, serif',
                                     fontSize: 17,
                                     fontWeight: 300,
                                     color: '#ede6d8',
                                   }}
                               />
                               {details.location && !errors.location && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#7a9a72' }} />
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
                           <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a7e6a', marginBottom: 4 }}>Delivery Address</label>
                           <div className="relative">
                               <input
                                   type="text"
                                   value={details.location}
                                   onChange={(e) => handleFieldChange('location', e.target.value)}
                                   onBlur={() => handleFieldBlur('location')}
                                   aria-invalid={touched.location && !!errors.location}
                                   placeholder="Full address for Go-Jek delivery"
                                   className="w-full focus:outline-none transition-colors"
                                   style={{
                                     background: 'transparent',
                                     borderBottom: `1px solid ${touched.location && errors.location ? '#c0392b' : 'rgba(200,170,120,0.12)'}`,
                                     padding: '6px 0',
                                     fontFamily: 'Fraunces, serif',
                                     fontSize: 17,
                                     fontWeight: 300,
                                     color: '#ede6d8',
                                   }}
                               />
                               {details.location && !errors.location && (
                                   <Icons.Check className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#7a9a72' }} />
                               )}
                           </div>
                           {touched.location && errors.location && (
                               <p role="alert" style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>{errors.location}</p>
                           )}
                       </div>
                       )}

                       {/* Notes */}
                       <div>
                           <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#6a6050', marginBottom: 4 }}>Special Requests <span style={{ fontStyle: 'italic', textTransform: 'none' as const, letterSpacing: 0 }}>optional</span></label>
                           <textarea
                               value={details.notes}
                               onChange={(e) => setDetails({...details, notes: e.target.value})}
                               placeholder="Any special requests..."
                               className="w-full focus:outline-none resize-none"
                               style={{
                                 background: 'transparent',
                                 borderBottom: '1px solid rgba(200,170,120,0.08)',
                                 padding: '6px 0',
                                 fontFamily: 'Fraunces, serif',
                                 fontSize: 15,
                                 fontWeight: 300,
                                 color: '#c0b49a',
                                 height: 60,
                               }}
                           />
                       </div>
                   </div>

                   {/* Message Preview — inset with depth */}
                   <div>
                       <label style={{ display: 'block', fontSize: 11, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#6a6050', marginBottom: 6 }}>Order Inquiry Preview</label>
                       <div className="overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto" style={{
                         background: '#161514',
                         border: '1px solid rgba(200,170,120,0.06)',
                         borderRadius: 4,
                         padding: 14,
                         fontFamily: 'monospace',
                         fontSize: 11,
                         lineHeight: 1.6,
                         color: '#9a9080',
                         boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)'
                       }}>
                           {orderMessage}
                       </div>
                   </div>

                   {/* Success Message */}
                   {successMessage.show && (
                       <div className="animate-[fadeIn_0.3s_ease-out] flex items-center gap-2 px-4 py-3 rounded-md" style={{
                         background: 'rgba(122,154,114,0.1)',
                         border: '1px solid rgba(122,154,114,0.25)',
                         color: '#7a9a72'
                       }}>
                           <Icons.Check className="w-4 h-4" />
                           <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 500 }}>
                               {successMessage.type === 'whatsapp' && 'Opening WhatsApp...'}
                               {successMessage.type === 'email' && 'Opening email client...'}
                               {successMessage.type === 'copy' && 'Copied to clipboard!'}
                           </span>
                       </div>
                   )}

                   {/* Send Buttons — Alcove action style */}
                   <div className="grid grid-cols-1 gap-2.5">
                       <button
                           onClick={handleWhatsApp}
                           disabled={!isFormValid}
                           className="flex items-center justify-center gap-2 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                           style={{
                             border: `1px solid ${preferredChannel === 'whatsapp' ? 'rgba(122,154,114,0.4)' : 'rgba(122,154,114,0.2)'}`,
                             background: preferredChannel === 'whatsapp' ? 'rgba(122,154,114,0.08)' : 'transparent',
                             color: '#7a9a72',
                             borderRadius: 4,
                           }}
                       >
                           <Icons.Message className="w-4 h-4" />
                           <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 400 }}>Send via WhatsApp</span>
                           {preferredChannel === 'whatsapp' && <span style={{ fontSize: 11, marginLeft: 4 }}>&#10003;</span>}
                       </button>
                       <button
                           onClick={handleEmail}
                           disabled={!isFormValid}
                           className="flex items-center justify-center gap-2 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                           style={{
                             border: `1px solid ${preferredChannel === 'email' ? 'rgba(200,170,120,0.2)' : 'rgba(200,170,120,0.08)'}`,
                             background: preferredChannel === 'email' ? 'rgba(200,170,120,0.04)' : 'transparent',
                             color: '#c0b49a',
                             borderRadius: 4,
                           }}
                       >
                           <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 400 }}>Send via Email</span>
                           {preferredChannel === 'email' && <span style={{ fontSize: 11, marginLeft: 4 }}>&#10003;</span>}
                       </button>
                       <button
                           onClick={handleCopy}
                           disabled={!isFormValid}
                           className="flex items-center justify-center gap-2 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                           style={{
                             border: '1px solid rgba(200,170,120,0.08)',
                             background: 'transparent',
                             color: '#9a9080',
                             borderRadius: 4,
                           }}
                       >
                           <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 400 }}>Copy to Clipboard</span>
                       </button>
                   </div>

                   {recoveredCart && (
                       <p className="text-center" style={{ fontSize: 12, color: '#b5651d', fontStyle: 'italic' }}>
                           Recovered your previous order request
                       </p>
                   )}

                   <p className="text-center" style={{ fontSize: 11, color: '#6a6050', fontStyle: 'italic' }}>
                       Sending this message will initiate your order request with Teajia.
                   </p>
               </div>
           )}
        </div>

        {/* Footer */}
        <div className="p-6 relative z-20" style={{
          borderTop: '1px solid rgba(200,170,120,0.08)',
          background: '#1e1d1b'
        }}>
            {step === 'CART' && (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center" style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 300, color: '#ede6d8' }}>
                        <span>Total</span>
                        <span className="num">{fmtPrice(subtotal)}</span>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={cart.length === 0}
                        className="w-full py-3.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(181,101,29,0.15)',
                          border: '1px solid rgba(181,101,29,0.3)',
                          color: '#d4a574',
                          fontSize: 11,
                          fontWeight: 400,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const,
                          borderRadius: 4,
                        }}
                    >
                        Request This Order
                    </button>
                </div>
            )}

            {step === 'CHECKOUT' && (
                <p className="text-center" style={{ fontSize: 11, color: '#6a6050' }}>
                    Send your order inquiry via WhatsApp, Email, or copy to clipboard
                </p>
            )}
        </div>

      </div>
    </>
  );
};
