import React, { useState, useEffect, useMemo } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Leaf, Coffee, Settings, UserCheck, History, FolderOpen, Plus, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';
import { api } from '../../lib/api';

export const CommandPalette = ({ onAddProduct, externalOpen, onOpenChange }: { onAddProduct: () => void; externalOpen?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const { isDevAdmin } = useAppStore();

  // Sync with external open control (both directions)
  useEffect(() => {
    if (externalOpen !== undefined) setOpen(externalOpen);
  }, [externalOpen]);

  // Load data when palette opens
  useEffect(() => {
    if (open && !loaded) {
      Promise.all([
        api.products.list().catch(() => []),
        api.customers.list().catch(() => []),
        api.events.listAdmin().catch(() => []),
      ]).then(([prods, custs, evts]) => {
        setProducts(Array.isArray(prods) ? prods : prods.products || []);
        setCustomers(Array.isArray(custs) ? custs : custs.customers || []);
        setEvents(Array.isArray(evts) ? evts : evts.events || []);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  const handleClose = () => {
    setOpen(false);
    setSearchQuery('');
    onOpenChange?.(false);
  };

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (!next) {
            setSearchQuery('');
            onOpenChange?.(false);
          }
          return next;
        });
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onOpenChange]);

  const runCommand = (command: () => void) => {
    handleClose();
    command();
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter((p: any) =>
        (p.givenName || '').toLowerCase().includes(q) ||
        (p.productName || '').toLowerCase().includes(q) ||
        (p.type || '').toLowerCase().includes(q) ||
        (p.originRegion || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [searchQuery, products]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return customers
      .filter((c: any) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [searchQuery, customers]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return events
      .filter((e: any) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.location_name || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [searchQuery, events]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={handleClose}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="w-full max-w-xl bg-tea-surface border border-tea-border rounded-xl shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <Command className="w-full" label="Global Command Menu">
          <div className="flex items-center px-4 border-b border-tea-border">
            <Search className="w-5 h-5 text-tea-text-sec mr-2" />
            <Command.Input
                autoFocus
                placeholder="Search products, customers, events..."
                className="w-full bg-transparent border-none py-4 text-tea-text placeholder:text-tea-text-sec/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:ring-0 text-lg font-serif"
                value={searchQuery}
                onValueChange={setSearchQuery}
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
            <Command.Empty className="py-6 text-center text-sm text-tea-text-sec font-serif italic">Nothing matched — try different words.</Command.Empty>

            {/* Search Results */}
            {searchQuery.trim() && (
              <>
                {filteredProducts.length > 0 && (
                  <Command.Group heading="Products" className="text-ui-10 uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2">
                    {filteredProducts.map((p: any) => (
                      <Command.Item
                        key={`product-${p.id}`}
                        value={`product ${p.givenName} ${p.productName}`}
                        onSelect={() => runCommand(() => navigate(`/admin/inventory?search=${encodeURIComponent(p.givenName || p.productName)}`))}
                        className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-elevated cursor-pointer text-tea-text aria-selected:bg-tea-elevated aria-selected:text-tea-text transition-colors"
                      >
                        <span className="flex items-center gap-2 w-full">
                          <span className="text-xs font-mono text-tea-text-dim w-12 shrink-0">Tea</span>
                          <span className="text-sm font-sans text-tea-text truncate">{p.givenName || p.productName}</span>
                          <span className="text-xs font-sans text-tea-text-dim ml-auto">{p.type}{p.originRegion ? ` · ${p.originRegion}` : ''}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {filteredCustomers.length > 0 && (
                  <Command.Group heading="People" className="text-ui-10 uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2">
                    {filteredCustomers.map((c: any) => (
                      <Command.Item
                        key={`customer-${c.id}`}
                        value={`customer ${c.name} ${c.email}`}
                        onSelect={() => runCommand(() => navigate(`/admin/people?search=${encodeURIComponent(c.name)}`))}
                        className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-elevated cursor-pointer text-tea-text aria-selected:bg-tea-elevated aria-selected:text-tea-text transition-colors"
                      >
                        <span className="flex items-center gap-2 w-full">
                          <span className="text-xs font-mono text-tea-text-dim w-12 shrink-0">Person</span>
                          <span className="text-sm font-sans text-tea-text truncate">{c.name}</span>
                          {c.company && <span className="text-xs font-sans text-tea-text-dim ml-auto">{c.company}</span>}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {filteredEvents.length > 0 && (
                  <Command.Group heading="Events" className="text-ui-10 uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2">
                    {filteredEvents.map((e: any) => (
                      <Command.Item
                        key={`event-${e.id}`}
                        value={`event ${e.title}`}
                        onSelect={() => runCommand(() => navigate(`/admin/events/${e.id}`))}
                        className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-elevated cursor-pointer text-tea-text aria-selected:bg-tea-elevated aria-selected:text-tea-text transition-colors"
                      >
                        <span className="flex items-center gap-2 w-full">
                          <span className="text-xs font-mono text-tea-text-dim w-12 shrink-0">Event</span>
                          <span className="text-sm font-sans text-tea-text truncate">{e.title}</span>
                          <span className="text-xs font-sans text-tea-text-dim ml-auto">
                            {e.event_date ? new Date(e.event_date).toLocaleDateString() : ''}
                          </span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}

            <Command.Group heading="Navigation" className="text-ui-10 uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2">
              <Command.Item onSelect={() => runCommand(() => navigate('/admin/tasting-events/new'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                <Sparkles size={16} className="text-tea-text-sec" /> New tasting event
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/admin/tasting-events'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                <Coffee size={16} className="text-tea-text-sec" /> Tasting events
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/admin/inventory'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                <Leaf size={16} className="text-tea-text-sec" /> Tea Glossary
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/admin/inventory'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                <Coffee size={16} className="text-tea-text-sec" /> Equipment
              </Command.Item>
            </Command.Group>

            {isDevAdmin && (
              <Command.Group heading="Admin" className="text-ui-10 uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2 mt-2 border-t border-tea-border">
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/inventory'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                  <Settings size={16} className="text-tea-text-sec" /> Master Inventory
                </Command.Item>
                <Command.Item onSelect={() => runCommand(onAddProduct)} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                  <Plus size={16} className="text-tea-text-sec" /> Add New Product
                </Command.Item>
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/inventory'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                  <UserCheck size={16} className="text-tea-text-sec" /> Collection
                </Command.Item>
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/activity?tab=orders'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                  <History size={16} className="text-tea-text-sec" /> Orders
                </Command.Item>
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/activity?tab=archive'))} className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-gold transition-colors font-serif">
                  <FolderOpen size={16} className="text-tea-text-sec" /> Records & Logs
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
