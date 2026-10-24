'use client';
import { counted } from '@/lib/locale';

import { useState } from 'react';
import Link from 'next/link';
import {
    addDays, daysBeyondRange, daysBetween, formatDate, formatDayDate, planRange,
} from '@/lib/honeymoon';
import { INFO_SECTIONS } from '@/lib/honeymoonToday';
import type { HoneymoonApi } from './useHoneymoon';
import { TabToolbar } from './kit/TabToolbar';
import { Hint } from './kit/Hint';
import DateRangePicker from './DateRangePicker';
import MoneySettings from './MoneySettings';
import ShareLinks from './ShareLinks';
import TripArchives from './TripArchives';
import { Button, Card, SelectField, TextArea, TextField, MiniSelect } from './ui';

/** The handful anyone planning from the US actually prices in. */
const CURRENCIES = [
    { key: 'USD', label: 'Доллар США ($)' },
    { key: 'EUR', label: 'Евро (€)' },
    { key: 'GBP', label: 'Фунт стерлингов (£)' },
    { key: 'AUD', label: 'Австралийский доллар (A$)' },
    { key: 'CAD', label: 'Канадский доллар (C$)' },
    { key: 'SGD', label: 'Сингапурский доллар (S$)' },
    { key: 'IDR', label: 'Индонезийская рупия (Rp)' },
];

