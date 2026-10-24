'use client';
import { counted } from '@/lib/locale';

import { useMemo, useState } from 'react';
import { sourceLabel } from '@/lib/honeymoon';
import Markdown from './Markdown';
import type { HoneymoonApi } from './useHoneymoon';
import { TabToolbar } from './kit/TabToolbar';
import {
    Button, Card, EmptyState, InlineText, MiniSelect, OverflowMenu, TextField,
} from './ui';

/**
 * The notes worth having, as blanks to fill in.
 *
 * Every trip needs the same handful and nobody enjoys typing the headings; the
 * language card in particular is the one that gets skipped and then wanted on
 * day one. Markdown, because the Guide renders it now.
 */
const NOTE_TEMPLATES: { title: string; category: string; body: string }[] = [
    {
        title: 'Языковая памятка',
        category: 'Полезное',
        body: [
            '## Twenty phrases',
            '',
            '| По-русски | На местном языке |',
            '| --- | --- |',
            '| Здравствуйте | |',
            '| Спасибо | |',
            '| Пожалуйста | |',
            '| Да / Нет | |',
            '| Сколько стоит? | |',
            '| Слишком дорого | |',
            '| Где находится…? | |',
            '| Счёт, пожалуйста | |',
            '| Без льда | |',
            '| Не острое | |',
            '| Я вегетарианец | |',
            '| Помогите | |',
            '| Больница | |',
            '| Полиция | |',
            '| Я не понимаю | |',
            '| Вы говорите по-английски? | |',
            '| Доброе утро | |',
            '| До свидания | |',
            '| Извините | |',
            '| Очень вкусно | |',
            '',
            '## Tipping',
            '',
            '- Restaurants:',
            '- Drivers:',
            '- Hotel staff:',
            '',
            '## Getting around',
            '',
            '- Taxi apps that work here:',
            '- Rough fares:',
            '- What to avoid:',
            '',
            '## SIM and data',
            '',
            '- Which provider:',
            '- Where to buy:',
            '- Roughly what it costs:',
        ].join('\n'),
    },
    {
        title: 'Деньги',
        category: 'Полезное',
        body: [
            '- Cards that work here:',
            '- Cash to carry:',
            '- ATM notes (fees, which banks):',
            '- What is card-only, what is cash-only:',
        ].join('\n'),
    },
    {
        title: 'Здоровье и вода',
        category: 'Полезное',
        body: [
            '- Tap water:',
            '- Ice:',
            '- Pharmacy near each base:',
            '- Nearest hospital / clinic:',
            '- Jabs and tablets taken:',
        ].join('\n'),
    },
    {
        title: 'Транспорт',
        category: 'Полезное',
        body: [
            '- Driver / transfer contacts:',
            '- Scooter: yes or no, and why:',
            '- Journey times we have learned the hard way:',
        ].join('\n'),
    },
    {
        title: 'Этикет',
        category: 'Полезное',
        body: [
            '- Dress at temples and religious sites:',
            '- Shoes off where:',
            '- Photography — where not to:',
            '- Local customs worth knowing:',
        ].join('\n'),
    },
];

/**
 * Know Before You Go, plus the per-region write-ups.
 *
 * This is the half of the travel guide that has no coordinates — the water
 * warning, the exchange rate, the scooter safety brief — so it lives as cards
 * rather than pins, grouped by the category each note carries.
 */
