import React from 'react';
import { Calendar } from 'lucide-react';
import type { TeaEvent } from '../../types/events';

interface CalendarDownloadProps {
  event: TeaEvent;
  className?: string;
}

function generateICS(event: TeaEvent): string {
  const formatDate = (dateStr: string) =>
    new Date(dateStr)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000', '');

  const start = formatDate(event.eventDate);
  const end = event.eventEndDate
    ? formatDate(event.eventEndDate)
    : start;

  // Escape special characters for ICS format
  const escapeICS = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teajia//Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
    event.locationName ? `LOCATION:${escapeICS(event.locationName)}` : null,
    event.description ? `DESCRIPTION:${escapeICS(event.description)}` : null,
    `UID:${event.id}@teajia.com`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.filter(Boolean).join('\r\n');
}

const CalendarDownload: React.FC<CalendarDownloadProps> = ({ event, className = '' }) => {
  const handleDownload = () => {
    const icsContent = generateICS(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.slug || 'teajia-event'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className={`inline-flex items-center gap-3 px-6 py-3 bg-tea-surface border border-tea-border rounded-md text-tea-text hover:border-tea-gold/40 hover:text-tea-gold transition-all duration-300 group ${className}`}
    >
      <Calendar className="w-4 h-4 text-tea-text-sec group-hover:text-tea-gold transition-colors duration-300" />
      <span className="text-xs uppercase tracking-[0.2em] font-medium">
        Add to Calendar
      </span>
    </button>
  );
};

export default CalendarDownload;
