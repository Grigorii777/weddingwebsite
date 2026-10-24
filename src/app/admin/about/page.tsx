'use client';

import { useState, useEffect, useCallback } from 'react';
import { AutosaveHeader, useAutosave } from '@/components/admin/useAutosave';

export default function AdminAbout() {
    const [config, setConfig] = useState({
        ourStoryTitle: '',
        howWeMetTitle: '',
        ourStoryBody: '',
        venueDescription: '',
        venueAddress: '',
        ceremonyText: '',
        receptionText: '',
        aboutSubtitle: '',
    });
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetch('/api/admin/site-config')
            .then(res => res.json())
            // Only this page's keys — see Settings for why the whole config is
            // never spread into state and posted back.
            .then(data => {
                setConfig(prev => {
                    const next = { ...prev };
                    for (const key of Object.keys(prev) as (keyof typeof prev)[]) {
                        if (typeof data[key] === 'string') next[key] = data[key];
                    }
                    return next;
                });
                setLoaded(true);
            });
    }, []);

    const save = useCallback(async (body: typeof config) => {
        const res = await fetch('/api/admin/site-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(String(res.status));
    }, []);

    const { state, retry } = useAutosave({ value: config, ready: loaded, save });

    return (
        <div className="max-w-4xl">
            <AutosaveHeader
                title="Содержимое раздела «О нас»"
                subtitle="Добавьте вашу историю и сведения о месте торжества. Изменения сохраняются автоматически."
                state={state}
                onRetry={retry}
            />

            <div className="space-y-8 bg-white p-8 rounded-2xl border border-gray-200 shadow-lg">

                {/* Story Section */}
                <div className="space-y-6 bg-gradient-to-br from-accent/5 to-accent-light/10 rounded-xl p-6 border border-accent/10">
                    <h2 className="text-xl font-semibold text-gray-900">Наша история</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Заголовок страницы</label>
                        <input
                            type="text"
                            value={config.ourStoryTitle || ''}
                            onChange={(e) => setConfig({ ...config, ourStoryTitle: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Например: Случайная встреча..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Заголовок раздела «Как мы познакомились»</label>
                        <input
                            type="text"
                            value={config.howWeMetTitle || ''}
                            onChange={(e) => setConfig({ ...config, howWeMetTitle: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Например: Как мы познакомились, Начало нашей истории"
                        />
                        <p className="text-xs text-gray-500 mt-1">Заголовок над вашей историей. Если оставить пустым, появится «Как мы познакомились».</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">История знакомства</label>
                        <p className="text-xs text-gray-500 mb-2">Расскажите вашу историю. Можно использовать несколько абзацев.</p>
                        <textarea
                            rows={8}
                            value={config.ourStoryBody || ''}
                            onChange={(e) => setConfig({ ...config, ourStoryBody: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Ваша история..."
                        />
                    </div>
                </div>

                {/* Venue Section */}
                <div className="space-y-6 bg-gradient-to-br from-accent/5 to-accent-light/10 rounded-xl p-6 border border-accent/10">
                    <h2 className="text-xl font-semibold text-gray-900">Место торжества</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Описание места</label>
                        <textarea
                            rows={3}
                            value={config.venueDescription || ''}
                            onChange={(e) => setConfig({ ...config, venueDescription: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Краткое описание места..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Адрес для карты</label>
                        <p className="text-xs text-gray-500 mb-2">Укажите адрес, чтобы на сайте появилась ссылка «Построить маршрут».</p>
                        <input
                            type="text"
                            value={config.venueAddress || ''}
                            onChange={(e) => setConfig({ ...config, venueAddress: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Например: Москва, Садовая улица, 10"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Текст блока «Церемония»</label>
                        <p className="text-xs text-gray-500 mb-2">Текст под описанием места в блоке «Церемония».</p>
                        <textarea
                            rows={3}
                            value={config.ceremonyText || ''}
                            onChange={(e) => setConfig({ ...config, ceremonyText: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Например: Церемония начнётся в 16:00 на территории усадьбы."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Текст блока «Праздничный ужин»</label>
                        <p className="text-xs text-gray-500 mb-2">Текст под описанием места в блоке «Праздничный ужин».</p>
                        <textarea
                            rows={3}
                            value={config.receptionText || ''}
                            onChange={(e) => setConfig({ ...config, receptionText: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="Например: После церемонии вас ждут ужин и танцы."
                        />
                    </div>
                </div>

                {/* Nav Card Subtitle */}
                <div className="space-y-4 bg-gradient-to-br from-accent/5 to-accent-light/10 rounded-xl p-6 border border-accent/10">
                    <h2 className="text-xl font-semibold text-gray-900">Подпись карточки раздела</h2>
                    <p className="text-sm text-gray-500">Краткая подпись карточки «О нас» внизу главной страницы.</p>
                    <input
                        type="text"
                        value={config.aboutSubtitle || ''}
                        onChange={(e) => setConfig({ ...config, aboutSubtitle: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                        placeholder="Например: Как всё начиналось"
                    />
                </div>
            </div>
        </div>
    );
}
