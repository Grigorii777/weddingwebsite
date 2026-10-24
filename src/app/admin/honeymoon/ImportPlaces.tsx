'use client';
import { counted } from '@/lib/locale';

import { useMemo, useRef, useState } from 'react';
import { normalizeCategoryKey } from '@/lib/honeymoon';
import { findDuplicates, parseImport } from '@/lib/honeymoonPlaces';
import type { ImportedPlace } from '@/lib/honeymoonPlaces';
import type { HoneymoonApi } from './useHoneymoon';
import { Button, Modal, SelectField, TextArea } from './ui';

/**
 * Somebody else's list, as places.
 *
 * Lists arrive as a pasted spreadsheet, a KML from Google My Maps, or the JSON
 * from a Takeout of saved places — and the seed script did this once for the
 * Bali guide, which is what proved it was worth a button.
 *
 * Two rules make it safe to press. Nothing is written until you have seen what
 * it found, and anything that matches a place you already have (same name,
 * within a kilometre) is shown as a duplicate and skipped by default — "Warung
 * Ibu Oka" is on every list anyone will ever send you.
 */
export default function ImportPlaces({ api, open, onClose }: {
    api: HoneymoonApi;
    open: boolean;
    onClose: () => void;
}) {
    const [text, setText] = useState('');
    const [source, setSource] = useState('Советы друзей');
    const [category, setCategory] = useState('');
    const [skipped, setSkipped] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);

    const parsed = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);
    const duplicates = useMemo(
        () => (parsed ? findDuplicates(parsed.places, api.data?.places ?? []) : new Map()),
        [parsed, api.data?.places],
    );

    const willImport = useMemo(() => {
        if (!parsed) return [];
        return parsed.places.filter((_, index) => !duplicates.has(index) && !skipped.has(index));
    }, [parsed, duplicates, skipped]);

    const readFile = async (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        setText(await file.text());
        setDone('');
    };

    const run = async () => {
        if (!willImport.length) return;
        setBusy(true);
        try {
            const rows = willImport.map((place: ImportedPlace) => ({
                name: place.name,
                category: place.category
                    ? normalizeCategoryKey(place.category)
                    : (category || 'misc'),
                lat: place.lat ?? null,
                lng: place.lng ?? null,
                address: place.address ?? '',
                description: place.description ?? '',
                price_note: place.price_note ?? '',
                links: place.links ?? [],
                source: source.trim() || 'Импортировано',
                // A pin that came from someone else's list is worth a look
                // before it is trusted — the same rule the geocoder follows.
                needs_review: place.lat != null,
            }));
            const ok = await api.createMany('places', rows);
            await api.refresh();
            if (ok) {
                setDone(`Добавлено: ${counted(rows.length, 'место', 'места', 'мест')}.`);
                setText('');
                setSkipped(new Set());
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Импорт мест" wide>
            <div className="space-y-3">
                <p className="text-xs text-gray-500">
                    Вставьте таблицу со столбцами name, category, lat, lng, address, notes, url в любом порядке; KML из Google My Maps или JSON сохранённых мест из Google Takeout. Можно выбрать файл.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".csv,.tsv,.txt,.kml,.json,.geojson"
                        className="hidden"
                        onChange={(e) => readFile(e.target.files)}
                    />
                    <Button onClick={() => fileInput.current?.click()}>Выбрать файл…</Button>
                    <div className="min-w-[10rem] flex-1">
                        <SelectField
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="">Тип для строк без типа — «Другое»</option>
                            {(api.data?.categories ?? []).map((row) => (
                                <option key={row.key} value={row.key}>
                                    {row.icon} {row.label}
                                </option>
                            ))}
                        </SelectField>
                    </div>
                </div>

                <TextArea
                    rows={6}
                    value={text}
                    placeholder={'Name,Category,Lat,Lng\nTegallalang,nature,-8.4312,115.2792'}
                    onChange={(e) => { setText(e.target.value); setDone(''); }}
                    className="font-mono text-[11px]"
                />

                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                        Источник этих мест
                    </label>
                    <TextArea
                        rows={1}
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="Советы друзей"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                        Источник будет сохранён у каждого места. Позже можно отфильтровать именно эту подборку, в том числе ещё не оценённые места.
                    </p>
                </div>

                {parsed && (
                    <div className="rounded-2xl border border-gray-200 p-3">
                        <p className="text-sm text-gray-800">
                            Распознано {parsed.format}: {counted(parsed.places.length, 'место', 'места', 'мест')}
                            {duplicates.size > 0 && `, ${duplicates.size} уже в вашей подборке`}
                            {parsed.skipped.length > 0
                                && `, ${counted(parsed.skipped.length, 'строка', 'строки', 'строк')} пропущено`}.
                        </p>

                        {parsed.skipped.length > 0 && (
                            <p className="mt-1 text-[11px] text-amber-700">
                                Пропущено: {parsed.skipped.slice(0, 6)
                                    .map((row) => `строка ${row.line} (${row.why})`).join(', ')}
                                {parsed.skipped.length > 6 && '…'}
                            </p>
                        )}

                        <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
                            {parsed.places.map((place, index) => {
                                const duplicate = duplicates.get(index);
                                const off = duplicate || skipped.has(index);
                                return (
                                    <li
                                        key={`${place.name}-${index}`}
                                        className={`flex items-center gap-2 rounded-xl px-2 py-1
                                            ${off ? 'bg-gray-50 text-gray-400' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!off}
                                            disabled={!!duplicate}
                                            onChange={() => setSkipped((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(index)) next.delete(index);
                                                else next.add(index);
                                                return next;
                                            })}
                                            className="size-4 shrink-0 rounded accent-accent"
                                            aria-label={`Импортировать ${place.name}`}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">
                                            {place.name}
                                        </span>
                                        {place.lat != null && (
                                            <span className="shrink-0 text-[10px] text-sky-700">
                                                на карте
                                            </span>
                                        )}
                                        {duplicate && (
                                            <span className="shrink-0 text-[10px] text-gray-500">
                                                уже добавлено
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {done && <p className="text-sm text-emerald-700">{done}</p>}

                <div className="flex items-center justify-end gap-2">
                    <Button onClick={onClose}>Закрыть</Button>
                    <Button
                        tone="primary"
                        onClick={run}
                        disabled={!willImport.length || busy}
                    >
                        {busy ? 'Импортируем…' : `Импортировать ${willImport.length || ''}`.trim()}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
