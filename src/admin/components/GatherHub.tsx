import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';
import { EventsManager } from './EventsManager';
import { VenueManager } from './VenueManager';
import { TabList, TabPanel, useTabsIds, type TabItem } from '../../components/shared/Tabs';

type GatherTab = 'events' | 'venues';

const TABS: TabItem[] = [
  { id: 'events', label: 'Events', icon: <Calendar size={15} /> },
  { id: 'venues', label: 'Venues', icon: <MapPin size={15} /> },
];

export const GatherHub: React.FC = () => {
  const tabsId = useTabsIds();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as GatherTab | null;
  const activeTab: GatherTab = rawTab && TABS.find(t => t.id === rawTab) ? rawTab : 'events';
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <TabList
        tabs={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Gather sections"
        baseId={tabsId}
        className="px-4 md:px-6 lg:px-10 bg-tea-bg flex-shrink-0"
      />

      <div className="flex-1 overflow-auto">
        <TabPanel tabId="events" baseId={tabsId} isActive={activeTab === 'events'} className="h-full">
          <EventsManager />
        </TabPanel>
        <TabPanel tabId="venues" baseId={tabsId} isActive={activeTab === 'venues'} className="h-full">
          <VenueManager />
        </TabPanel>
      </div>
    </div>
  );
};
