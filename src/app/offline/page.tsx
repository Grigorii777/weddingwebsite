'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const LABELS: Record<string, string> = {
    '/': 'Главная', '/about': 'О нас', '/our-story': 'Наша история', '/wedding-party': 'Наши близкие',
    '/schedule': 'Программа', '/photos': 'Фотографии', '/rsvp': 'RSVP', '/registry': 'Подарки',
    '/admin': 'Управление', '/admin/honeymoon': 'Свадебное путешествие', '/admin/honeymoon/today': 'Путешествие · Сегодня',
    '/admin/honeymoon/itinerary': 'Путешествие · Маршрут', '/admin/honeymoon/files': 'Путешествие · Файлы',
    '/admin/rsvps': 'RSVPs', '/admin/finances': 'Финансы', '/admin/seating': 'План рассадки',
};

/** A readable name for any saved page: "/admin/wip-control" → "Admin · Wip control". */
function labelOf(path: string): string {
    if (LABELS[path]) return LABELS[path];
    const parts = path.split('/').filter(Boolean)
        .map((part) => part.replace(/-/g, ' '))
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
    return parts.join(' · ') || 'Главная';
}

/**
 * What a page that was never saved falls back to, with no connection.
 *
 * Lists what *is* saved on this device, so there is always somewhere to go.
 */
export default function OfflinePage() {
    const [saved, setSaved] = useState<string[] | null>(null);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!('caches' in window)) { setSaved([]); return; }
        caches.open('site-pages-v1')
            .then((cache) => cache.keys())
            .then((keys) => setSaved(keys.map((key) => new URL(key.url).pathname)
                .filter((path) => path !== '/offline')
                .sort((a, b) => a.localeCompare(b))))
            .catch(() => setSaved([]));
    }, []);

    return (
        <div className="mx-auto max-w-xl px-6 py-16">
            <h1 className="text-3xl font-serif text-gray-900">Нет подключения к интернету</h1>
            <p className="mt-3 text-gray-600">
                Эта страница ещё не сохранена на устройстве. Для её открытия нужен интернет.
                {saved && saved.length > 0 && ' Доступные страницы:'}
            </p>
            {saved && saved.length > 0 && (
                <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {saved.map((path) => (
                        <li key={path}>
                            <Link
                                href={path}
                                className="flex min-h-11 items-center rounded-2xl border border-gray-200 bg-white px-4 text-sm text-gray-800 hover:bg-gray-50"
                            >
                                {labelOf(path)}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <p className="mt-8 text-sm text-gray-500">
                Откройте установленное приложение с интернетом, чтобы сохранить весь сайт.
            </p>
        </div>
    );
}
