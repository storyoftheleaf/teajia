import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem as AdminCartItem, Currency, Product } from '../admin/types';
import { CartItem as PublicCartItem } from '../types';

interface AppState {
  // Admin Cart (for invoice builder)
  cart: AdminCartItem[];
  isCartOpen: boolean;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setCart: (cart: AdminCartItem[]) => void;
  setIsCartOpen: (isOpen: boolean) => void;

  // Public Cart (for customer checkout)
  publicCart: PublicCartItem[];
  isPublicCartOpen: boolean;
  addToPublicCart: (item: PublicCartItem) => void;
  removeFromPublicCart: (id: string) => void;
  updatePublicCartQuantity: (id: string, grams: number) => void;
  clearPublicCart: () => void;
  setIsPublicCartOpen: (isOpen: boolean) => void;

  // Global Settings
  currency: Currency;
  setCurrency: (currency: Currency) => void;

  // Admin State
  isDevAdmin: boolean;
  toggleDevAdmin: () => void;
  setDevAdmin: (isAdmin: boolean) => void;

  // AI Settings
  aiPromptTemplate: string;
  setAiPromptTemplate: (prompt: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Admin Cart
      cart: [],
      isCartOpen: false,

      addToCart: (product, quantity) =>
        set((state) => {
          const existingItem = state.cart.find((item) => item.productId === product.id);
          if (existingItem) {
            return {
              cart: state.cart.map((item) =>
                item.productId === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return {
            cart: [
              ...state.cart,
              {
                productId: product.id,
                quantity,
                priceAtSale: product.pricePerGramUSD,
                product: { ...product },
              },
            ],
          };
        }),

      removeFromCart: (productId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.productId === productId ? { ...item, quantity } : item
          ),
        })),

      clearCart: () => set({ cart: [] }),
      setCart: (cart) => set({ cart }),
      setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),

      // Public Cart
      publicCart: [],
      isPublicCartOpen: false,

      addToPublicCart: (item) =>
        set((state) => {
          const existing = state.publicCart.find((c) => c.id === item.id);
          if (existing) {
            const newGrams = existing.quantityGrams + item.quantityGrams;
            return {
              publicCart: state.publicCart.map((c) =>
                c.id === item.id
                  ? { ...c, quantityGrams: newGrams, totalPrice: c.pricePerGram * newGrams }
                  : c
              ),
            };
          }
          return { publicCart: [...state.publicCart, item] };
        }),

      removeFromPublicCart: (id) =>
        set((state) => ({
          publicCart: state.publicCart.filter((item) => item.id !== id),
        })),

      updatePublicCartQuantity: (id, grams) =>
        set((state) => ({
          publicCart: state.publicCart.map((item) =>
            item.id === id
              ? { ...item, quantityGrams: grams, totalPrice: item.pricePerGram * grams }
              : item
          ),
        })),

      clearPublicCart: () => set({ publicCart: [] }),
      setIsPublicCartOpen: (isOpen) => set({ isPublicCartOpen: isOpen }),

      // Global Settings
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),

      // Admin State
      isDevAdmin: false,
      toggleDevAdmin: () => set((state) => ({ isDevAdmin: !state.isDevAdmin })),
      setDevAdmin: (isAdmin) => set({ isDevAdmin: isAdmin }),

      // AI Settings
      aiPromptTemplate: 'You are a poetic but grounded tea master. Write 2-3 sentences of historical or geographical lore about the tea named "{{productName}}" of type "{{type}}". Provide exactly 3-4 distinct sensory tasting notes. Also, provide the traditional Chinese name for this tea (if applicable) and its specific origin region (e.g., "Anxi, Fujian, China" or "Alishan, Taiwan"). Additionally, provide processing notes (e.g. "Heavy charcoal roast over pine wood."), a mood (e.g. "Grounding & Meditative"), an experience description (e.g. "A deeply centering tea..."), and a liquor color (e.g. "Deep Amber"). Do not be overly pretentious; focus on terroir, history, and clear flavors. Return the response in JSON format.',
      setAiPromptTemplate: (prompt) => set({ aiPromptTemplate: prompt }),
    }),
    {
      name: 'teajia-storage',
      partialize: (state) => ({
        cart: state.cart,
        publicCart: state.publicCart,
        currency: state.currency,
        aiPromptTemplate: state.aiPromptTemplate,
      }),
    }
  )
);
