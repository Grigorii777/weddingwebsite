import { parseDateParts, parseTimeParts } from './weddingDate';

export const LOCALE = 'ru-RU';

/** Translate stored enums only at the display boundary; custom labels survive. */
export function sideLabel(value: string | null | undefined): string {
    if (!value) return 'Не указано';
    return ({ bride: 'Невеста', groom: 'Жених' } as Record<string, string>)[value] ?? value;
}

export function rsvpLabel(value: string | null | undefined): string {
    if (!value) return 'Нет ответа';
    return ({ attending: 'Придёт', declined: 'Не придёт', likely_not_coming: 'Вероятно, не придёт',
        yes: 'Да', no: 'Нет' } as Record<string, string>)[value] ?? value;
}

/** Russian cardinal forms: 1 гость, 2 гостя, 5 гостей, 21 гость. */
export function plural(value: number, one: string, few: string, many: string): string {
    const n = Math.abs(value);
    if (!Number.isInteger(n)) return few;
    if (n % 100 >= 11 && n % 100 <= 14) return many;
    if (n % 10 === 1) return one;
    if (n % 10 >= 2 && n % 10 <= 4) return few;
    return many;
}

export function counted(value: number, one: string, few: string, many: string): string {
    return `${value.toLocaleString(LOCALE)} ${plural(value, one, few, many)}`;
}

/** Calendar dates have no time zone; format in UTC to keep the entered day. */
export function formatWeddingDate(value: string | undefined | null): string {
    const parts = parseDateParts(value);
    if (!parts) return value ?? '';
    const date = new Date(Date.UTC(parts.year, parts.month, parts.day));
    if (date.getUTCMonth() !== parts.month || date.getUTCDate() !== parts.day) return value ?? '';
    return date.toLocaleDateString(LOCALE, {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
}

export function formatWeddingTime(value: string | undefined | null): string {
    const parts = parseTimeParts(value);
    return parts
        ? `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`
        : value ?? '';
}
