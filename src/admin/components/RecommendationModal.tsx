import React, { useState, useMemo } from 'react';
import { X, Check, Copy, MessageCircle, Leaf, Search } from 'lucide-react';
import { Customer, Product } from '../types';

interface CustomerTeaRef {
  id: string;
}

interface RecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  products: Product[];
  triedTeaIds: string[];
  preferredTypes: string[];
  lastEventTitle?: string;
}

export const RecommendationModal: React.FC<RecommendationModalProps> = ({
  isOpen, onClose, customer, products, triedTeaIds, preferredTypes, lastEventTitle,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  const eligible = useMemo(() =>
    products
      .filter(p => p.status === 'Active' && p.type !== 'Teaware' && (p.stockGrams > 0 || (p.quantityUnits ?? 0) > 0))
      .filter(p => !search || (p.givenName + ' ' + p.productName + ' ' + p.type + ' ' + p.originRegion).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aMatch = preferredTypes.includes(a.type) ? 0 : 1;
        const bMatch = preferredTypes.includes(b.type) ? 0 : 1;
        return aMatch - bMatch;
      }),
    [products, preferredTypes, search]
  );

  const selectedData = useMemo(() =>
    selected.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[],
    [selected, products]
  );

  const whatsappHandle =
    customer.contacts.find(c => c.channel === 'whatsapp')?.handle ||
    customer.whatsapp ||
    customer.phone;

  const firstName = customer.name.split(' ')[0];

  const message = useMemo(() => {
    if (selectedData.length === 0) return '';
    const lines: string[] = [];
    lines.push(`Hi ${firstName}! 🍵`);
    lines.push('');
    if (lastEventTitle) {
      lines.push(`Following our session at ${lastEventTitle}, I thought of a few teas you'd enjoy:`);
    } else {
      lines.push(`I've been thinking about teas I'd love for you to try:`);
    }
    lines.push('');
    for (const p of selectedData) {
      const name = p.givenName || p.productName;
      const detail = [p.type, p.originRegion].filter(Boolean).join(', ');
      lines.push(`• ${name}${detail ? ` — ${detail}` : ''}`);
      if (p.tastingNotes?.length) {
        lines.push(`  ${p.tastingNotes.slice(0, 2).join(', ')}`);
      }
    }
    if (note.trim()) {
      lines.push('');
      lines.push(note.trim());
    }
    lines.push('');
    lines.push(`Interested in any of these? I can arrange a sample or put together an order.`);
    return lines.join('\n');
  }, [selectedData, firstName, lastEventTitle, note]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = whatsappHandle && selected.length > 0
    ? `https://wa.me/${whatsappHandle.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null;

  const toggle = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="bg-tea-bg border border-tea-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border flex-shrink-0">
          <div>
            <h3 className="font-serif text-tea-text text-lg">Recommend to {firstName}</h3>
            {lastEventTitle && (
              <p className="text-tea-text-sec text-xs mt-0.5">Following {lastEventTitle}</p>
            )}
          </div>
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Product list */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search teas…"
                  className="w-full bg-tea-surface border border-tea-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-tea-text focus:outline-none focus:border-tea-gold/50 placeholder:text-tea-text-dim"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1.5">
              {eligible.map(p => {
                const isSelected = selected.includes(p.id);
                const isTried = triedTeaIds.includes(p.id);
                const isMatch = preferredTypes.includes(p.type);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'bg-tea-gold/8 border-tea-gold/25'
                        : 'bg-tea-surface border-tea-border hover:bg-tea-elevated'
                    }`}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-tea-elevated shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-tea-text truncate">{p.givenName || p.productName}</span>
                        {isMatch && <Leaf size={9} className="text-tea-gold shrink-0" />}
                      </div>
                      <p className="text-ui-11 text-tea-text-sec">{[p.type, p.originRegion].filter(Boolean).join(' · ')}</p>
                      {isTried && <p className="text-ui-10 text-tea-text-dim">already tried</p>}
                    </div>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-tea-gold border-tea-gold text-tea-bg' : 'border-tea-border'
                    }`}>
                      {isSelected && <Check size={10} />}
                    </div>
                  </button>
                );
              })}
              {eligible.length === 0 && (
                <p className="text-center py-8 text-tea-text-dim text-sm">No teas match</p>
              )}
            </div>
          </div>

          {/* Message panel */}
          <div className="md:w-68 border-t md:border-t-0 md:border-l border-tea-border flex flex-col p-4 gap-3 flex-shrink-0 overflow-y-auto" style={{ minWidth: '260px' }}>
            <div>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-1.5">Personal note</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a personal note…"
                rows={3}
                className="w-full bg-tea-surface border border-tea-border rounded-lg p-2.5 text-sm text-tea-text resize-none focus:outline-none focus:border-tea-gold/50 placeholder:text-tea-text-dim"
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-1.5">
                Message preview
                {selected.length > 0 && <span className="ml-2 normal-case text-tea-text-dim">{selected.length} tea{selected.length !== 1 ? 's' : ''}</span>}
              </p>
              <pre className="flex-1 text-ui-11 text-tea-text-sec leading-relaxed whitespace-pre-wrap bg-tea-surface rounded-lg p-2.5 overflow-y-auto font-sans min-h-[100px]">
                {selected.length === 0
                  ? <span className="text-tea-text-dim">Select teas above to build the message</span>
                  : message}
              </pre>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleCopy}
                disabled={selected.length === 0}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-tea-elevated text-tea-text-sec hover:text-tea-text text-sm transition-colors disabled:opacity-30"
              >
                <Copy size={13} />
                {copied ? 'Copied!' : 'Copy message'}
              </button>
              <a
                href={whatsappUrl || '#'}
                onClick={e => { if (!whatsappUrl) e.preventDefault(); }}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/15 text-sm transition-colors ${
                  !whatsappUrl ? 'pointer-events-none opacity-30' : ''
                }`}
              >
                <MessageCircle size={13} />
                Open in WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
