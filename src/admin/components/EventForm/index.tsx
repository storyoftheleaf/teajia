import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeaEvent } from '../../../types/events';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import CreateWizard from './CreateWizard';
import EditForm from './EditForm';

export interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TeaEvent;
  onSuccess: (createdEventId?: string) => void;
}

export const EventForm: React.FC<EventFormProps> = ({ isOpen, onClose, initialData, onSuccess }) => {
  const isEdit = !!initialData;
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Escape closes the panel while open.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Create mode: full-screen panel
  if (!isEdit) {
    return (
      <AnimatePresence>
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-0 sidebar-inset bg-tea-bg z-modal flex flex-col"
        >
          {/* Header, close-X on left per drawer/panel rule */}
          <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-tea-border">
            <button onClick={onClose} aria-label="Close" className="text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target">
              <X size={16} />
            </button>
            <h3 className="h3 text-tea-text">Create Event</h3>
          </div>
          <div className="flex-1 min-h-0">
            <CreateWizard onClose={onClose} onSuccess={onSuccess} />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Edit mode: full-screen (same pattern as create)
  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="fixed inset-0 sidebar-inset bg-tea-bg z-modal flex flex-col"
      >
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-tea-border">
          <button onClick={onClose} aria-label="Close" className="text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target">
            <X size={16} />
          </button>
          <h3 className="h3 text-tea-text">Edit Event</h3>
        </div>
        <div className="flex-1 min-h-0">
          <EditForm
            initialData={initialData!}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