export default function GuideTab({ api }: { api: HoneymoonApi }) {
    const { data } = api;
    const [newTitle, setNewTitle] = useState('');
    const [openRegion, setOpenRegion] = useState<number | null>(null);

    // Stable identity so the grouping memo below doesn't rerun every render.
    const notes = useMemo(() => data?.notes ?? [], [data]);
    const regions = data?.regions ?? [];

    /** Grouped by category, with uncategorised last. */
    const grouped = useMemo(() => {
        const map = new Map<string, typeof notes>();
        for (const note of notes) {
            const key = note.category?.trim() || 'Общее';
            const list = map.get(key);
            if (list) list.push(note); else map.set(key, [note]);
        }
        return [...map.entries()].sort(([a], [b]) => {
            if (a === 'General') return 1;
            if (b === 'General') return -1;
            return a.localeCompare(b);
        });
    }, [notes]);

    /** Fill a template in, unless a note by that name already exists. */
    const addTemplate = async (template: { title: string; category: string; body: string }) => {
        const exists = notes.some(
            (note) => note.title.trim().toLowerCase() === template.title.toLowerCase(),
        );
        if (exists) {
            alert(`Уже есть заметка «${template.title}”.`);
            return;
        }
        await api.create('notes', {
            title: template.title,
            category: template.category,
            body: template.body,
            source: 'Шаблон',
        });
    };

    const addNote = async () => {
        const title = newTitle.trim();
        if (!title) return;
        await api.create('notes', { title, body: '', category: 'Общее' });
        setNewTitle('');
    };

    const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return (
        <div className="space-y-4">
            <TabToolbar
                left={(
                    <>
                        <Button onClick={() => jump('guide-regions')}>Регионы</Button>
                        <Button onClick={() => jump('guide-notes')}>Перед поездкой</Button>
                    </>
                )}
            />
            {/* ---- Regions ---- */}
            <section id="guide-regions" className="scroll-mt-16">
                <h2 className="text-sm font-semibold text-gray-900 mb-2 px-1">Регионы</h2>
                {regions.length === 0 ? (
                    <Card>
                        <EmptyState
                            title="Регионов пока нет"
                            hint="Регионы объединяют места и хранят описание района в путеводителе."
                        />
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 items-start">
                        {regions.map((region) => {
                            const count = (data?.places ?? []).filter((p) => p.region_id === region.id).length;
                            const open = openRegion === region.id;
                            return (
                                <Card key={region.id} className="p-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setOpenRegion(open ? null : region.id)}
                                            className="flex-1 min-w-0 min-h-11 md:min-h-0 text-left"
                                        >
                                            <span className="text-sm font-medium text-gray-900">
                                                {region.name}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                {region.country || (
                                                    <span className="text-sky-700">страна не задана</span>
                                                )} · {counted(count, 'место', 'места', 'мест')}
                                            </span>
                                        </button>
                                        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
                                        <OverflowMenu items={[{
                                            label: 'Удалить регион',
                                            danger: true,
                                            onClick: () => {
                                                if (confirm(
                                                    `Удалить ${region.name}? Связанные ${count} места сохранятся без региона.`,
                                                )) api.remove('regions', region.id);
                                            },
                                        }]} />
                                    </div>
                                    {open && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                            {/* Country is not cosmetic: it drives the map's
                                                country filter, and a region without one used
                                                to make its places disappear. */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11px] uppercase tracking-wide
                                                    text-gray-400 font-semibold shrink-0">
                                                    Страна
                                                </span>
                                                <InlineText
                                                    value={region.country ?? ''}
                                                    placeholder="Индонезия"
                                                    className="text-xs -ml-1 max-w-[14rem]"
                                                    onCommit={(country) => api.update('regions', {
                                                        id: region.id, country,
                                                    })}
                                                />
                                                {!region.country && (
                                                    <span className="text-[11px] text-sky-700 shrink-0">
                                                        не задана — скрыто из фильтров стран
                                                    </span>
                                                )}
                                            </div>
                                            <InlineText
                                                multiline
                                                value={region.description ?? ''}
                                                placeholder="Что это за район?"
                                                className="text-sm text-gray-600 -ml-2"
                                                onCommit={(description) => api.update('regions', {
                                                    id: region.id, description,
                                                })}
                                            />
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ---- Notes ---- */}
            <section id="guide-notes" className="scroll-mt-16">
                <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <h2 className="text-sm font-semibold text-gray-900">Перед поездкой</h2>
                </div>

                <Card className="p-3 mb-2">
                    <div className="flex gap-2">
                        <TextField
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                            placeholder="Добавить заметку: виза, SIM-карты…"
                        />
                        <Button tone="primary" onClick={addNote} disabled={!newTitle.trim()}>Добавить</Button>
                    </div>
                    {/* Templates, because the useful notes are the same five
                        every trip and nobody wants to type the headings. */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">Начать с шаблона:</span>
                        {NOTE_TEMPLATES.map((template) => (
                            <button
                                key={template.title}
                                onClick={() => addTemplate(template)}
                                className="min-h-11 md:min-h-0 rounded-full border border-gray-200 px-2.5 py-1
                                    text-[11px] text-gray-600 hover:bg-gray-50"
                            >
                                {template.title}
                            </button>
                        ))}
                    </div>
                </Card>

                {notes.length === 0 ? (
                    <Card>
                        <EmptyState
                            title="Заметок пока нет"
                            hint="Запустите npm run seed:honeymoon, чтобы загрузить практические советы путеводителя по Бали."
                        />
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {grouped.map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5 px-1">
                                    {category}
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3
                                    gap-2 items-start">
                                    {items.map((note) => (
                                        <Card key={note.id} className="p-3">
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <InlineText
                                                        value={note.title}
                                                        className="font-medium text-gray-900 -ml-2"
                                                        onCommit={(title) => api.update('notes', {
                                                            id: note.id, title,
                                                        })}
                                                    />
                                                    <InlineText
                                                        multiline
                                                        value={note.body}
                                                        placeholder="Подробности… **жирный**, *курсив*, - списки, [ссылки](https://…)"
                                                        className="text-sm text-gray-600 -ml-2 mt-0.5"
                                                        onCommit={(body) => api.update('notes', {
                                                            id: note.id, body,
                                                        })}
                                                    />
                                                    {/* Rendered underneath rather
                                                        than instead: the editor is
                                                        the plain text, and seeing
                                                        both is how you learn what
                                                        the markup does. */}
                                                    {/[*`\[#>-]/.test(note.body) && (
                                                        <details className="mt-1">
                                                            <summary className="cursor-pointer
                                                                text-[11px] text-gray-400">
                                                                С форматированием
                                                            </summary>
                                                            <Markdown
                                                                source={note.body}
                                                                className="mt-1 text-sm text-gray-700"
                                                            />
                                                        </details>
                                                    )}
                                                </div>
                                                <OverflowMenu items={[{
                                                    label: 'Удалить заметку',
                                                    danger: true,
                                                    // Undoable, so no confirm — see the toast.
                                                    onClick: () => api.removeRow(
                                                        'notes', note, `Удалено «${note.title}"`,
                                                    ),
                                                }]} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <InlineText
                                                    value={note.category ?? ''}
                                                    placeholder="Категория"
                                                    className="text-[11px] text-gray-400 -ml-2"
                                                    onCommit={(cat) => api.update('notes', {
                                                        id: note.id, category: cat,
                                                    })}
                                                />
                                                {/* What the note is about. A note
                                                    tied to a region shows up on the
                                                    itinerary whenever that region is
                                                    where you are sleeping — which is
                                                    the moment you want to read it. */}
                                                <MiniSelect
                                                    value={note.region_id != null
                                                        ? String(note.region_id) : ''}
                                                    onChange={(e) => api.update('notes', {
                                                        id: note.id,
                                                        region_id: e.target.value || null,
                                                    })}
                                                    aria-label="К какому региону относится"
                                                >
                                                    <option value="">Вся поездка</option>
                                                    {regions.map((region) => (
                                                        <option key={region.id} value={region.id}>
                                                            О нас {region.name}
                                                        </option>
                                                    ))}
                                                </MiniSelect>
                                                <span className="text-[11px] text-gray-300 shrink-0 pr-1">
                                                    {sourceLabel(note.source)}
                                                </span>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
