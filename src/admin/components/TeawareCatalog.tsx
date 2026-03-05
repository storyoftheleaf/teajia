import React from 'react';
import { Loader2, Plus, EyeOff, Sparkles, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product, Currency, ExchangeRate } from '../types';
import { formatCurrency } from '../utils';
import { TeaIllustration } from './TeaIllustration';

interface TeawareCardProps {
  product: Product;
  currency: Currency;
  rates: ExchangeRate[];
  onAdd: (product: Product) => void;
  isAdmin: boolean;
}

const TeawareCard: React.FC<TeawareCardProps> = ({ product, currency, rates, onAdd, isAdmin }) => (
  <motion.div 
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    }}
    className="group relative border border-tea-border bg-tea-surface overflow-hidden hover:border-tea-muted/50 transition-all duration-500 flex flex-col rounded-2xl shadow-2xl"
  >
    <div className="aspect-[4/3] overflow-hidden relative bg-tea-bg/50 flex items-center justify-center">
      {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.givenName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" />
      ) : (
          <div className="w-1/2 h-1/2 opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-700">
              <TeaIllustration type={product.type} />
          </div>
      )}
      <button onClick={() => onAdd(product)} className="absolute bottom-4 right-4 bg-tea-accent text-tea-bg p-3 rounded-full shadow-2xl opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-110" title="Add to Invoice">
        <Plus size={20} />
      </button>
    </div>
    <div className="p-6 flex-1 flex flex-col justify-between">
      <div>
        <h3 className="font-serif text-xl text-tea-text tracking-wide flex items-center gap-2">
            {product.givenName}
            {isAdmin && !product.isPublic && (
                <EyeOff size={16} className="text-tea-muted/70" />
            )}
            {product.showWisdom && product.lore && (
                <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                    {product.isCustomWisdom ? (
                        <Pencil size={12} className="text-tea-accent" />
                    ) : (
                        <Sparkles size={12} className="text-tea-muted" />
                    )}
                </span>
            )}
        </h3>
        <p className="text-[10px] text-tea-muted uppercase tracking-[0.2em] mt-2">{product.originRegion}</p>
      </div>
      <div className="mt-6 pt-6 border-t border-tea-border flex justify-between items-end">
        <p className="text-sm text-tea-muted line-clamp-2 pr-4 font-light leading-relaxed">{product.description}</p>
        <p className="font-mono text-lg text-tea-text whitespace-nowrap">{formatCurrency(product.pricePerGramUSD, currency, rates)}</p>
      </div>
    </div>
  </motion.div>
);

export const TeawareCatalog = ({ products, currency, rates, onAdd, loading, isAdmin }: { products: Product[], currency: Currency, rates: ExchangeRate[], onAdd: (p: Product) => void, loading: boolean, isAdmin: boolean }) => {
  // Filter for Active Teaware items only
  const teaware = products.filter(p => {
    if (p.type !== 'Teaware' || p.status !== 'Active') return false;
    if (!isAdmin && !p.isPublic) return false;
    return true;
  });

  if (loading) {
    return <div className="p-12 text-center text-tea-muted flex justify-center items-center h-full"><Loader2 className="animate-spin mr-2" /> Loading teaware...</div>;
  }

  return (
    <div className="space-y-8 p-6 md:p-12 max-w-7xl mx-auto pb-24">
      <div className="border-b border-tea-border pb-8">
        <h2 className="text-4xl md:text-5xl font-serif text-tea-text mb-2 tracking-tight">Teaware Collection</h2>
        <p className="text-tea-muted max-w-lg font-light tracking-wide">Handcrafted vessels and implements.</p>
      </div>
      
      {teaware.length === 0 ? (
          <div className="text-center py-24 text-tea-muted border border-tea-border rounded-2xl bg-tea-surface/50">
              <p className="font-serif italic text-lg">No active teaware items found.</p>
          </div>
      ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.1 } },
              hidden: {}
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {teaware.map(product => (
              <TeawareCard key={product.id} product={product} currency={currency} rates={rates} onAdd={onAdd} isAdmin={isAdmin} />
            ))}
          </motion.div>
      )}
    </div>
  );
};