/**
 * Line icons for the portal's phone chrome.
 *
 * Drawn in the same style as Jarvis's navigation (24×24, a 2px round stroke,
 * `currentColor`), so the tab bar reads as one family instead of five emoji in
 * five different artists' hands. The emoji rendered differently on every phone
 * and could not change colour with the active tab, which is the one thing a
 * navigation icon has to do.
 */
type IconName =
    | 'today' | 'itinerary' | 'map' | 'places' | 'more'
    | 'overview' | 'travel' | 'checklist' | 'files' | 'guide' | 'settings'
    | 'locate' | 'fit' | 'plus' | 'layers' | 'ruler' | 'lasso' | 'chevron';

const PATHS: Record<IconName, React.ReactNode> = {
    today: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4" /></>),
    itinerary: (<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M7.5 13.5h3M7.5 16.5h6" /></>),
    map: (<><path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6l-6-2.1Z" /><path d="M9 4.5v13M15 6.6v13" /></>),
    places: (<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>),
    more: (<><circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" /></>),
    overview: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>),
    travel: (<path d="M10.2 13.8 4 12.2l-1.2 1.2 5 2.6 2.6 5 1.2-1.2-1.6-6.2 4.6-4.6 3.6 6.9 1.4-1.4-1.3-8.7 2.2-2.2a1.8 1.8 0 0 0-2.5-2.5l-2.2 2.2-8.7-1.3L3.7 5.2l6.9 3.6-4.6 4.6" />),
    checklist: (<><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 12.2 2.7 2.7L16.2 9.4" /></>),
    files: (<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />),
    guide: (<><path d="M4 5.5A2 2 0 0 1 6 3.5h5.5v16H6a2 2 0 0 0-2 2v-16Z" /><path d="M20 5.5a2 2 0 0 0-2-2h-5.5v16H18a2 2 0 0 1 2 2v-16Z" /></>),
    settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></>),
    locate: (<><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="12" r="7.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" /></>),
    fit: (<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />),
    plus: (<path d="M12 5v14M5 12h14" />),
    layers: (<><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></>),
    ruler: (<><path d="M3.8 15.6 15.6 3.8a1.4 1.4 0 0 1 2 0l2.6 2.6a1.4 1.4 0 0 1 0 2L8.4 20.2a1.4 1.4 0 0 1-2 0l-2.6-2.6a1.4 1.4 0 0 1 0-2Z" /><path d="m8 11.4 2 2M11 8.4l2 2M14 5.4l2 2" /></>),
    lasso: (<><ellipse cx="12" cy="9.5" rx="8" ry="5.5" strokeDasharray="3 2.4" /><path d="M8.5 14.4c-1 1.6-.4 3.6 1.4 4.1 1.6.5 2.1 1.6 1.6 3" /></>),
    chevron: (<path d="m9 5.5 6.5 6.5L9 18.5" />),
};

export function Icon({ name, className = 'size-6', strokeWidth = 2 }: {
    name: IconName;
    className?: string;
    strokeWidth?: number;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            {PATHS[name]}
        </svg>
    );
}

export type { IconName };
