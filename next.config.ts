import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /*
   * Hosts allowed to load dev-server assets cross-origin.
   *
   * `next dev` serves its chunks and its HMR socket only to origins it trusts,
   * and since Next 16.3 it *enforces* that rather than warning. The dev stack in
   * docker/ is browsed by the server's LAN address, not localhost — and without
   * this the pages still render while every chunk 403s, so the site loads and
   * then does nothing: forms submit as plain GETs, no button works. It fails in
   * the one way that does not look like a configuration error.
   *
   * Development only; `next start` ignores it.
   */
  allowedDevOrigins: ["10.0.0.253", "10.0.0.188", "localhost", "127.0.0.1"],
  images: {
    // Next 16 locks the optimizer to quality 75 by default; allow the low
    // quality used for the lightbox's instant placeholder layer.
    qualities: [50, 75],
  },
  /*
   * Security headers, on every route.
   *
   * HSTS keeps browsers from ever talking to the site without TLS (one year,
   * including subdomains; no `preload` — the domain is not submitted to the
   * preload list, and the directive promises what would be checked if it were).
   * `nosniff` stops a browser from re-interpreting a response as a different
   * type. `X-Frame-Options: DENY` says the site is not a frame target, which
   * it is not — the clickjacking vector closes with one token.
   *
   * The content policy ships in *report-only* mode on purpose: it lists
   * exactly what the site loads (itself, plus the three tile servers the
   * honeymoon maps draw from — every other external URL in the code is a
   * guest-clickable link, not a resource load), and report-only means a
   * future addition that violates it shows up in the console as a report
   * instead of breaking the page. Promoting it to enforcing is a follow-up
   * once the reports are quiet. `unsafe-inline` is carried because the layout
   * carries two inline assets (the scrollbar-gutter script and the accent
   * colours' style block) that would each need a hash to drop it.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://tile.openstreetmap.org https://tile.opentopomap.org https://server.arcgisonline.com",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join(" "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
