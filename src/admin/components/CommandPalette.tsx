import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Leaf, Coffee, Settings, UserCheck, History, FolderOpen, Plus } from 'lucide-react';
import { useAppStore } from '../store';

export const CommandPalette = ({ onAddProduct, externalOpen, onOpenChange }: { onAddProduct: () => void; externalOpen?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isDevAdmin } = useAppStore();

  // Sync with external open control
  useEffect(() => {
    if (externalOpen) {
      setOpen(true);
    }
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (!next) onOpenChange?.(false);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal bg-tea-text/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={handleClose}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="w-full max-w-xl bg-tea-surface border border-tea-border rounded-lg shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <Command className="w-full" label="Global Command Menu">
          <div className="flex items-center px-4 border-b border-tea-border">
            <Search className="w-5 h-5 text-tea-text-sec mr-2" />
            <Command.Input 
                autoFocus
                placeholder="Type a command or search..." 
                className="w-full bg-transparent border-none py-4 text-tea-text placeholder:text-tea-text-sec/50 focus:outline-none focus:ring-0 text-lg font-serif"
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
            <Command.Empty className="py-6 text-center text-sm text-tea-text-sec font-serif italic">No results found.</Command.Empty>

            <Command.Group heading="Navigation" className="text-[10px] uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2">
              <Command.Item onSelect={() => runCommand(() => navigate('/admin/catalog'))} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
                <Leaf size={16} className="text-tea-text-sec" /> Tea Glossary
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/admin/teaware'))} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
                <Coffee size={16} className="text-tea-text-sec" /> Equipment
              </Command.Item>
            </Command.Group>

            {isDevAdmin && (
              <Command.Group heading="Admin" className="text-[10px] uppercase tracking-[0.2em] font-bold text-tea-text-sec px-2 py-2 mt-2 border-t border-tea-border/50">
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/inventory'))} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
                  <Settings size={16} className="text-tea-text-sec" /> Master Inventory
                </Command.Item>
                <Command.Item onSelect={() => runCommand(onAddProduct)} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
                  <Plus size={16} className="text-tea-text-sec" /> Add New Product
                </Command.Item>
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/personal'))} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
                  <UserCheck size={16} className="text-tea-text-sec" /> Collection
                </Command.Item>
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/orders'))} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
                  <History size={16} className="text-tea-text-sec" /> Orders
                </Command.Item>
                <Command.Item onSelect={() => runCommand(() => navigate('/admin/records'))} className="flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-tea-surface cursor-pointer text-tea-text aria-selected:bg-tea-surface aria-selected:text-tea-accent transition-colors font-serif">
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