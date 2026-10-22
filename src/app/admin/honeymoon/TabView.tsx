'use client';

import ChecklistTab from './ChecklistTab';
import DashboardTab from './DashboardTab';
import FilesTab from './FilesTab';
import GuideTab from './GuideTab';
import { useHoneymoonApi } from './HoneymoonContext';
import ItineraryTab from './ItineraryTab';
import MapTab from './MapTab';
import PlacesHub from './PlacesHub';
import SettingsTab from './SettingsTab';
import TodayTab from './TodayTab';
import TravelTab from './TravelTab';
import { tabPath } from './kit/navigate';

/**
 * The tab for the current path, drawn by the shell rather than by the router.
 *
 * Mirrors each route's `page.tsx` one for one — those still render on a fresh
 * load — so a tab switched to with `goTab()` (no server round trip) and the
 * same tab loaded from its URL are the same component with the same props.
 * Anything not listed falls back to the router's page.
 */
export default function TabView({ pathname, children }: { pathname: string | null; children: React.ReactNode }) {
    const api = useHoneymoonApi();
    switch (tabPath(pathname ?? '')) {
        case '/admin/honeymoon': return <DashboardTab api={api} />;
        case '/admin/honeymoon/today': return <TodayTab api={api} />;
        case '/admin/honeymoon/itinerary': return <ItineraryTab api={api} />;
        case '/admin/honeymoon/map': return <MapTab api={api} />;
        case '/admin/honeymoon/places': return <PlacesHub segment="all" />;
        case '/admin/honeymoon/stays': return <PlacesHub segment="stays" />;
        case '/admin/honeymoon/excursions': return <PlacesHub segment="excursions" />;
        case '/admin/honeymoon/travel': return <TravelTab api={api} />;
        case '/admin/honeymoon/checklist': return <ChecklistTab api={api} />;
        case '/admin/honeymoon/files': return <FilesTab />;
        case '/admin/honeymoon/guide': return <GuideTab api={api} />;
        case '/admin/honeymoon/settings': return <SettingsTab api={api} />;
        default: return <>{children}</>;
    }
}
