'use client';

import { useState } from 'react';
import type { ShareLink, ShareScope } from '@/lib/honeymoon';
import { formatDate } from '@/lib/honeymoon';
import type { HoneymoonApi } from './useHoneymoon';
import { Button, MiniSelect, TextField } from './ui';

const SCOPES: { key: ShareScope; label: string; hint: string }[] = [
    { key: 'today', label: 'Только сегодня', hint: 'Только текущий день' },
    { key: 'itinerary', label: 'Весь маршрут', hint: 'Все дни с переключением' },
    { key: 'all', label: 'Маршрут и путеводитель', hint: 'Включает заметки путеводителя' },
];

/**
 * Read-only links, one per person you hand one to.
 *
 * A link is a credential in a URL, so the interface is built around that: it is
 * shown once next to a Copy button, it can be revoked without being deleted (a
 * link that leaked should stay dead), and it says when it was last opened so an
 * unused one is obvious.
 */
export default function ShareLinks({ api }: { api: HoneymoonApi }) {
    const shares = api.data?.shares ?? [];
    const [label, setLabel] = useState('');
    const [scope, setScope] = useState<ShareScope>('itinerary');
    const [expires, setExpires] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState<number | null>(null);

    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const urlFor = (share: ShareLink) => `${origin}/honeymoon/${share.token}`;

    const create = async () => {
        setBusy(true);
        try {
            const res = await fetch('/api/admin/honeymoon/shares', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, scope, expires_on: expires || null }),
            });
            if (res.ok) {
                setLabel('');
                setExpires('');
                await api.refresh();
            }
        } finally {
            setBusy(false);
        }
    };

    const setRevoked = async (share: ShareLink, revoked: boolean) => {
        await fetch('/api/admin/honeymoon/shares', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: share.id, revoked }),
        });
        await api.refresh();
    };

    const destroy = async (share: ShareLink) => {
        if (!confirm(`Удалить ссылку для ${share.label || 'этого человека'}? Она перестанет работать.`)) return;
        await fetch(`/api/admin/honeymoon/shares?id=${share.id}`, { method: 'DELETE' });
        await api.refresh();
    };

    const copy = async (share: ShareLink) => {
        try {
            await navigator.clipboard.writeText(urlFor(share));
            setCopied(share.id);
            setTimeout(() => setCopied(null), 2000);
        } catch { /* clipboard blocked — the link is on screen to select */ }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1">
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Для кого</label>
                    <TextField
                        value={label}
                                placeholder="Анна"
                        onChange={(e) => setLabel(e.target.value)}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Показывать</label>
                    <MiniSelect
                        value={scope}
                        onChange={(e) => setScope(e.target.value as ShareScope)}
                    >
                        {SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </MiniSelect>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                        Срок действия (необязательно)
                    </label>
                    <TextField
                        type="date"
                        value={expires}
                        onChange={(e) => setExpires(e.target.value)}
                    />
                </div>
                <Button tone="primary" onClick={create} disabled={busy}>
                    {busy ? 'Создаём…' : 'Создать ссылку'}
                </Button>
            </div>

            {shares.length === 0 ? (
                <p className="text-xs text-gray-500">
                    Ссылок пока нет. Они дают только просмотр поездки без редактирования.
                </p>
            ) : (
                <ul className="space-y-2">
                    {shares.map((share) => (
                        <li
                            key={share.id}
                            className={`rounded-2xl border p-3 ${share.revoked
                                ? 'border-gray-200 bg-gray-50 opacity-60'
                                : 'border-gray-200'}`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">
                                    {share.label || 'Ссылка без названия'}
                                </span>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs
                                    text-gray-600">
                                    {SCOPES.find((s) => s.key === share.scope)?.label ?? share.scope}
                                </span>
                                {share.revoked && (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs
                                        font-medium text-rose-700">
                                        Отозвана
                                    </span>
                                )}
                                {share.expires_on && (
                                    <span className="text-xs text-gray-500">
                                        до {formatDate(share.expires_on)}
                                    </span>
                                )}
                                <span className="ml-auto text-xs text-gray-400">
                                    {share.last_seen_at
                                        ? `открыта ${new Date(share.last_seen_at).toLocaleDateString('ru-RU')}`
                                        : 'ещё не открывалась'}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <code className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-2
                                    py-1.5 text-xs text-gray-600">
                                    {urlFor(share)}
                                </code>
                                <Button onClick={() => copy(share)}>
                                    {copied === share.id ? 'Скопировано' : 'Копировать'}
                                </Button>
                                <Button onClick={() => setRevoked(share, !share.revoked)}>
                                    {share.revoked ? 'Восстановить' : 'Отозвать'}
                                </Button>
                                <Button tone="danger" onClick={() => destroy(share)}>Удалить</Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
