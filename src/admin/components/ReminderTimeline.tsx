import React, { useState } from 'react';
import { Edit3, Send, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import { useToast } from './Toast';
import { TeaEvent, ReminderMilestone } from '../../types/events';

interface ReminderTimelineProps {
  event: TeaEvent;
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function subtractHours(dateStr: string, hours: number): Date {
  const d = new Date(dateStr);
  d.setHours(d.getHours() - hours);
  return d;
}

function formatScheduledDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildMilestones(event: TeaEvent): ReminderMilestone[] {
  const eventDate = event.eventDate;
  const title = event.title;
  const locationHint = event.areaHint || event.locationName || 'the venue';
  const slug = event.slug;
  const eventUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/event/${slug}`;

  return [
    {
      key: '3d',
      label: '3 days before',
      scheduledAt: addDays(eventDate, -3).toISOString(),
      sent: false,
      messageTemplate: `Hi! Teajia reminder, "${title}" is coming up this week.\n\nYour seat is confirmed. We'll send the full address 24h before.\n\nLooking forward to sitting together. 🍵`,
    },
    {
      key: '1d',
      label: '1 day before',
      scheduledAt: addDays(eventDate, -1).toISOString(),
      sent: false,
      messageTemplate: `Hi! Teajia reminder, "${title}" is tomorrow.\n\nVenue: ${locationHint}\nFull details: ${eventUrl}\n\nSee you soon!`,
    },
    {
      key: '2h',
      label: '2 hours before',
      scheduledAt: subtractHours(eventDate, 2).toISOString(),
      sent: false,
      messageTemplate: `Hi! Teajia reminder, "${title}" starts in about 2 hours.\n\nNo rush, take your time getting here. We'll be ready for you. 🍵`,
    },
  ];
}

export const ReminderTimeline: React.FC<ReminderTimelineProps> = ({ event }) => {
  const { showToast } = useToast();
  const [milestones, setMilestones] = useState<ReminderMilestone[]>(() =>
    buildMilestones(event)
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const updateMessage = (key: string, text: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.key === key ? { ...m, messageTemplate: text } : m))
    );
  };

  const handleSendWhatsApp = (milestone: ReminderMilestone) => {
    const url = buildWhatsAppUrl('', milestone.messageTemplate);
    window.open(url, '_blank');
  };

  const handleCopyAll = async () => {
    const text = milestones
      .map((m) => `── ${m.label} ──\n${m.messageTemplate}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      showToast('All reminders copied', 'info');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-ui-11 uppercase tracking-[0.18em] text-tea-text-sec font-medium">
          Reminder Timeline
        </h3>
        <button
          type="button"
          onClick={handleCopyAll}
          className={`flex items-center gap-1.5 text-ui-11 transition-colors ${
            copiedAll ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
          }`}
        >
          {copiedAll ? <Check size={11} /> : <Copy size={11} />}
          Copy All
        </button>
      </div>

      <div className="space-y-3">
        {milestones.map((milestone, idx) => (
          <div key={milestone.key} className="flex gap-3 items-start">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center shrink-0 mt-1">
              <div className="w-2 h-2 rounded-full border border-tea-border bg-tea-bg" />
              {idx < milestones.length - 1 && (
                <div className="w-px flex-1 min-h-[32px] bg-tea-border/50 mt-1" />
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div>
                  <span className="text-xs text-tea-text">{milestone.label}</span>
                  <span className="text-ui-10 text-tea-text-dim ml-2">
                    ({formatScheduledDate(new Date(milestone.scheduledAt))})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingKey(editingKey === milestone.key ? null : milestone.key)
                    }
                    className="flex items-center gap-1 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    <Edit3 size={10} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(milestone)}
                    className="flex items-center gap-1 text-ui-11 text-tea-gold hover:text-tea-gold-lt transition-colors"
                  >
                    <Send size={10} /> Send →
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {editingKey === milestone.key && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={milestone.messageTemplate}
                      onChange={(e) => updateMessage(milestone.key, e.target.value)}
                      className="w-full border border-tea-border bg-transparent focus:border-tea-gold/60 outline-none text-xs text-tea-text p-2 rounded resize-none placeholder:text-tea-text-dim mt-1"
                      rows={4}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors mt-1"
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {editingKey !== milestone.key && (
                <p className="text-ui-11 text-tea-text-dim line-clamp-2 whitespace-pre-line">
                  {milestone.messageTemplate}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
