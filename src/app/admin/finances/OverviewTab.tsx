'use client';
import { counted, formatWeddingDate } from '@/lib/locale';

import { useState } from 'react';
import type { PayerSummary } from '@/lib/finance';
import type { FinancePayload } from './useFinances';
import { ExportButtons, TrendCard, WhatIf } from './extras';
import { Bar, Card, EmptyState, StatTile, formatMoney } from './ui';

type Scenario = 'pledged' | 'cash';

export default function OverviewTab({ data }: { data: FinancePayload }) {
    const { summary, weddingDate } = data;
    const [scenario, setScenario] = useState<Scenario>('cash');

    const optimistic = scenario === 'pledged';
    const deficit = optimistic ? summary.deficitPledged : summary.deficitCash;
    const stillToSpend = optimistic ? summary.stillToSpendPledged : summary.stillToSpendCash;
    const share = (p: PayerSummary) => (optimistic ? p.sharePledged : p.shareCash);
    const remaining = (p: PayerSummary) => (optimistic ? p.remainingPledged : p.remainingCash);
    const plan = (p: PayerSummary) => (optimistic ? p.planPledged : p.planCash);

    // No days left means the wedding date has passed or was never set, so a
    // per-month figure would be meaningless.
    const noHorizon = summary.horizon.days <= 0;

    // Only line-level overruns; a section paid in installments is tracked against
    // the section total, so its lines legitimately show no spend of their own.
    const overruns = summary.items
        .filter((i) => i.variance > 0)
        .sort((a, b) => b.variance - a.variance);
    const overpaidSections = summary.categories.filter((c) => c.remaining < 0);

    return (
        /*
         * One column up to xl, two above it. A page of full-width cards on a
         * 1600px screen puts "Vendor bills" and its one line of text across
         * fourteen hundred pixels; in two columns the same cards read at a
         * sensible measure and half the scrolling disappears. Multicol rather
         * than a grid because the cards are wildly different heights and a grid
         * would leave a ragged hole beside every short one.
         */
        <div className="space-y-5 xl:space-y-0 xl:columns-2 xl:gap-5
            [&>*]:xl:mb-5 [&>*]:xl:break-inside-avoid">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:[column-span:all]">
                <StatTile label="Общий бюджет" value={formatMoney(summary.budgetTotal)}
                    hint={`${summary.itemCount} статей расходов`} />
                <StatTile label="Оплачено по бюджету" value={formatMoney(summary.paidTotal)}
                    hint={summary.giftAppliedTotal > 0
                        ? `${formatMoney(summary.budgetedOutOfPocket)} ваши средства и ${formatMoney(summary.giftAppliedTotal)} подарок`
                        : 'всё из собственных средств'} />
                <StatTile label="Денежные подарки получены" value={formatMoney(summary.receivedTotal)} tone="good"
                    hint={summary.giftUnapplied > 0
                        ? `${formatMoney(summary.giftUnapplied)} ещё не распределено`
                        : 'всё распределено по расходам'} />
                <StatTile
                    label="Осталось оплатить"
                    value={formatMoney(Math.max(0, stillToSpend))}
                    tone={stillToSpend > 0 ? 'warn' : 'good'}
                    hint={optimistic ? 'с учётом обещанной помощи' : 'только полученные деньги'}
                />
            </div>

            {(summary.overdueTotal > 0 || summary.dueSoonTotal > 0) && (
                <Card className={`p-4 ${summary.overdueTotal > 0
                    ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/40'}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className={`text-sm font-semibold ${summary.overdueTotal > 0
                            ? 'text-rose-900' : 'text-amber-900'}`}>
                            {summary.overdueTotal > 0
                                ? `${formatMoney(summary.overdueTotal)} просрочено`
                                : `${formatMoney(summary.dueSoonTotal)} к оплате в течение 30 дней`}
                        </span>
                        <span className="text-xs text-gray-500">
                            {summary.schedule.filter((sp) => !sp.settled).slice(0, 2)
                                .map((sp) => `${sp.label} ${sp.due_on ?? ''}`).join(' · ')}
                        </span>
                    </div>
                </Card>
            )}

            <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-gray-800">Сценарий планирования</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {optimistic
                                ? 'Учитываем всю обещанную помощь как будущие поступления.'
                                : 'Учитываем только уже полученные деньги.'}
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <ScenarioPill active={!optimistic} onClick={() => setScenario('cash')}>
                            Полученные деньги
                        </ScenarioPill>
                        <ScenarioPill active={optimistic} onClick={() => setScenario('pledged')}>
                            С учётом обещаний
                        </ScenarioPill>
                    </div>
                </div>
            </Card>

            <Card className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-sm">
                    <span className="font-semibold text-gray-800">Счета подрядчиков</span>
                    <span className="text-gray-500">
                        {formatMoney(summary.paidTotal)} оплачено из {formatMoney(summary.budgetTotal)}
                        {' — '}
                        <strong className="text-gray-800">{formatMoney(summary.billRemaining)} осталось оплатить</strong>
                    </span>
                </div>
                {summary.giftUnapplied > 0 && (
                    <p className="text-[11px] text-gray-400 mt-2">
                        У вас также есть {formatMoney(summary.giftUnapplied)} подаренных денег без назначения. Распределите их во вкладке «Денежные подарки», чтобы учесть в расходах.
                    </p>
                )}
                {summary.unlinkedSpend > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1">
                        И {formatMoney(summary.unlinkedSpend)} расходов не привязано к бюджету и здесь не учитывается. Назначьте статью во вкладке «Покупки» или добавьте новую статью.
                    </p>
                )}
            </Card>

            <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-1">Ваша доля расходов</h3>
                <p className="text-xs text-gray-400 mb-4">
                    Бюджет {formatMoney(summary.budgetTotal)} минус{' '}
                    {optimistic ? 'обещано' : 'получено'} взносы{' '}
                    {formatMoney(optimistic ? summary.pledgedTotal : summary.receivedTotal)}
                    {' = '}
                    <strong className="text-gray-700">{formatMoney(deficit)}</strong>, распределение по долям ниже.
                </p>

                {summary.isOverFunded && (
                    <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Взносы уже покрывают весь бюджет. Остаток:{' '}
                        <strong>{formatMoney(-deficit)}</strong> — в этом сценарии вам больше ничего не нужно доплачивать.
                    </p>
                )}
                {!summary.isOverFunded && Math.abs(summary.unallocatedDeficitCash) > 0.5 && (
                    <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <strong>{formatMoney(summary.unallocatedDeficitCash)}</strong> дефицита не распределено. Задайте хотя бы одному плательщику долю больше 0% в настройках.
                    </p>
                )}

                {summary.payers.length ? (
                    <div className="space-y-3">
                        {summary.payers.map((payer) => {
                            const owed = remaining(payer);
                            const ahead = owed < 0;
                            const p = plan(payer);
                            return (
                                <div key={payer.id} className="rounded-2xl border border-gray-100 p-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                                        <div>
                                            <span className="font-semibold text-gray-900">{payer.name}</span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                {payer.isContributorOnly
                                                    ? 'помогает с оплатой — ничего не должен'
                                                    : `${payer.sharePct}% доля`}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-semibold tabular-nums ${ahead ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                {payer.isContributorOnly
                                                    ? `${formatMoney(payer.spentOnBudget)} внесено`
                                                    : ahead
                                                        ? `${formatMoney(-owed)} сверх доли`
                                                        : `${formatMoney(owed)} осталось`}
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                {!payer.isContributorOnly && `доля ${formatMoney(share(payer))} · `}
                                                оплачено {formatMoney(payer.spentOnBudget)}
                                                {payer.spent !== payer.spentOnBudget && (
                                                    <> · {formatMoney(payer.spent - payer.spentOnBudget)} вне бюджета</>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {payer.isContributorOnly ? (
                                        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                                            {payer.name} не имеет доли в бюджете — его платежи уменьшают вашу общую задолженность.
                                        </p>
                                    ) : ahead ? (
                                        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                                            {payer.name} уже оплатил больше своей доли. Следующие расходы стоит распределить между остальными.
                                        </p>
                                    ) : noHorizon ? (
                                        <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                                            Оплатить нужно сейчас — времени на распределение платежей не осталось.{' '}
                                            {weddingDate
                                                ? 'Дата свадьбы прошла. Укажите срок планирования в настройках.'
                                                : 'Укажите дату свадьбы в общих настройках или срок планирования в настройках финансов.'}
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <PlanCell label="в месяц" value={p.perMonth} />
                                            <PlanCell label="с каждой зарплаты" value={p.perPaycheck} />
                                            <PlanCell label="в день" value={p.perDay} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState>Добавьте плательщиков в настройках для распределения расходов.</EmptyState>
                )}

                {!noHorizon && (
                    <p className="text-[11px] text-gray-400 mt-3">
                        Распределено на {summary.horizon.days.toLocaleString('ru-RU')} дней
                        {' '}({summary.horizon.months.toFixed(1)} месяцев, ~{Math.floor(summary.horizon.paychecks)} зарплат)
                        {summary.horizon.derived && weddingDate
                            ? ` до ${formatWeddingDate(weddingDate)}.`
                            : ' по заданному сроку планирования.'}
                    </p>
                )}
            </Card>

            <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-1">Оплата по разделам</h3>
                <p className="text-xs text-gray-400 mb-4">
                    Оплата по каждому разделу с учётом частичных платежей и оплаты отдельных статей.
                </p>
                <div className="space-y-4">
                    {summary.categories.map((category) => {
                        const overpaid = category.remaining < 0;
                        return (
                            <div key={category.id}>
                                <div className="flex justify-between items-baseline text-sm mb-1">
                                    <span className="font-medium text-gray-700">
                                        {category.name}
                                        {category.installmentCount > 0 && (
                                            <span className="text-[11px] text-gray-400 ml-2">
                                                {counted(category.installmentCount, 'частичный платёж', 'частичных платежа', 'частичных платежей')}
                                            </span>
                                        )}
                                        {category.giftApplied > 0 && (
                                            <span className="text-[11px] text-emerald-600 ml-2">
                                                🎁 {formatMoney(category.giftApplied)}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        <span className="tabular-nums font-medium text-gray-700">
                                            {formatMoney(category.paid)}
                                        </span>
                                        {' из '}
                                        <span className="tabular-nums">{formatMoney(category.total)}</span>
                                    </span>
                                </div>
                                <Bar pct={category.paidPct} tone={overpaid ? 'rose' : 'accent'} />
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                    <span>{category.paidPct.toFixed(0)}% оплачено</span>
                                    <span className={overpaid ? 'text-rose-600 font-medium' : ''}>
                                        {overpaid
                                            ? `переплата ${formatMoney(-category.remaining)}`
                                            : `${formatMoney(category.remaining)} осталось оплатить`}
                                        {' · '}{category.pct.toFixed(1)}% бюджета
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {!summary.categories.length && <EmptyState>Разделов бюджета пока нет.</EmptyState>}
                </div>
            </Card>

            <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-1">Крупнейшие расходы</h3>
                <p className="text-xs text-gray-400 mb-4">10 самых дорогих статей.</p>
                <div className="space-y-2">
                    {[...summary.items]
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 10)
                        .map((item) => (
                            <div key={item.id} className="flex items-center gap-3 text-sm">
                                <span className="flex-1 truncate text-gray-700">
                                    {item.name}
                                    {item.isPaid && (
                                        <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700
                                            font-semibold px-1.5 py-0.5 rounded-full align-middle">ОПЛАЧЕНО</span>
                                    )}
                                </span>
                                <span className="text-[11px] text-gray-400 tabular-nums w-12 text-right">
                                    {item.pct.toFixed(1)}%
                                </span>
                                <span className="tabular-nums w-24 text-right font-medium">
                                    {formatMoney(item.total)}
                                </span>
                            </div>
                        ))}
                    {!summary.items.length && <EmptyState>Статей расходов пока нет.</EmptyState>}
                </div>
            </Card>

            <Card className="p-5">
                <h3 className="mb-1 font-semibold text-gray-900">Стоимость на гостя</h3>
                <p className="mb-4 text-xs text-gray-400">
                    Поможет, пока список гостей ещё меняется.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            на гостя
                        </div>
                        <div className="mt-0.5 text-sm font-semibold tabular-nums">
                            {formatMoney(summary.guestCost.perGuest)}
                        </div>
                        <div className="text-[11px] text-gray-400">
                            {summary.guestCost.guests} гостей
                        </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            ещё один взрослый
                        </div>
                        <div className="mt-0.5 text-sm font-semibold tabular-nums text-amber-600">
                            +{formatMoney(summary.guestCost.marginalPerAdult)}
                        </div>
                        <div className="text-[11px] text-gray-400">
                            {counted(summary.guestCost.marginalLines.length, 'статья с расчётом на гостя', 'статьи с расчётом на гостя', 'статей с расчётом на гостя')}
                            {summary.guestCost.marginalLines.length === 1 ? '' : ''}
                        </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            стол на 10 человек
                        </div>
                        <div className="mt-0.5 text-sm font-semibold tabular-nums text-amber-600">
                            +{formatMoney(summary.guestCost.marginalPerAdult * 10)}
                        </div>
                    </div>
                </div>
                {summary.guestCost.marginalLines.length > 0 && (
                    <p className="mt-3 text-[11px] text-gray-400">
                        Из{' '}
                        {summary.guestCost.marginalLines
                            .map((l) => `${l.name} ${formatMoney(l.unitCost)}`).join(' + ')}
                    </p>
                )}
            </Card>

            {summary.warnings.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/40 p-5">
                    <h3 className="mb-1 font-semibold text-amber-900">Возможные ошибки</h3>
                    <p className="mb-3 text-xs text-amber-700">
                        Возможные дубликаты записей и суммы, которые требуют проверки.
                    </p>
                    <div className="space-y-1.5">
                        {summary.warnings.map((w, i) => (
                            <div key={`${w.kind}${i}`}
                                className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm">
                                <div className="text-gray-700">{w.message}</div>
                                <div className="mt-0.5 text-[11px] text-gray-400">{w.detail}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <TrendCard snapshots={data.snapshots} />
            <WhatIf data={data} />

            <Card className="p-4 print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-gray-800">Поделиться</div>
                        <div className="mt-0.5 text-xs text-gray-400">
                            Таблица для учёта или печатная копия для встречи с подрядчиком.
                        </div>
                    </div>
                    <ExportButtons data={data} />
                </div>
            </Card>

            {(overruns.length > 0 || overpaidSections.length > 0 || summary.unlinkedSpend > 0) && (
                <Card className="p-5 border-amber-200 bg-amber-50/40">
                    <h3 className="font-semibold text-amber-900 mb-1">Стоит проверить</h3>
                    <p className="text-xs text-amber-700 mb-3">
                        Превышение бюджета и деньги, которые нигде не учитываются.
                    </p>
                    <div className="space-y-1.5">
                        {overpaidSections.map((category) => (
                            <div key={`c${category.id}`} className="flex items-center gap-2 text-sm bg-white
                                rounded-xl border border-amber-100 px-3 py-2">
                                <span className="flex-1 truncate text-gray-700">
                                    {category.name} <span className="text-gray-400 text-xs">(весь раздел)</span>
                                </span>
                                <span className="text-[11px] text-gray-400">
                                    бюджет {formatMoney(category.total)} · оплачено {formatMoney(category.paid)}
                                </span>
                                <span className="text-rose-600 font-semibold tabular-nums text-xs">
                                    +{formatMoney(-category.remaining)}
                                </span>
                            </div>
                        ))}
                        {overruns.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm bg-white rounded-xl
                                border border-amber-100 px-3 py-2">
                                <span className="flex-1 truncate text-gray-700">{item.name}</span>
                                <span className="text-[11px] text-gray-400">
                                    бюджет {formatMoney(item.total)} · оплачено {formatMoney(item.paid)}
                                </span>
                                <span className="text-rose-600 font-semibold tabular-nums text-xs">
                                    +{formatMoney(item.variance)}
                                </span>
                            </div>
                        ))}
                        {summary.unlinkedSpend > 0 && (
                            <div className="flex items-center gap-2 text-sm bg-white rounded-xl
                                border border-amber-100 px-3 py-2">
                                <span className="flex-1 text-gray-700">Покупки без статьи бюджета</span>
                                <span className="font-semibold tabular-nums text-xs text-amber-700">
                                    {formatMoney(summary.unlinkedSpend)}
                                </span>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}

function PlanCell({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
            <div className="font-semibold tabular-nums text-sm text-gray-900">{formatMoney(value)}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mt-0.5">{label}</div>
        </div>
    );
}

function ScenarioPill({ active, onClick, children }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border
                ${active
                    ? 'bg-accent text-white border-transparent'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
        >
            {children}
        </button>
    );
}
