'use client';
import { counted } from '@/lib/locale';

import { useMemo, useState } from 'react';
import type { ScheduleKind } from '@/lib/finance';
import type { FinanceApi, FinancePayload } from './useFinances';
import {
    AddButton, Card, DeleteButton, EmptyState, InlineNumber, InlineText, Modal, PillButton,
    RowDate, RowField, RowSelect, SelectField, StatTile, TextField, Toggle, formatMoney, todayLocal,
} from './ui';

/**
 * What you owe, and when.
 *
 * The spreadsheet could record that a payment *had* been made but never that one
 * was *coming* — the "Venue 1/4, 2/4" labels were the only hint. Splitting a bill
 * into a deposit and instalments makes the next due date a fact the page can tell
 * you rather than something you have to remember.
 */

const KIND_LABEL: Record<ScheduleKind, string> = {
    deposit: 'Аванс',
    installment: 'Частичный платёж',
    balance: 'Остаток',
};

export default function ScheduleTab({ data, api }: { data: FinancePayload; api: FinanceApi }) {
    const { summary } = data;
    const [splitting, setSplitting] = useState(false);

    const targets = useMemo(
        () => data.categories.map((c) => ({
            name: c.name,
            sectionValue: `c:${c.id}`,
            items: c.items.map((i) => ({ value: `i:${i.id}`, name: i.name })),
        })),
        [data.categories],
    );
    const targetValue = (r: { item_id: number | null; category_id: number | null }) =>
        r.item_id != null ? `i:${r.item_id}` : r.category_id != null ? `c:${r.category_id}` : '';
    const targetPatch = (raw: string) => {
        if (!raw) return { item_id: null, category_id: null };
        const id = Number(raw.slice(2));
        return raw.startsWith('c:')
            ? { category_id: id, item_id: null }
            : { item_id: id, category_id: null };
    };

    const outstanding = summary.schedule.filter((sp) => !sp.settled);
    const settled = summary.schedule.filter((sp) => sp.settled);
    const nextDue = outstanding.find((sp) => sp.due_on);

    const addOne = () =>
        api.create('schedule', {
            label: 'Новый платёж',
            kind: 'installment',
            amount: 0,
            due_on: todayLocal(),
            sort_order: summary.schedule.length,
        });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Запланировано, не оплачено" value={formatMoney(summary.scheduledUnsettled)}
                    hint={`${counted(outstanding.length, 'платёж', 'платежа', 'платежей')}`} />
                <StatTile label="Просрочено" value={formatMoney(summary.overdueTotal)}
                    tone={summary.overdueTotal > 0 ? 'bad' : 'good'}
                    hint={summary.overdueTotal > 0 ? 'срок оплаты прошёл' : 'просроченных нет'} />
                <StatTile label="К оплате в течение 30 дней" value={formatMoney(summary.dueSoonTotal)}
                    tone={summary.dueSoonTotal > 0 ? 'warn' : 'default'} />
                <StatTile label="Ближайший платёж"
                    value={nextDue ? formatMoney(nextDue.amount) : '—'}
                    hint={nextDue
                        ? `${nextDue.label} · ${nextDue.due_on}`
                        : 'не запланировано'} />
            </div>

            {summary.overdueTotal > 0 && (
                <Card className="border-rose-200 bg-rose-50/50 p-4">
                    <p className="text-xs leading-relaxed text-rose-800">
                        <strong>{formatMoney(summary.overdueTotal)} просрочено.</strong>{' '}
                        Если уже оплатили, внесите платёж во вкладке «Покупки» и отметьте здесь как оплаченный, чтобы убрать напоминание.
                    </p>
                </Card>
            )}

            <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-gray-800">Разбить счёт</div>
                        <div className="mt-0.5 text-xs text-gray-400">
                            Разделите статью или раздел на аванс и последующие платежи.
                        </div>
                    </div>
                    <PillButton tone="accent" onClick={() => setSplitting(true)}>
                        Разбить на платежи
                    </PillButton>
                </div>
            </Card>

            <Card className="overflow-hidden">
                <div className="hidden gap-2 border-b border-gray-100 px-4 py-2 text-[10px] font-semibold
                    uppercase tracking-wide text-gray-400 md:grid
                    md:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.4fr)_7rem_7rem_4.5rem_1.75rem]">
                    <div>Платёж</div>
                    <div>Срок оплаты</div>
                    <div>Назначение</div>
                    <div>Тип</div>
                    <div className="text-right">Сумма</div>
                    <div className="text-center">Оплачено</div>
                    <div />
                </div>

                {[...outstanding, ...settled].map((sp) => {
                    const patch = (fields: Record<string, unknown>) =>
                        api.update('schedule', { id: sp.id, ...fields });
                    return (
                        <div key={sp.id}
                            className={`grid grid-cols-1 gap-2 border-b border-gray-100 px-4 py-2 last:border-0
                                md:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.4fr)_7rem_7rem_4.5rem_1.75rem] md:items-center
                                ${sp.settled ? 'bg-emerald-50/30' : sp.isOverdue ? 'bg-rose-50/40' : ''}`}>
                            <div className="flex min-w-0 items-center gap-2">
                                <InlineText
                                    value={sp.label}
                                    onCommit={(label) => patch({ label })}
                                    className={sp.settled ? 'text-gray-400 line-through' : 'text-gray-800'}
                                />
                                {sp.isOverdue && (
                                    <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5
                                        text-[9px] font-semibold uppercase text-rose-700">
                                        Просрочено
                                    </span>
                                )}
                                {!sp.settled && sp.isDueSoon && (
                                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5
                                        text-[9px] font-semibold uppercase text-amber-700">
                                        {sp.daysUntilDue === 0 ? 'Сегодня' : `${sp.daysUntilDue}d`}
                                    </span>
                                )}
                                <span className="shrink-0 pl-1 text-sm font-medium tabular-nums md:hidden">
                                    {formatMoney(sp.amount)}
                                </span>
                            </div>
                            <RowField label="Срок оплаты">
                                <RowDate
                                    value={(sp.due_on ?? '').slice(0, 10)}
                                    aria-label={`Срок оплаты: ${sp.label}`}
                                    onChange={(e) => patch({ due_on: e.target.value })}
                                />
                            </RowField>
                            <RowField label="Назначение">
                                <RowSelect
                                    value={targetValue(sp)}
                                    aria-label={`Что ${sp.label} относится к`}
                                    onChange={(e) => patch(targetPatch(e.target.value))}
                                >
                                    <option value="">— вся свадьба —</option>
                                    {targets.map((group) => (
                                        <optgroup key={group.name} label={group.name}>
                                            <option value={group.sectionValue}>
                                                {group.name} — весь раздел
                                            </option>
                                            {group.items.map((i) => (
                                                <option key={i.value} value={i.value}>{i.name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </RowSelect>
                            </RowField>
                            <RowField label="Тип">
                                <RowSelect
                                    value={sp.kind}
                                    aria-label={`Тип платежа: ${sp.label}`}
                                    onChange={(e) => patch({ kind: e.target.value })}
                                >
                                    {Object.entries(KIND_LABEL).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </RowSelect>
                            </RowField>
                            <RowField label="Сумма" className="hidden md:flex">
                                <InlineNumber value={sp.amount} prefix="$"
                                    onCommit={(amount) => patch({ amount })} />
                            </RowField>
                            <RowField label="Оплачено">
                                <div className="flex justify-end md:justify-center">
                                    <Toggle
                                        checked={sp.settled}
                                        onChange={(settled) => patch({ settled })}
                                        label={`Отметить ${sp.label} оплаченным`}
                                    />
                                </div>
                            </RowField>
                            <DeleteButton
                                label={`Удалить ${sp.label}`}
                                onClick={() => api.removeWithUndo('schedule', sp.id, sp.label, {
                                    label: sp.label, kind: sp.kind, amount: sp.amount,
                                    due_on: sp.due_on, item_id: sp.item_id, category_id: sp.category_id,
                                    sort_order: sp.sort_order,
                                })}
                            />
                        </div>
                    );
                })}

                {!summary.schedule.length && (
                    <EmptyState>
                        Платежи ещё не запланированы. Используйте <strong>Разбить на платежи</strong> выше или добавьте отдельный платёж ниже.
                    </EmptyState>
                )}

                <div className="border-t border-gray-50 px-4 py-2">
                    <AddButton onClick={addOne}>+ Запланировать платёж</AddButton>
                </div>
            </Card>

            {splitting && (
                <SplitBill data={data} api={api} onClose={() => setSplitting(false)} />
            )}
        </div>
    );
}

/* --------------------------------------------------------------- split ------ */

function SplitBill({ data, api, onClose }: {
    data: FinancePayload;
    api: FinanceApi;
    onClose: () => void;
}) {
    const firstSection = data.categories[0];
    const [target, setTarget] = useState(firstSection ? `c:${firstSection.id}` : '');
    const [count, setCount] = useState(4);
    const [deposit, setDeposit] = useState(0);
    const [firstDue, setFirstDue] = useState(todayLocal());
    const [everyDays, setEveryDays] = useState(30);
    const [busy, setBusy] = useState(false);

    const targetTotal = useMemo(() => {
        if (target.startsWith('c:')) {
            const id = Number(target.slice(2));
            return data.summary.categories.find((c) => c.id === id)?.total ?? 0;
        }
        if (target.startsWith('i:')) {
            const id = Number(target.slice(2));
            return data.summary.items.find((i) => i.id === id)?.total ?? 0;
        }
        return data.summary.budgetTotal;
    }, [target, data.summary]);

    const targetName = useMemo(() => {
        if (target.startsWith('c:')) {
            const id = Number(target.slice(2));
            return data.categories.find((c) => c.id === id)?.name ?? '';
        }
        const id = Number(target.slice(2));
        return data.categories.flatMap((c) => c.items).find((i) => i.id === id)?.name ?? '';
    }, [target, data.categories]);

    // Any rounding remainder lands on the final payment so the parts always add
    // back up to the whole bill exactly.
    const afterDeposit = Math.max(0, targetTotal - deposit);
    const per = count > 0 ? Math.floor((afterDeposit / count) * 100) / 100 : 0;
    const lastPayment = count > 0 ? Math.round((afterDeposit - per * (count - 1)) * 100) / 100 : 0;

    const create = async () => {
        if (!target) return;
        setBusy(true);
        const link = target.startsWith('c:')
            ? { category_id: Number(target.slice(2)), item_id: null }
            : { item_id: Number(target.slice(2)), category_id: null };
        const start = new Date(firstDue);
        let order = data.schedule.length;

        if (deposit > 0) {
            await api.create('schedule', {
                ...link, label: `${targetName} аванс`, kind: 'deposit',
                amount: deposit, due_on: firstDue, sort_order: order,
            });
            order += 1;
        }
        for (let n = 0; n < count; n += 1) {
            const due = new Date(start);
            due.setDate(due.getDate() + everyDays * (deposit > 0 ? n + 1 : n));
            const isLast = n === count - 1;
            await api.create('schedule', {
                ...link,
                label: `${targetName} ${n + 1}/${count}`,
                kind: isLast ? 'balance' : 'installment',
                amount: isLast ? lastPayment : per,
                due_on: due.toISOString().slice(0, 10),
                sort_order: order,
            });
            order += 1;
        }
        setBusy(false);
        onClose();
    };

    return (
        <Modal title="Разбить счёт на платежи" onClose={onClose}>
            <div className="space-y-4">
                <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-gray-500">Выберите счёт</span>
                    <SelectField value={target} onChange={(e) => setTarget(e.target.value)}>
                        {data.categories.map((c) => (
                            <optgroup key={c.id} label={c.name}>
                                <option value={`c:${c.id}`}>{c.name} — весь раздел</option>
                                {c.items.map((i) => <option key={i.id} value={`i:${i.id}`}>{i.name}</option>)}
                            </optgroup>
                        ))}
                    </SelectField>
                    <span className="mt-1 block text-[11px] text-gray-400">
                        В бюджете {formatMoney(targetTotal)}
                    </span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-500">Первоначальный взнос</span>
                        <TextField type="number" min={0} value={deposit}
                            onChange={(e) => setDeposit(Math.max(0, Number(e.target.value) || 0))} />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-500">Число оставшихся платежей</span>
                        <TextField type="number" min={1} max={24} value={count}
                            onChange={(e) => setCount(Math.min(24, Math.max(1, Math.trunc(Number(e.target.value) || 1))))} />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-500">Дата первого платежа</span>
                        <TextField type="date" value={firstDue}
                            onChange={(e) => setFirstDue(e.target.value)} />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-500">Интервал в днях</span>
                        <TextField type="number" min={1} value={everyDays}
                            onChange={(e) => setEveryDays(Math.max(1, Math.trunc(Number(e.target.value) || 30)))} />
                    </label>
                </div>

                <div className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-600">
                    {deposit > 0 && <div>Аванс {formatMoney(deposit)} дата {firstDue}</div>}
                    <div>
                        {counted(count, 'платёж', 'платежа', 'платежей')} из {formatMoney(per)}
                        {Math.abs(lastPayment - per) > 0.005 && (
                            <> (последний платёж {formatMoney(lastPayment)} с учётом округления)</>
                        )}
                        , каждые {everyDays} дней
                    </div>
                    <div className="mt-1 font-semibold text-gray-800">
                        Итоги {formatMoney(deposit + per * Math.max(0, count - 1) + lastPayment)}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <PillButton onClick={onClose}>Отмена</PillButton>
                    <PillButton tone="accent" onClick={create} disabled={busy || !target}>
                        {busy ? 'Создаём…' : 'Создать график'}
                    </PillButton>
                </div>
            </div>
        </Modal>
    );
}
