'use client';
import { counted } from '@/lib/locale';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
    categoryMeta, formatDate, formatTime, legIsOvernight, travelModeMeta,
} from '@/lib/honeymoon';
import type { Trip } from '@/lib/honeymoon';
import {
    dayText, emergencyFor, INFO_SECTIONS, minutesOf, navUrl, nextStop, relativeDayLabel, stopWindow,
} from '@/lib/honeymoonToday';
import type { DayStop, TodayPlan } from '@/lib/honeymoonToday';

/**
 * The trip, as it looks on the morning of.
 *
 * One screen, read-only, thumb-sized targets: where you are sleeping, what is
 * next, how to get there, and who to call if it goes wrong. Shared by the
 * admin's Today tab and the read-only link a partner opens, so the two can
 * never drift.
 *
 * Every target here is at least 44px and nothing needs two hands: this screen is
 * used standing up, holding a coffee, in the sun.
 */
export default function TodaySheet({
    plan, trip, now, onSelectDay, night, onNightChange, footer, weather, sun, swipeDays = false,
}: {
    plan: TodayPlan;
    trip: Pick<Trip, 'title' | 'start_date' | 'time_format' | 'info' | 'partner_names'>;
    /** Minutes past midnight, for "next up". Omitted on the server. */
    now?: number | null;
    onSelectDay?: (dayNumber: number) => void;
    /**
     * The page swipes between days (the portal does; the shared link does not).
     * On a phone the ‹ › buttons then give way to a row of dots: the position
     * in the trip at a glance, and the sign that the page moves sideways.
     */
    swipeDays?: boolean;
    night: boolean;
    onNightChange?: (night: boolean) => void;
    footer?: React.ReactNode;
    /**
     * Weather for the day, when whoever rendered this could fetch it.
     *
     * A prop rather than a fetch, because this component has two homes and only
     * one of them is signed in: the shared link has no admin API and gets the
     * sun times (which are arithmetic) but no forecast.
     */
    weather?: {
        kind: 'forecast' | 'climate'; high: number | null; low: number | null;
        rain_chance: number | null; label: string | null;
    } | null;
    sun?: { sunrise: string | null; sunset: string | null } | null;
}) {
    const format = trip.time_format === '12h' ? '12h' : '24h';
    const [showEmergency, setShowEmergency] = useState(false);

    const next = useMemo(
        () => (now == null ? null : nextStop(plan.stops, now)),
        [plan.stops, now],
    );

    const country = plan.base?.country || '';
    const emergency = emergencyFor(country);
    const infoFilled = INFO_SECTIONS.filter((section) => (trip.info?.[section.key] ?? '').trim());

    return (
        <div className={night ? 'night' : ''}>
            <div className="min-h-full bg-white night:bg-gray-950 text-gray-900 night:text-gray-100">
                <div className="mx-auto max-w-xl px-4 pb-24 pt-4 md:pb-10">
                    <Header
                        plan={plan}
                        trip={trip}
                        night={night}
                        onNightChange={onNightChange}
                        onSelectDay={onSelectDay}
                        swipeDays={swipeDays}
                        copyText={plan.day ? () => dayText(plan, trip, { weather, sun }) : undefined}
                    />

                    {(weather || sun?.sunrise) && (
                        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1
                            text-sm text-gray-600 night:text-gray-300">
                            {weather && (
                                <span>
                                    {weather.kind === 'climate' && '≈ '}
                                    {weather.high != null && `${Math.round(weather.high)}°`}
                                    {weather.low != null && ` / ${Math.round(weather.low)}°`}
                                    {weather.label && ` · ${weather.label}`}
                                    {weather.rain_chance != null
                                        && ` · ${Math.round(weather.rain_chance)}% вероятность дождя`}
                                </span>
                            )}
                            {sun?.sunrise && sun.sunset && (
                                <span className="tabular-nums">
                                    ☀ {sun.sunrise} – {sun.sunset}
                                </span>
                            )}
                        </div>
                    )}

                    {/* What slides when swiping between days. The header ("Day 3
                        of 15", the date), the weather and the dots hold still and
                        only change. */}
                    <div data-swipe-slide>
                    {plan.standing === 'before' && plan.daysUntil != null && (
                        <Banner>
                            {plan.daysUntil === 0
                                ? 'Вы отправляетесь сегодня.'
                                : `${counted(plan.daysUntil, 'день', 'дня', 'дней')} до отправления — это первый день.`}
                        </Banner>
                    )}
                    {plan.standing === 'after' && (
                        <Banner>С возвращением! Это последний день путешествия.</Banner>
                    )}
                    {plan.standing === 'undated' && (
                        <Banner>
                            Дата начала поездки ещё не задана. Показан первый день.
                        </Banner>
                    )}

                    {!plan.day ? (
                        <Card>
                            <p className="text-gray-600 night:text-gray-300">
                                Дни поездки ещё не запланированы.
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {plan.arrivals.length > 0 && (
                                <Card>
                                    <SectionLabel>Прибытие сегодня</SectionLabel>
                                    <div className="mt-2 space-y-3">
                                        {plan.arrivals.map(({ leg, fromDayNumber }) => (
                                            <LegRow
                                                key={leg.id}
                                                leg={leg}
                                                format={format}
                                                note={`отправление в день ${fromDayNumber}`}
                                            />
                                        ))}
                                    </div>
                                </Card>
                            )}

                            <BaseCard plan={plan} format={format} />

                            {plan.departures.length > 0 && (
                                <Card>
                                    <SectionLabel>Переезды сегодня</SectionLabel>
                                    <div className="mt-2 space-y-3">
                                        {plan.departures.map((leg) => (
                                            <LegRow key={leg.id} leg={leg} format={format} />
                                        ))}
                                    </div>
                                </Card>
                            )}

                            <Card>
                                <SectionLabel>
                                    {plan.stops.length ? 'План дня' : 'Ничего не запланировано'}
                                </SectionLabel>
                                {plan.stops.length === 0 ? (
                                    <p className="mt-2 text-gray-600 night:text-gray-300">
                                        Свободный день. {plan.base
                                            ? `Вы здесь: ${plan.base.name}.`
                                            : ''}
                                    </p>
                                ) : (
                                    <ol className="mt-3 space-y-3">
                                        {plan.stops.map((stop) => (
                                            <StopRow
                                                key={stop.stop.id}
                                                stop={stop}
                                                format={format}
                                                isNext={next?.stop.id === stop.stop.id}
                                            />
                                        ))}
                                    </ol>
                                )}
                            </Card>

                            {plan.day.notes && (
                                <Card>
                                    <SectionLabel>Заметки на день</SectionLabel>
                                    <p className="mt-2 whitespace-pre-wrap text-gray-700 night:text-gray-200">
                                        {plan.day.notes}
                                    </p>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* The one screen you hope not to need. Collapsed by
                        default, because it is not what you open this for — and
                        one tap away, because when it is, it is the only thing. */}
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={() => setShowEmergency((v) => !v)}
                            className="flex min-h-12 w-full items-center justify-between rounded-2xl
                                border border-rose-200 night:border-rose-900 bg-rose-50
                                night:bg-rose-950/40 px-4 text-left"
                        >
                            <span className="font-medium text-rose-900 night:text-rose-200">
                                Экстренная помощь и документы
                            </span>
                            <span className="text-rose-400 night:text-rose-500">
                                {showEmergency ? '▲' : '▼'}
                            </span>
                        </button>
                        {showEmergency && (
                            <Card className="mt-2">
                                <SectionLabel>
                                    {emergency.country}
                                    {emergency.guessed && ' — страна для сегодняшнего места проживания не указана'}
                                </SectionLabel>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {emergency.numbers.map((entry) => (
                                        <a
                                            key={`${entry.label}-${entry.number}`}
                                            href={`tel:${entry.number}`}
                                            className="flex min-h-14 flex-col justify-center rounded-2xl
                                                bg-rose-600 px-4 text-white active:bg-rose-700"
                                        >
                                            <span className="text-xs uppercase tracking-wide opacity-80">
                                                {entry.label}
                                            </span>
                                            <span className="text-lg font-semibold tabular-nums">
                                                {entry.number}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                                {infoFilled.length > 0 && (
                                    <dl className="mt-4 space-y-3">
                                        {infoFilled.map((section) => (
                                            <div key={section.key}>
                                                <dt className="text-xs font-semibold uppercase
                                                    tracking-wide text-gray-500 night:text-gray-400">
                                                    {section.label}
                                                </dt>
                                                <dd className="mt-0.5 whitespace-pre-wrap text-gray-800
                                                    night:text-gray-100">
                                                    {trip.info?.[section.key]}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                                {!infoFilled.length && (
                                    <p className="mt-3 text-sm text-gray-500 night:text-gray-400">
                                        Добавьте страховку, посольство и контакты во вкладке «Настройки» — они появятся здесь.
                                    </p>
                                )}
                            </Card>
                        )}
                    </div>

                    {footer}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-gray-200 night:border-gray-800 bg-white
            night:bg-gray-900 p-4 ${className}`}>
            {children}
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500
            night:text-gray-400">
            {children}
        </h2>
    );
}

function Banner({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-3 rounded-2xl bg-accent-light night:bg-amber-950/40 px-4 py-3 text-sm
            text-gray-800 night:text-amber-100">
            {children}
        </div>
    );
}

function Header({ plan, trip, night, onNightChange, onSelectDay, swipeDays = false, copyText }: {
    plan: TodayPlan;
    trip: Pick<Trip, 'title' | 'partner_names'>;
    night: boolean;
    onNightChange?: (night: boolean) => void;
    onSelectDay?: (dayNumber: number) => void;
    swipeDays?: boolean;
    /** The day as text for a message; no button when there is no day to send. */
    copyText?: () => string;
}) {
    // By the shown day's date, not the trip's standing: every day of a trip
    // under way used to say "Today".
    const relative = plan.dayNumber != null ? relativeDayLabel(plan.date) : null;
    return (
        <div className="mb-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500
                        night:text-gray-400">
                        {trip.title}
                    </p>
                    <h1 className="mt-0.5 text-2xl font-semibold">
                        {plan.dayNumber == null
                            ? 'Дни ещё не добавлены'
                            : `День ${plan.dayNumber}${plan.totalDays ? ` из ${plan.totalDays}` : ''}`}
                    </h1>
                    <p className="text-gray-600 night:text-gray-300">
                        {plan.date ? formatDate(plan.date) : 'Даты не заданы'}
                        {plan.day?.title ? ` · ${plan.day.title}` : ''}
                        {relative && (
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                relative === 'Today'
                                    ? 'bg-accent text-white'
                                    : 'bg-gray-100 text-gray-600 night:bg-gray-800 night:text-gray-300'}`}>
                                {relative}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                {copyText && <CopyDayButton text={copyText} />}
                {onNightChange && (
                    <button
                        type="button"
                        onClick={() => onNightChange(!night)}
                        aria-label={night ? 'Светлая тема' : 'Тёмная тема'}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full
                            border border-gray-200 night:border-gray-700 text-lg"
                    >
                        {night ? '☀️' : '🌙'}
                    </button>
                )}
                </div>
            </div>

            {swipeDays && onSelectDay && plan.dayNumber != null && plan.totalDays != null && plan.totalDays > 1 && (
                <DayDots current={plan.dayNumber} total={plan.totalDays} />
            )}
            {onSelectDay && plan.dayNumber != null && (
                <div className={`mt-3 items-center gap-2 ${swipeDays ? 'hidden md:flex' : 'flex'}`}>
                    <DayArrow
                        label="Предыдущий день"
                        glyph="‹"
                        to={plan.dayNumber - 1}
                        disabled={plan.dayNumber <= 1}
                        onSelectDay={onSelectDay}
                    />
                    <DayArrow
                        label="Следующий день"
                        glyph="›"
                        to={plan.dayNumber + 1}
                        disabled={plan.totalDays != null && plan.dayNumber >= plan.totalDays}
                        onSelectDay={onSelectDay}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Copies the day as text, ready to paste into a message.
 *
 * The clipboard API needs a secure page; the textarea fallback covers the
 * site opened over the LAN by IP, where `navigator.clipboard` is missing.
 */
function CopyDayButton({ text }: { text: () => string }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
    useEffect(() => {
        if (state === 'idle') return;
        const timer = window.setTimeout(() => setState('idle'), 2000);
        return () => window.clearTimeout(timer);
    }, [state]);

    const copy = async () => {
        const value = text();
        try {
            await navigator.clipboard.writeText(value);
            setState('copied');
            return;
        } catch { /* fall through to the old way */ }
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const done = document.execCommand('copy');
        area.remove();
        setState(done ? 'copied' : 'failed');
    };

    return (
        <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm
                font-medium max-md:size-11 max-md:px-0
                transition active:scale-[0.97] ${state === 'copied'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 night:border-emerald-800 night:bg-emerald-950/40 night:text-emerald-200'
                    : state === 'failed'
                        ? 'border-rose-300 text-rose-700 night:border-rose-800 night:text-rose-300'
                        : 'border-gray-200 text-gray-700 night:border-gray-700 night:text-gray-200'}`}
        >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {state === 'copied'
                    ? <path d="M5 12.5l4.5 4.5L19 7.5" />
                    : state === 'failed'
                        ? <path d="M6 6l12 12M18 6L6 18" />
                        : <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></>}
            </svg>
            {/* An icon on a phone, beside the night switch, so the day's title keeps its room. */}
            <span className="max-md:sr-only">
                {state === 'copied' ? 'Скопировано' : state === 'failed' ? 'Не удалось скопировать' : 'Скопировать план дня'}
            </span>
        </button>
    );
}

/**
 * A page indicator: one dot per day, the current one drawn long. It shows
 * where you are in the trip and that the page moves sideways; it is not a
 * control. Sixteen 44px targets do not fit across a phone, and a 6px dot is
 * not something a finger can hit — swiping is the way to move.
 */
function DayDots({ current, total }: { current: number; total: number }) {
    return (
        <div
            className="mt-3 flex h-6 items-center justify-center gap-1.5 md:hidden"
            role="img"
            aria-label={`День ${current} из ${total}. Листайте, чтобы сменить день.`}
        >
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className={`block h-1.5 rounded-full transition-all duration-300
                        ${index + 1 === current ? 'w-5 bg-gray-900 night:bg-gray-100' : 'w-1.5 bg-gray-300 night:bg-gray-600'}`}
                />
            ))}
        </div>
    );
}

function DayArrow({ label, glyph, to, disabled, onSelectDay }: {
    label: string; glyph: string; to: number; disabled: boolean;
    onSelectDay: (dayNumber: number) => void;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={() => onSelectDay(to)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border
                border-gray-200 night:border-gray-700 text-sm font-medium text-gray-700 night:text-gray-200
                transition active:scale-[0.98] disabled:border-dashed disabled:text-gray-300
                night:disabled:text-gray-600 disabled:active:scale-100"
        >
            {/* Says where it goes, so the row reads on day one too, when the
                left arrow has nowhere to go and used to look like an empty box. */}
            {glyph === '‹'
                ? <><span aria-hidden className="text-lg leading-none">‹</span>{disabled ? 'Первый день' : `День ${to}`}</>
                : <>{disabled ? 'Последний день' : `День ${to}`}<span aria-hidden className="text-lg leading-none">›</span></>}
        </button>
    );
}

function BaseCard({ plan, format }: { plan: TodayPlan; format: '12h' | '24h' }) {
    const { base } = plan;
    if (!base) {
        return (
            <Card>
                <SectionLabel>Сегодня ночью</SectionLabel>
                <p className="mt-2 text-gray-600 night:text-gray-300">
                    Проживание на этот день не указано.
                </p>
            </Card>
        );
    }
    const nights = plan.baseNights && plan.baseNight
        ? `Ночь ${plan.baseNight} из ${plan.baseNights}`
        : null;
    return (
        <Card>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <SectionLabel>Сегодня ночью</SectionLabel>
                    <p className="mt-1 truncate text-lg font-semibold">{base.name}</p>
                    {nights && (
                        <p className="text-sm text-gray-500 night:text-gray-400">{nights}</p>
                    )}
                    {base.address && (
                        <p className="mt-1 text-sm text-gray-600 night:text-gray-300">
                            {base.address}
                        </p>
                    )}
                </div>
                <NavButton target={base} />
            </div>
            <BookingLine plan={plan} format={format} />
        </Card>
    );
}

function BookingLine({ plan, format }: { plan: TodayPlan; format: '12h' | '24h' }) {
    const booking = plan.stops.find((stop) => stop.booking)?.booking
        ?? null;
    const forBase = booking && plan.base && booking.place_id === plan.base.id ? booking : null;
    const use = forBase ?? null;
    if (!use) return null;
    const at = (time: string | null) => (time ? (format === '12h' ? formatTime(time) : time) : null);
    const parts = [
        use.confirmation ? `Бронь ${use.confirmation}` : null,
        at(use.check_in_time) ? `заезд ${at(use.check_in_time)}` : null,
        at(use.check_out_time) ? `выезд до ${at(use.check_out_time)}` : null,
    ].filter(Boolean);
    if (!parts.length && !use.contact) return null;
    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100
            night:border-gray-800 pt-3 text-sm text-gray-600 night:text-gray-300">
            <span>{parts.join(' · ')}</span>
            {use.contact && (
                <a
                    href={`tel:${use.contact.replace(/[^+\d]/g, '')}`}
                    className="ml-auto flex min-h-11 items-center rounded-full bg-gray-900
                        night:bg-gray-100 px-4 text-sm font-medium text-white night:text-gray-900"
                >
                    Позвонить в отель
                </a>
            )}
        </div>
    );
}

function LegRow({ leg, format, note }: {
    leg: {
        id: number; mode: string; from_text: string | null; to_text: string | null;
        depart_time: string | null; arrive_time: string | null; arrive_day_offset: number;
        flight_no: string | null; from_terminal: string | null; to_terminal: string | null;
        confirmation_ref: string | null;
    };
    format: '12h' | '24h';
    note?: string;
}) {
    const meta = travelModeMeta(leg.mode);
    const at = (time: string | null) => (time ? (format === '12h' ? formatTime(time) : time) : null);
    const terminals = [
        leg.from_terminal ? `T${leg.from_terminal}` : null,
        leg.to_terminal ? `T${leg.to_terminal}` : null,
    ].filter(Boolean).join(' → ');
    return (
        <div className="flex items-start gap-3">
            <span className="text-xl leading-none" aria-hidden>{meta.icon}</span>
            <div className="min-w-0 flex-1">
                <p className="font-medium">
                    {leg.from_text || '—'} → {leg.to_text || '—'}
                    {leg.flight_no && (
                        <span className="ml-2 rounded-full bg-gray-100 night:bg-gray-800 px-2
                            py-0.5 text-xs font-semibold">
                            {leg.flight_no}
                        </span>
                    )}
                </p>
                <p className="text-sm text-gray-600 night:text-gray-300 tabular-nums">
                    {[at(leg.depart_time), at(leg.arrive_time)].filter(Boolean).join(' → ')}
                    {legIsOvernight(leg) && ' (+1 день)'}
                    {terminals && ` · ${terminals}`}
                    {leg.confirmation_ref && ` · ${leg.confirmation_ref}`}
                    {note && ` · ${note}`}
                </p>
            </div>
        </div>
    );
}

function StopRow({ stop, format, isNext }: {
    stop: DayStop; format: '12h' | '24h'; isNext: boolean;
}) {
    const window = stopWindow(stop, format);
    const category = stop.place ? categoryMeta(stop.place.category) : null;
    return (
        <li className={`rounded-2xl border p-3 ${isNext
            ? 'border-accent bg-accent-light/40 night:border-amber-600 night:bg-amber-950/30'
            : 'border-gray-100 night:border-gray-800'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {window && (
                            <span className="text-sm font-semibold tabular-nums text-gray-500
                                night:text-gray-400">
                                {window}
                            </span>
                        )}
                        {isNext && (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs
                                font-semibold text-white">
                                Далее
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 font-medium">
                        {category && <span className="mr-1" aria-hidden>{category.icon}</span>}
                        {stop.label}
                    </p>
                    {stop.address && (
                        <p className="mt-0.5 text-sm text-gray-600 night:text-gray-300">
                            {stop.address}
                        </p>
                    )}
                    {stop.place?.best_time && (
                        <p className="mt-0.5 text-sm text-gray-500 night:text-gray-400">
                            Оптимально: {stop.place.best_time}
                        </p>
                    )}
                    {stop.stop.notes && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700
                            night:text-gray-200">
                            {stop.stop.notes}
                        </p>
                    )}
                    {stop.booking?.confirmation && (
                        <p className="mt-1 text-sm text-gray-600 night:text-gray-300">
                            Бронь {stop.booking.confirmation}
                            {stop.booking.party_size ? ` · стол на ${stop.booking.party_size}` : ''}
                            {stop.booking.dress_code ? ` · ${stop.booking.dress_code}` : ''}
                        </p>
                    )}
                </div>
                <NavButton target={{
                    lat: stop.lat, lng: stop.lng, name: stop.label, address: stop.address,
                }} />
            </div>
        </li>
    );
}

/**
 * One tap to a route.
 *
 * `dir/?api=1` is the documented cross-platform form: it opens the native app on
 * either phone and the web map on a desktop. A route beats a dropped pin,
 * because the next thing you do is always "how do I get there".
 */
function NavButton({ target }: {
    target: { lat?: number | null; lng?: number | null; name?: string | null; address?: string | null };
}) {
    const pinned = target.lat != null && target.lng != null;
    const named = (target.name ?? '').trim() || (target.address ?? '').trim();
    if (!pinned && !named) return null;
    return (
        <a
            href={navUrl(target)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-gray-900
                night:bg-gray-100 px-4 text-sm font-medium text-white night:text-gray-900
                active:opacity-80"
        >
            Маршрут
        </a>
    );
}

/*
 * Night mode, remembered per browser.
 *
 * A store rather than state-in-an-effect: the server has no localStorage, so the
 * first paint must be the daylight one and the stored choice can only be read
 * afterwards. `useSyncExternalStore` is the version of that React does properly
 * — it hydrates against the server snapshot and re-renders once with the real
 * one — and it keeps two tabs in step for free.
 */
const nightListeners = new Set<() => void>();

function subscribeNight(callback: () => void) {
    nightListeners.add(callback);
    window.addEventListener('storage', callback);
    return () => {
        nightListeners.delete(callback);
        window.removeEventListener('storage', callback);
    };
}

export function useNightMode(key: string): [boolean, (night: boolean) => void] {
    const night = useSyncExternalStore(
        subscribeNight,
        () => {
            try { return localStorage.getItem(key) === '1'; } catch { return false; }
        },
        () => false,
    );
    const set = useCallback((value: boolean) => {
        try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* private window */ }
        nightListeners.forEach((listener) => listener());
    }, [key]);
    return [night, set];
}

/** The clock, as minutes past midnight, ticking once a minute. */
export function useNowMinutes(): number | null {
    const [minutes, setMinutes] = useState<number | null>(null);
    useEffect(() => {
        const read = () => {
            const now = new Date();
            setMinutes(now.getHours() * 60 + now.getMinutes());
        };
        read();
        const timer = setInterval(read, 60_000);
        return () => clearInterval(timer);
    }, []);
    return minutes;
}

/** Minutes past midnight for a stored `HH:MM`, re-exported for callers. */
export { minutesOf };