export default function SettingsTab({ api }: { api: HoneymoonApi }) {
    const trip = api.data?.trip;
    const days = api.data?.days ?? [];
    const [working, setWorking] = useState(false);
    if (!trip) return null;

    /**
     * The subscribe URL, built from the first live share token.
     *
     * A calendar client cannot log in, so the feed needs a token — and inventing
     * a second kind of token for it would mean a second thing to revoke.
     */
    const feedToken = (api.data?.shares ?? []).find((share) => !share.revoked)?.token;
    const subscribeUrl = feedToken && typeof window !== 'undefined'
        ? `${window.location.origin}/api/honeymoon/feed?token=${feedToken}`
        : '';

    const lastDay = days.length ? Math.max(...days.map((d) => d.day_number)) : 0;

    /**
     * Days that now sit past the end of the trip.
     *
     * Shortening the range leaves these behind rather than deleting them, so
     * this card has to say so — otherwise the only sign would be red cards on
     * another tab you might not open.
     */
    const beyond = daysBeyondRange(
        days.map((d) => d.day_number), trip.start_date, trip.end_date,
    );

    /**
     * Set the trip's dates, and grow the day rows to fill a longer range.
     *
     * Changing the dates is **not** destructive, in either direction. A longer
     * range is the part that earns the calendar — the range *is* the trip
     * length, so it builds the missing days rather than leaving you to press
     * "+ Add day" fourteen times. A shorter range writes the dates and stops
     * there: the days you have already planned keep their stops, travel legs and
     * notes, take their new dates from the new start, and the ones that now fall
     * past the end are flagged in red on the Itinerary for you to deal with.
     *
     * It used to delete that tail behind a confirm, which is the wrong trade at
     * any level of warning: dragging a date is an ordinary, exploratory edit, and
     * an hour of planning should not be one mis-drag and one reflexive OK away
     * from being gone.
     */
    const applyRange = async (start: string, end: string) => {
        const plan = planRange(start, end, days.map((d) => d.day_number));
        setWorking(true);
        try {
            await api.update('trip', { start_date: plan.start, end_date: plan.end });
            // One transaction for the new days, not one round trip each.
            if (plan.add.length) {
                await api.createMany('days', plan.add.map((day_number) => ({ day_number })));
                await api.refresh();
            }
        } finally {
            setWorking(false);
        }
    };

    const clearDates = async () => {
        if (!confirm('Очистить даты? Дни сохранятся с номерами вместо дат.')) return;
        await api.update('trip', { start_date: '', end_date: '' });
    };

    /** The whole portal as one file, for the day a bulk edit goes wrong. */
    const download = async () => {
        const res = await fetch('/api/admin/honeymoon', { cache: 'no-store' });
        if (!res.ok) return;
        const blob = new Blob([JSON.stringify(await res.json(), null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `honeymoon-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    /** Where the trip ends according to the day rows, for a trip with no end_date. */
    const impliedEnd = trip.start_date && lastDay > 0
        ? addDays(trip.start_date, lastDay - 1)
        : null;
    const nights = daysBetween(trip.start_date, trip.end_date ?? impliedEnd);

    return (
        <>
        <TabToolbar
            left={(
                <MiniSelect
                    value=""
                    aria-label="Перейти к разделу"
                    onChange={(e) => document.getElementById(e.target.value)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                    <option value="">Перейти…</option>
                                <option key="set-when-you-re-away" value="set-when-you-re-away">Даты поездки</option>
                                <option key="set-money" value="set-money">Деньги</option>
                                <option key="set-take-it-with-you" value="set-take-it-with-you">Взять с собой</option>
                                <option key="set-emergency-amp-practical-details" value="set-emergency-amp-practical-details">Экстренные контакты и полезные сведения</option>
                                <option key="set-share-it-with-someone" value="set-share-it-with-someone">Поделиться доступом</option>
                                <option key="set-snapshots" value="set-snapshots">Снимки поездки</option>
                </MiniSelect>
            )}
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start max-w-6xl">
            {/* ---- Dates ---- */}
            <Card id="set-when-you-re-away" className="p-4 space-y-3 xl:row-span-2">
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Даты поездки</h3>
                    {working && <span className="text-xs text-gray-400">Обновляем дни…</span>}
                </div>

                {/* A trip planned before end_date existed has a start and a
                    number of days but no stored end. Deriving one from the day
                    rows shows the range that is actually already there, rather
                    than an empty calendar next to a filled-in summary. The first
                    drag then writes it down properly. */}
                <DateRangePicker
                    start={trip.start_date}
                    end={trip.end_date ?? impliedEnd}
                    onChange={applyRange}
                />

                <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                    {trip.start_date ? (
                        <>
                            <p className="text-xs text-gray-700">
                                Первый день: {formatDayDate(trip.start_date, 1)}
                                {lastDay > 1 && <> · день {lastDay}  {formatDayDate(trip.start_date, lastDay)}</>}
                                {nights != null && <> · {counted(nights, 'ночь', 'ночи', 'ночей')} в поездке</>}
                            </p>
                            {beyond.length > 0 ? (
                                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200
                                    rounded-xl px-2.5 py-1.5 mt-1.5">
                                    {beyond.length === 1
                                        ? `День ${beyond[0]} теперь выпадает`
                                        : `Дни ${beyond[0]}–${beyond[beyond.length - 1]} теперь выпадают`}
                                    {' '}после {formatDate(trip.end_date)}, конца поездки.{' '}
                                    <strong className="font-semibold">Ничего не удалено</strong> — остановки и переезды сохранены, дни отмечены красным в разделе{' '}
                                    <Link href="/admin/honeymoon/itinerary" className="underline">
                                        Маршрут
                                    </Link>. Перенесите планы на ранние дни, удалите лишние или измените период поездки.
                                </p>
                            ) : trip.end_date
                                && lastDay < (daysBetween(trip.start_date, trip.end_date) ?? 0) + 1 ? (
                                    <p className="text-[11px] text-amber-700 mt-1">
                                        Выбранный период: {(nights ?? 0) + 1} дней, запланировано: {lastDay}{' '}
                                        . Выделите период заново, чтобы добавить остальные дни.
                                    </p>
                                ) : null}
                            <Button className="mt-2" onClick={clearDates}>Очистить даты</Button>
                        </>
                    ) : (
                        <p className="text-xs text-gray-500">
                            Даты не заданы, дни пронумерованы. Выделите период выше, чтобы создать дни на эти даты.
                        </p>
                    )}
                </div>
            </Card>

            {/* ---- Trip ---- */}
            <Card className="p-4 space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Название поездки</label>
                    <TextField
                        key={trip.title}
                        defaultValue={trip.title}
                        onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== trip.title) {
                                api.update('trip', { title: e.target.value });
                            }
                        }}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Валюта</label>
                    <SelectField
                        value={trip.home_currency || 'USD'}
                        onChange={(e) => api.update('trip', { home_currency: e.target.value })}
                    >
                        {CURRENCIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </SelectField>
                    <p className="text-xs text-gray-400 mt-1.5">
                        Символ для цен без указанной валюты и примерной стоимости в обзоре. Конвертация не выполняется.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Этап поездки
                    </label>
                    <SelectField
                        value={trip.phase}
                        onChange={(e) => api.update('trip', { phase: e.target.value })}
                    >
                        <option value="planning">Подготовка — избранное и карта</option>
                        <option value="travelling">В пути — сначала вкладка «Сегодня»</option>
                        <option value="after">После поездки — маршрут становится дневником</option>
                    </SelectField>
                    <p className="text-xs text-gray-400 mt-1.5">
                        Вы задаёте этап сами, независимо от календарных дат. <strong>После поездки</strong> позволяет отмечать посещения, пропуски, любимые места и впечатления.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Формат времени
                        </label>
                        <SelectField
                            value={trip.time_format}
                            onChange={(e) => api.update('trip', { time_format: e.target.value })}
                        >
                            <option value="24h">24 часа (14:05)</option>
                            <option value="12h">12 часов (2:05 PM)</option>
                        </SelectField>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Расстояния
                        </label>
                        <SelectField
                            value={trip.distance_unit}
                            onChange={(e) => api.update('trip', { distance_unit: e.target.value })}
                        >
                            <option value="km">Километры</option>
                            <option value="mi">Мили</option>
                        </SelectField>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Вы вдвоём
                    </label>
                    <TextField
                        key={trip.partner_names}
                        defaultValue={trip.partner_names}
                                placeholder="Анна, Иван"
                        onBlur={(e) => {
                            if (e.target.value !== trip.partner_names) {
                                api.update('trip', { partner_names: e.target.value });
                            }
                        }}
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                        Для личных оценок, списков багажа и подписей доступа.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Заметки</label>
                    <TextField
                        key={trip.notes ?? ''}
                        defaultValue={trip.notes ?? ''}
                        placeholder="Общие заметки о поездке"
                        onBlur={(e) => {
                            if (e.target.value !== (trip.notes ?? '')) api.update('trip', { notes: e.target.value });
                        }}
                    />
                </div>
            </Card>

            {/* ---- Money ---- */}
            <Card id="set-money" className="p-4 space-y-3">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Деньги</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Бюджет и курсы для подсчёта всех расходов в одной валюте.
                    </p>
                </div>
                <MoneySettings api={api} />
            </Card>

            {/* ---- Take it with you ---- */}
            <Card id="set-take-it-with-you" className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Взять с собой</h3>
                <div className="flex flex-wrap gap-2">
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a
                        href="/api/admin/honeymoon/ics"
                        className="inline-flex min-h-11 md:min-h-0 items-center rounded-full bg-accent text-white px-4 py-1.5
                            text-sm font-medium hover:opacity-90"
                    >
                        Добавить в календарь (.ics)
                    </a>
                    <Button onClick={download}>Скачать резервную копию (JSON)</Button>
                </div>
                <p className="flex items-center gap-1 text-xs text-gray-500">
                    Поездка в календаре телефона и резервная копия всех данных.
                    <Hint label="О календаре и резервной копии">
                        Календарь включает дни, переезды и остановки с часовыми поясами, координатами, ссылками на брони и напоминаниями. Нужно задать даты поездки. Резервная копия содержит все данные в одном файле.
                    </Hint>
                </p>

                {/* A download goes stale the day after you export it. A
                    subscription is the same calendar at a URL, which phones poll
                    — so moving a stop here moves it there. */}
                {subscribeUrl ? (
                    <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-xs font-semibold text-gray-700">
                            Подпишитесь, чтобы календарь обновлялся
                        </p>
                        <code className="mt-1 block truncate rounded-xl bg-white px-2 py-1.5
                            text-[11px] text-gray-600">
                            {subscribeUrl}
                        </code>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Button onClick={() => navigator.clipboard?.writeText(subscribeUrl)}>
                                Скопировать ссылку подписки
                            </Button>
                            <a
                                href={subscribeUrl.replace(/^https?:/, 'webcal:')}
                                className="rounded-full border border-gray-200 bg-white px-4 py-1.5
                                    text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Добавить на это устройство
                            </a>
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-400">
                            Используется токен первой ссылки доступа. Её отзыв отключит и подписку.
                        </p>
                    </div>
                ) : (
                    <p className="text-[11px] text-gray-400">
                        Создайте ссылку доступа ниже — здесь появится подписка на календарь.
                    </p>
                )}
            </Card>

            {/* ---- The things you need at 2am ---- */}
            <Card id="set-emergency-amp-practical-details" className="p-4 space-y-3 xl:col-span-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                        Экстренные контакты и полезные сведения
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        Под рукой во вкладке «Сегодня», даже когда заряд почти закончился.
                        <Hint label="Об этих сведениях">
                            Доступны одним нажатием во вкладке «Сегодня». Здесь хранятся телефоны, номера полисов и адреса.
                        </Hint>
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {INFO_SECTIONS.map((section) => (
                        <div key={section.key}>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                {section.label}
                            </label>
                            <TextArea
                                key={`${section.key}-${trip.info?.[section.key] ?? ''}`}
                                defaultValue={trip.info?.[section.key] ?? ''}
                                placeholder={section.hint}
                                rows={3}
                                onBlur={(e) => {
                                    const value = e.target.value;
                                    if (value === (trip.info?.[section.key] ?? '')) return;
                                    // The whole blob goes back, so a second tab
                                    // editing another section cannot be lost by
                                    // this one — the payload is refetched between
                                    // saves and this reads the fresh copy.
                                    api.update('trip', {
                                        info: { ...(trip.info ?? {}), [section.key]: value },
                                    });
                                }}
                            />
                        </div>
                    ))}
                </div>
            </Card>

            {/* ---- Sharing ---- */}
            <Card id="set-share-it-with-someone" className="p-4 space-y-3 xl:col-span-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Поделиться доступом</h3>
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        Ссылка для просмотра поездки вашими близкими.
                        <Hint label="О ссылках доступа">
                            Без входа и редактирования, без избранного, бюджета и документов. Доступ есть у каждого, кто знает ссылку. Отзовите её, если доступ больше не нужен.
                        </Hint>
                    </p>
                </div>
                <ShareLinks api={api} />
            </Card>

            {/* ---- Documents ---- */}

            {/* ---- Snapshots ---- */}
            <Card id="set-snapshots" className="p-4 space-y-3">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Снимки поездки</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Снимок всей поездки: сохранить на память или использовать для следующей.
                    </p>
                </div>
                <TripArchives api={api} />
            </Card>

        </div>
        </>
    );
}
