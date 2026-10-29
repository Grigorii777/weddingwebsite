import { parseDateParts } from '@/lib/weddingDate';

interface FooterProps {
    brideName?: string;
    groomName?: string;
    weddingDate?: string;
    weddingLocation?: string;
    footerHeroImage?: string;
}

export default function Footer({
    brideName = '',
    groomName = '',
    weddingDate = '',
    footerHeroImage
}: FooterProps) {
    // The copyright year is the wedding's year, not a number typed into the
    // template in 2026.
    const year = parseDateParts(weddingDate)?.year ?? new Date().getFullYear();
    const couple = brideName && groomName ? `${brideName} и ${groomName}` : '';
    const imageUrl = footerHeroImage
        ? `/api/photos/${footerHeroImage}`
        : undefined;

    return (
        <footer
            className={`bg-white ${imageUrl ? 'bg-cover bg-center py-20' : 'border-t border-gray-100 py-8'}`}
            style={imageUrl ? { backgroundImage: `url('${imageUrl}')` } : undefined}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <p className="text-center text-base text-gray-900 font-serif">
                    &copy; {year}{couple ? ` ${couple}.` : ''} С нетерпением ждём встречи с вами!
                </p>
            </div>
        </footer>
    );
}
