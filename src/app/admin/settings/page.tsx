'use client';

import { useState, useEffect, useCallback } from 'react';
import { AutosaveHeader, useAutosave } from '@/components/admin/useAutosave';
import { DEFAULT_ROOM_BLOCK_MESSAGE } from '@/lib/roomBlock';
import { effectiveRsvpMode, type RsvpModeSetting } from '@/lib/rsvpMode';

const RSVP_MODE_LABEL: Record<'link' | 'verify' | 'simple', string> = {
    link: 'Ссылка по почте',
    verify: 'Проверка по email',
    simple: 'Без проверки',
};

export default function AdminSettings() {
    const [config, setConfig] = useState({
        brideName: '',
        groomName: '',
        weddingDate: '',
        weddingTime: '',
        weddingLocation: '',
        weddingVenue: '',
        rsvpDeadline: '',
        contactEmail: '',
        roomBlockHotel: '',
        roomBlockUrl: '',
        roomBlockMessage: '',
        countdownMode: 'full',
        logoMode: false,
        rsvpMode: 'auto',
    });
    const [loaded, setLoaded] = useState(false);

    // The Email (SMTP) section. Its settings live in the stack's environment, so
    // this page only reads their state and offers a test send — nothing here
    // accepts an address, and the recipient is NOTIFICATION_EMAIL alone.
    const [emailStatus, setEmailStatus] = useState<{
        configured: boolean;
        host: string | null;
        notificationEmailSet: boolean;
    } | null>(null);
    const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        fetch('/api/admin/settings/email-status')
            .then(res => res.json())
            .then(data => setEmailStatus({
                configured: data.configured === true,
                host: typeof data.host === 'string' ? data.host : null,
                notificationEmailSet: data.notificationEmailSet === true,
            }))
            .catch(() => setEmailStatus(null));
    }, []);

    const sendTestMail = useCallback(async () => {
        setTestState('sending');
        setTestMessage('');
        try {
            const res = await fetch('/api/admin/settings/test-email', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setTestState('error');
                setTestMessage(typeof data.error === 'string' ? data.error : String(res.status));
            } else {
                setTestState('ok');
            }
        } catch {
            setTestState('error');
            setTestMessage('Не удалось отправить запрос на тестовое письмо.');
        }
    }, []);

    useEffect(() => {
        fetch('/api/admin/site-config')
            .then(res => res.json())
            // Only this page's own fields. Spreading the whole config into
            // state and posting it back overwrote every other editor's keys
            // with whatever this tab had loaded — the Colour page's save could
            // be undone by pressing Save here a minute later.
            .then(data => setConfig(prev => {
                const next = { ...prev };
                for (const key of Object.keys(prev) as (keyof typeof prev)[]) {
                    if (data[key] !== undefined) (next as Record<string, unknown>)[key] = data[key];
                }
                // Pre-fill the room-block message with the default wording so
                // it's visible and overwritable when nothing has been saved yet.
                next.roomBlockMessage = data.roomBlockMessage || DEFAULT_ROOM_BLOCK_MESSAGE;
                return next;
            }))
            .then(() => setLoaded(true));
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
        <div className="max-w-2xl">
            <AutosaveHeader
                title="Общие настройки"
                subtitle="Настройте сведения о свадьбе и оформление сайта. Изменения сохраняются автоматически."
                state={state}
                onRetry={retry}
            />

            <div className="space-y-6 bg-white p-8 rounded-2xl border border-gray-200 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Имя невесты</label>
                        <input
                            type="text"
                            value={config.brideName}
                            onChange={(e) => setConfig({ ...config, brideName: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Имя жениха</label>
                        <input
                            type="text"
                            value={config.groomName}
                            onChange={(e) => setConfig({ ...config, groomName: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Дата свадьбы</label>
                    <input
                        type="text"
                        value={config.weddingDate}
                        onChange={(e) => setConfig({ ...config, weddingDate: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                        placeholder="Например: 15 июня 2027"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Время свадьбы</label>
                    <input
                        type="text"
                        value={config.weddingTime}
                        onChange={(e) => setConfig({ ...config, weddingTime: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                        placeholder="Например: 16:00"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Вид обратного отсчёта</label>
                    <select
                        value={config.countdownMode || 'full'}
                        onChange={(e) => setConfig({ ...config, countdownMode: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                    >
                        <option value="full">Полный: дни, часы, минуты, секунды</option>
                        <option value="simple">Краткий: дни и часы</option>
                        <option value="days-only">Только дни крупным шрифтом</option>
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                        Выберите вид счётчика. В режиме «Только дни» число отображается крупнее.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Название места торжества</label>
                    <input
                        type="text"
                        value={config.weddingVenue || ''}
                        onChange={(e) => setConfig({ ...config, weddingVenue: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                        placeholder="Например: Усадьба"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Город, регион</label>
                    <input
                        type="text"
                        value={config.weddingLocation}
                        onChange={(e) => setConfig({ ...config, weddingLocation: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                    />
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <div className="bg-gradient-to-br from-accent/10 to-accent-light/20 rounded-xl p-6 mb-6 border border-accent/20">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Оформление меню</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">Использовать логотип</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Показывать свадебный логотип в меню вместо имён
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.logoMode || false}
                                    onChange={(e) => setConfig({ ...config, logoMode: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-accent"></div>
                            </label>
                        </div>
                        <div className="mt-4 p-4 bg-white/50 rounded-lg border border-accent/30">
                            <p className="text-sm text-gray-700">
                                <strong>Имена по умолчанию:</strong> В меню показаны имена невесты и жениха
                            </p>
                            <p className="text-sm text-gray-700 mt-2">
                                <strong>Логотип:</strong> В меню показан логотип. Выберите его в разделе «Фотографии» → «Сделать логотипом».
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Настройки ответов</h2>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Email для связи</label>
                        <input
                            type="email"
                            value={config.contactEmail || ''}
                            onChange={(e) => setConfig({ ...config, contactEmail: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                            placeholder="you@example.com"
                        />
                        <p className="mt-1 text-xs text-gray-500">Для связи с гостями, у которых возникли сложности с ответом.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Ответить до</label>
                        <input
                            type="date"
                            value={config.rsvpDeadline || ''}
                            onChange={(e) => setConfig({ ...config, rsvpDeadline: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                        />
                        <p className="mt-1 text-xs text-gray-500">Гости увидят эту дату и оставшееся число дней на странице ответа.</p>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Проживание и номера для гостей</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Показывается после ответа на приглашение. Без названия отеля карточка скрыта.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Название отеля или блока номеров</label>
                            <input
                                type="text"
                                value={config.roomBlockHotel || ''}
                                onChange={(e) => setConfig({ ...config, roomBlockHotel: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                                placeholder="Например: Гостиница у парка"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ссылка на бронирование</label>
                            <input
                                type="url"
                                value={config.roomBlockUrl || ''}
                                onChange={(e) => setConfig({ ...config, roomBlockUrl: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                                placeholder="https://www.choicehotels.com/reservations/groups/tk74b5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Текст о проживании</label>
                            <textarea
                                rows={5}
                                value={config.roomBlockMessage || ''}
                                onChange={(e) => setConfig({ ...config, roomBlockMessage: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border text-gray-900"
                                placeholder="Оставьте пустым для стандартного текста."
                            />
                            <div className="mt-2 text-xs text-gray-500 space-y-1">
                                <p>Текст после отправки ответа. Пустое поле использует стандартный текст. Доступные подстановки:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li><code className="text-accent font-mono">{'{names}'}</code> — имена молодожёнов</li>
                                    <li><code className="text-accent font-mono">{'{hotel}'}</code> — название отеля выше</li>
                                    <li><code className="text-accent font-mono">{'{book}'}</code> — ссылка «Забронировать номер». Адрес берётся из поля ссылки на бронирование выше.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Почта (SMTP)</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Подтверждения гостям и уведомления вам отправляются через SMTP. Реквизиты задаются в переменных окружения. Здесь можно проверить настройку и отправить тестовое письмо.
                    </p>
                    {emailStatus === null ? (
                        <p className="text-sm text-gray-500">Проверяем настройки почты…</p>
                    ) : (
                        <div className="p-4 bg-white/50 rounded-lg border border-accent/30">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        {emailStatus.configured ? `Настроено — ${emailStatus.host}` : 'Не настроено'}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {emailStatus.configured
                                            ? 'После ответа гость получит подтверждение, а вы — уведомление.'
                                            : 'Задайте SMTP_HOST и SMTP_USER в окружении. NOTIFICATION_EMAIL указывает получателя тестового письма.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={sendTestMail}
                                    disabled={testState === 'sending'}
                                    className="relative py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {testState === 'sending' ? 'Отправляем…' : 'Отправить тестовое письмо'}
                                </button>
                            </div>
                            <p className="mt-3 text-sm text-gray-500">
                                Получатель теста (NOTIFICATION_EMAIL): {emailStatus.notificationEmailSet ? 'указан' : 'не указан'}
                            </p>
                            {testState === 'ok' && (
                                <p className="mt-2 text-sm text-green-600">Тестовое письмо отправлено на адрес уведомлений.</p>
                            )}
                            {testState === 'error' && (
                                <p className="mt-2 text-sm text-red-600">{testMessage}</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Проверка ответа гостя</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Как подтверждается право изменить ответ приглашения.
                    </p>
                    <div className="space-y-3">
                        {([
                            { value: 'auto', label: 'Автоматически (рекомендуется)', help: 'Ссылка по почте при настроенном SMTP, иначе проверка по email.' },
                            { value: 'link', label: 'Ссылка по почте', help: "Самый надёжный вариант. Гость получает ссылку для каждого ответа или изменения. Требуется настроенный SMTP." },
                            { value: 'verify', label: 'Проверка по email', help: "Первый ответ доступен сразу. Для изменения нужно назвать ранее указанный email. Письмо не отправляется, владение почтой не проверяется." },
                            { value: 'simple', label: 'Без проверки (не рекомендуется)', help: 'Ответы доступны без проверки. Любой, кто знает имя, может просмотреть и изменить ответ.' },
                        ] as { value: RsvpModeSetting; label: string; help: string }[]).map((opt) => (
                            <label
                                key={opt.value}
                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                    config.rsvpMode === opt.value ? 'border-accent bg-accent/5' : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="rsvpMode"
                                    value={opt.value}
                                    checked={config.rsvpMode === opt.value}
                                    onChange={() => setConfig(prev => ({ ...prev, rsvpMode: opt.value }))}
                                    className="mt-1 h-4 w-4 text-accent focus:ring-accent"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{opt.help}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                    {config.rsvpMode === 'auto' && (
                        <p className="mt-3 text-sm text-gray-600">
                            Сейчас используется: <span className="font-medium">
                                {RSVP_MODE_LABEL[effectiveRsvpMode('auto', emailStatus?.configured ?? false)]}
                            </span>{emailStatus === null ? ' (проверяем настройки почты…)' : !emailStatus.configured ? " — SMTP ещё не настроен" : ''}
                        </p>
                    )}
                </div>
            </div>
        </div >
    );
}
