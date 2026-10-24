'use client';

/**
 * One person's "under 21", as a pill.
 *
 * Deliberately *not* one of the `DietaryPills`. Those answer what is on a plate;
 * this answers nothing about a plate at all — an under-21 guest eats the same
 * adult dinner as everybody else. It answers only who the bar is charged for,
 * which is why it is stored on the guest list beside the person rather than on
 * their RSVP beside their restrictions.
 */
export default function Under21Pill({ on, onChange }: {
    on: boolean;
    onChange: (on: boolean) => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={() => onChange(!on)}
            title="Младше 21 года — взрослое меню, без расходов на алкоголь"
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                on
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
        >
            Младше 21 года
        </button>
    );
}
