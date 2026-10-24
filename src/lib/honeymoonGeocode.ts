/** Pure Google Maps URL and coordinate readers, shared with the geocoder tests. */
function finite(value: number): boolean {
    return Number.isFinite(value) && Math.abs(value) <= 180;
}

export function validCoordinates(lat: number, lng: number): boolean {
    return finite(lat) && finite(lng) && Math.abs(lat) <= 90 && !(lat === 0 && lng === 0);
}

/**
 * Extract coordinates from a Google Maps URL.
 *
 * Handles the three shapes Google actually emits:
 *   .../@-8.6478,115.1385,17z      the map centre
 *   ...!3d-8.6478!4d115.1385       the pin itself (preferred — the centre can
 *                                  be offset when a side panel is open)
 *   ...?q=-8.6478,115.1385         a coordinate query
 */
export function coordsFromMapsUrl(input: string): { lat: number; lng: number } | null {
    const pin = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (pin) {
        const lat = Number(pin[1]);
        const lng = Number(pin[2]);
        if (validCoordinates(lat, lng)) return { lat, lng };
    }

    const query = input.match(/[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (query) {
        const lat = Number(query[1]);
        const lng = Number(query[2]);
        if (validCoordinates(lat, lng)) return { lat, lng };
    }

    const at = input.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) {
        const lat = Number(at[1]);
        const lng = Number(at[2]);
        if (validCoordinates(lat, lng)) return { lat, lng };
    }

    return null;
}

/**
 * Recover the place name from a Google Maps URL.
 *
 * The /place/ segment carries the name Google shows, plus-encoded. Worth having
 * because it is usually the name you would have typed anyway, and it saves
 * retyping it after a paste.
 */
export function nameFromMapsUrl(input: string): string | null {
    const match = input.match(/\/place\/([^/@?]+)/);
    if (!match) return null;
    try {
        const decoded = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
        // "Ubud Palace, Jalan Raya Ubud, Bali" -> "Ubud Palace". The tail is the
        // address, which is reverse-geocoded separately and more reliably.
        const head = decoded.split(',')[0].trim();
        if (!head || /^-?\d+(\.\d+)?$/.test(head)) return null;
        return head;
    } catch {
        return null;
    }
}

/** A bare "-8.6478, 115.1385" pasted straight in. */
export function coordsFromPair(input: string): { lat: number; lng: number } | null {
    const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    return validCoordinates(lat, lng) ? { lat, lng } : null;
}

