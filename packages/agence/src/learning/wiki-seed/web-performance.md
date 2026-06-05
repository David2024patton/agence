# Web performance

Ship fast pages: better UX, SEO, and conversion.

## Metrics

- **LCP** (Largest Contentful Paint): main content visible, target under 2.5s.
- **INP** (Interaction to Next Paint): responsiveness, target under 200ms.
- **CLS** (Cumulative Layout Shift): visual stability, target under 0.1.

## Loading strategy

- Critical CSS inline or loaded first; defer non-critical CSS.
- JavaScript: code-split routes; defer or async non-critical scripts.
- Images: modern formats (AVIF/WebP), `width`/`height`, `loading="lazy"` below fold.
- Fonts: subset, `font-display: swap`, preload only critical weights.

## Network

- CDN for static assets; HTTP/2 or HTTP/3.
- Compress (Brotli/gzip); cache with immutable hashes for hashed filenames.
- Preconnect to third-party origins you actually use.

## Backend and data

- Cache HTML/API at the edge where safe; invalidate on publish.
- Database: index queries; avoid N+1; paginate lists.
- API payloads: return only fields the UI needs.

## Measurement workflow

- Lighthouse and WebPageTest on representative URLs (mobile + desktop).
- Real User Monitoring (RUM) in production beats lab-only scores.
- Fix the largest bottleneck first (often images, JS bundle, or slow API).

## See also

- [[Seo Basics]]
- [[Web Design Fundamentals]]
