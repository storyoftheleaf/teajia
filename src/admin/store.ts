import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Currency, Product } from './types';

interface AppState {
  // Cart State
  cart: CartItem[];
  isCartOpen: boolean;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
  setIsCartOpen: (isOpen: boolean) => void;

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
      cart: [],
      isCartOpen: false,
      currency: 'USD',
      isDevAdmin: false,
      aiPromptTemplate: 'You are a poetic but grounded tea master. Write 2-3 sentences of historical or geographical lore about the tea named "{{productName}}" of type "{{type}}". Provide exactly 3-4 distinct sensory tasting notes. Also, provide the traditional Chinese name for this tea (if applicable) and its specific origin region (e.g., "Anxi, Fujian, China" or "Alishan, Taiwan"). Additionally, provide processing notes (e.g. "Heavy charcoal roast over pine wood."), a mood (e.g. "Grounding & Meditative"), an experience description (e.g. "A deeply centering tea..."), and a liquor color (e.g. "Deep Amber"). Do not be overly pretentious; focus on terroir, history, and clear flavors. Return the response in JSON format.',

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
                product,
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

      setCurrency: (currency) => set({ currency }),

      toggleDevAdmin: () => set((state) => ({ isDevAdmin: !state.isDevAdmin })),
      
      setDevAdmin: (isAdmin) => set({ isDevAdmin: isAdmin }),

      setAiPromptTemplate: (prompt) => set({ aiPromptTemplate: prompt }),
    }),
    {
      name: 'teajia-storage',
      partialize: (state) => ({ cart: state.cart, currency: state.currency, aiPromptTemplate: state.aiPromptTemplate }),
    }
  )
);
