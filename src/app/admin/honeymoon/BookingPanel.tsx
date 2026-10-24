'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/honeymoon';
import type { Booking, BookingKind } from '@/lib/honeymoon';
import { bookingFor, bookingTotal, formatMoney } from '@/lib/honeymoonBudget';
import type { HoneymoonApi } from './useHoneymoon';
import { Button, SelectField, TextArea, TextField } from './ui';

/**
 * The paperwork behind "booked".
 *
 * `status: booked` on a place recorded *that* something was booked and nothing
 * else — no confirmation number, no money, no date after which cancelling costs
 * you. This is that missing half, and it is the same panel wherever a booking
 * can hang: a stay, an excursion, a flight, a dinner table.
 *
 * It creates the row lazily. A place is not a booking until there is something
 * to write down, so nothing exists until you press the button — which also means
 * a shortlist of forty hotels does not carry forty empty bookings.
 */
export default function BookingPanel({
    api, kind, placeId, travelId, stopId, journeyId, compact = false,
}: {
    api: HoneymoonApi;
    kind: BookingKind;
    placeId?: number | null;
    travelId?: number | null;
    stopId?: number | null;
    /**
     * The journey this booking covers.
     *
     * A ticket has one reference, one price and one cancellation date however
     * many legs it has, so a journey's booking hangs off the journey rather than
     * off one of its legs.
     */
    journeyId?: number | null;
    /** Fewer fields, for the places where this sits inside another form. */
    compact?: boolean;
}) {
    const bookings = api.data?.bookings ?? [];
    const currency = api.data?.trip.home_currency || 'USD';
    const booking = journeyId != null
        ? bookings.find((row) => row.journey_id === journeyId) ?? null
        : bookingFor(bookings, {
            place: placeId != null ? { id: placeId } as never : null,
            leg: travelId != null ? { id: travelId } as never : null,
            stopId: stopId ?? null,
        });
    const [creating, setCreating] = useState(false);

    const create = async () => {
        setCreating(true);
        try {
            await api.create('bookings', {
                kind,
                place_id: placeId ?? null,
                travel_id: travelId ?? null,
                stop_id: stopId ?? null,
                journey_id: journeyId ?? null,
            });
        } finally {
            setCreating(false);
        }
    };

    if (!booking) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 p-3">
                <p className="text-[11px] text-gray-500">
                    {kind === 'travel'
                        ? 'Данные ещё не указаны: номер брони, стоимость и срок бесплатной '
                            + 'отмены.'
                        : 'Данные ещё не указаны: номер подтверждения, стоимость и срок бесплатной '
                            + 'отмены.'}
                </p>
                <Button className="mt-2" onClick={create} disabled={creating}>
                    {creating
                        ? 'Добавляем…'
                        : kind === 'travel' ? '+ Добавить номер брони' : '+ Данные бронирования'}
                </Button>
            </div>
        );
    }

    const set = (fields: Record<string, unknown>) => api.update('bookings', {
        id: booking.id, ...fields,
    });

    /*
     * What this booking comes to.
     *
     * For a stay that is the place's price times the nights — the price is the
     * stay's, entered once on the Stays tab, and this panel supplies the dates
     * it is multiplied by. It used to have a Cost box of its own, so the same
     * figure was typed twice and the budget had to decide which copy to trust.
     */
    const place = placeId != null ? api.placeById.get(placeId) ?? null : null;
    const total = bookingTotal(booking, place);
    /** The place owns the money, so this panel reports it rather than asking. */
    const derived = kind === 'stay' && place != null && booking.cost == null;
    const owed = total != null
        ? Math.max(0, total.amount - (booking.cost_paid ?? 0))
        : null;

    return (
        <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                    Бронирование
                </span>
                {booking.paid ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px]
                        font-semibold text-white">
                        Оплачено
                    </span>
                ) : owed != null && owed > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px]
                        font-semibold text-amber-800">
                        {formatMoney(owed, currency)} к оплате
                    </span>
                ) : null}
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={() => api.removeRow('bookings', booking, 'Данные брони удалены')}
                    className="text-[11px] text-gray-500 underline decoration-dotted"
                >
                    Удалить
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Field label="Номер подтверждения">
                    <TextField
                        key={`c${booking.confirmation ?? ''}`}
                        defaultValue={booking.confirmation ?? ''}
                        placeholder="AMK-9931"
                        onBlur={(e) => {
                            if (e.target.value !== (booking.confirmation ?? '')) {
                                set({ confirmation: e.target.value });
                            }
                        }}
                    />
                </Field>
                <Field label="Где забронировано">
                    <TextField
                        key={`p${booking.provider ?? ''}`}
                        defaultValue={booking.provider ?? ''}
                        placeholder="Booking.com / напрямую"
                        onBlur={(e) => {
                            if (e.target.value !== (booking.provider ?? '')) {
                                set({ provider: e.target.value });
                            }
                        }}
                    />
                </Field>
            </div>

            {kind === 'stay' && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Заезд">
                        <TextField
                            type="date"
                            key={`ci${booking.check_in ?? ''}`}
                            defaultValue={booking.check_in ?? ''}
                            onBlur={(e) => {
                                if (e.target.value !== (booking.check_in ?? '')) {
                                    set({ check_in: e.target.value });
                                }
                            }}
                        />
                    </Field>
                    <Field label="Выезд">
                        <TextField
                            type="date"
                            key={`co${booking.check_out ?? ''}`}
                            defaultValue={booking.check_out ?? ''}
                            onBlur={(e) => {
                                if (e.target.value !== (booking.check_out ?? '')) {
                                    set({ check_out: e.target.value });
                                }
                            }}
                        />
                    </Field>
                </div>
            )}

            {kind === 'table' && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Число гостей">
                        <TextField
                            type="number"
                            min="1"
                            key={`ps${booking.party_size ?? ''}`}
                            defaultValue={booking.party_size ?? ''}
                            placeholder="2"
                            onBlur={(e) => {
                                if (e.target.value !== String(booking.party_size ?? '')) {
                                    set({ party_size: e.target.value });
                                }
                            }}
                        />
                    </Field>
                    <Field label="Дресс-код">
                        <TextField
                            key={`dc${booking.dress_code ?? ''}`}
                            defaultValue={booking.dress_code ?? ''}
                            placeholder="Повседневный элегантный"
                            onBlur={(e) => {
                                if (e.target.value !== (booking.dress_code ?? '')) {
                                    set({ dress_code: e.target.value });
                                }
                            }}
                        />
                    </Field>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2">
                <Field label={`Стоимость (${total?.currency || currency})`}>
                    {derived ? (
                        /* Reported, not asked for. Where it comes from is said
                           out loud, so a wrong number is fixed in the one place
                           that can change it rather than hunted for. */
                        <div className="rounded-2xl bg-gray-50 px-3 py-2">
                            <p className="text-sm text-gray-800 tabular-nums">
                                {total != null
                                    ? formatMoney(total.amount, total.currency || currency)
                                    : '—'}
                            </p>
                            <p className="text-[10px] leading-tight text-gray-400">
                                {total?.detail
                                    ?? (place.cost == null
                                        ? 'Указать стоимость проживания'
                                        : 'Из стоимости проживания')}
                            </p>
                        </div>
                    ) : (
                        <TextField
                            type="number"
                            min="0"
                            step="0.01"
                            key={`ct${booking.cost ?? ''}`}
                            defaultValue={booking.cost != null ? String(booking.cost) : ''}
                            onBlur={(e) => {
                                const current = booking.cost != null ? String(booking.cost) : '';
                                if (e.target.value !== current) {
                                    set({ cost: e.target.value, cost_currency: currency });
                                }
                            }}
                        />
                    )}
                </Field>
                <Field label="Уже оплачено">
                    <TextField
                        type="number"
                        min="0"
                        step="0.01"
                        key={`cp${booking.cost_paid ?? ''}`}
                        defaultValue={booking.cost_paid != null ? String(booking.cost_paid) : ''}
                        onBlur={(e) => {
                            const current = booking.cost_paid != null ? String(booking.cost_paid) : '';
                            if (e.target.value !== current) set({ cost_paid: e.target.value });
                        }}
                    />
                </Field>
                <Field label="Оплачено">
                    <SelectField
                        value={booking.paid ? 'yes' : 'no'}
                        onChange={(e) => set({ paid: e.target.value === 'yes' })}
                    >
                        <option value="no">Пока нет</option>
                        <option value="yes">Полностью оплачено</option>
                    </SelectField>
                </Field>
            </div>

            {/* The two dates worth an alarm. */}
            <div className="grid grid-cols-2 gap-2">
                <Field label="Аванс до">
                    <TextField
                        type="date"
                        key={`dd${booking.deposit_due_on ?? ''}`}
                        defaultValue={booking.deposit_due_on ?? ''}
                        onBlur={(e) => {
                            if (e.target.value !== (booking.deposit_due_on ?? '')) {
                                set({ deposit_due_on: e.target.value });
                            }
                        }}
                    />
                </Field>
                <Field label="Бесплатная отмена до">
                    <TextField
                        type="date"
                        key={`cb${booking.cancel_by ?? ''}`}
                        defaultValue={booking.cancel_by ?? ''}
                        onBlur={(e) => {
                            if (e.target.value !== (booking.cancel_by ?? '')) {
                                set({ cancel_by: e.target.value });
                            }
                        }}
                    />
                </Field>
            </div>

            {!compact && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Контакт">
                            <TextField
                                key={`ct2${booking.contact ?? ''}`}
                                defaultValue={booking.contact ?? ''}
                                placeholder="+62 363 41333"
                                onBlur={(e) => {
                                    if (e.target.value !== (booking.contact ?? '')) {
                                        set({ contact: e.target.value });
                                    }
                                }}
                            />
                        </Field>
                        <Field label="Страница бронирования">
                            <TextField
                                key={`u${booking.url ?? ''}`}
                                defaultValue={booking.url ?? ''}
                                placeholder="https://…"
                                onBlur={(e) => {
                                    if (e.target.value !== (booking.url ?? '')) {
                                        set({ url: e.target.value });
                                    }
                                }}
                            />
                        </Field>
                    </div>
                    <Field label="Заметки">
                        <TextArea
                            rows={2}
                            key={`n${booking.notes ?? ''}`}
                            defaultValue={booking.notes ?? ''}
                            placeholder="Номер с видом на море, поздний заезд согласован по почте"
                            onBlur={(e) => {
                                if (e.target.value !== (booking.notes ?? '')) {
                                    set({ notes: e.target.value });
                                }
                            }}
                        />
                    </Field>
                </>
            )}

            <BookingSummary booking={booking} currency={currency} total={total?.amount ?? null} />
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide
                text-gray-400">
                {label}
            </label>
            {children}
        </div>
    );
}

/** One line restating the booking in words, which is how it gets checked. */
function BookingSummary({ booking, currency, total }: {
    booking: Booking; currency: string;
    /** The booking's own cost, or the stay's price times the nights. */
    total: number | null;
}) {
    const parts = [
        total != null ? formatMoney(total, currency) : null,
        booking.check_in && booking.check_out
            ? `${formatDate(booking.check_in)} → ${formatDate(booking.check_out)}`
            : null,
        booking.cancel_by ? `отмена до ${formatDate(booking.cancel_by)}` : null,
        booking.deposit_due_on && !booking.paid
            ? `аванс ${formatDate(booking.deposit_due_on)}`
            : null,
    ].filter(Boolean);
    if (!parts.length) return null;
    return <p className="text-[11px] text-emerald-900">{parts.join(' · ')}</p>;
}
