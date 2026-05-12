import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';
import { EventsManager } from './EventsManager';
import { VenueManager } from './VenueManager';

type GatherTab = 'events' | 'venues';

export const GatherHub: React.FC = () => {
  const tabs: { id: GatherTab; label: string; icon: React.ReactNode }[] = [
    { id: 'events', label: 'Events', icon: <Calendar size={15} /> },
    { id: 'venues', label: 'Venues', icon: <MapPin size={15} /> },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as GatherTab | null;
  const activeTab: GatherTab = rawTab && tabs.find(t => t.id === rawTab) ? rawTab : 'events';
  const setActiveTab = (tab: GatherTab) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="px-3 md:px-6 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-tea-text border-tea-gold' : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'events' && <EventsManager />}
        {activeTab === 'venues' && <VenueManager />}
      </div>
    </div>
  );
};
