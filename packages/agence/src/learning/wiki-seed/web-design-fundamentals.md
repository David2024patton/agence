# Web design fundamentals

Practical checklist for building clear, modern sites and apps. Use with [[Seo Basics]] and [[Web Accessibility]].

## Layout and hierarchy

- One primary action per screen; secondary actions visually quieter.
- Use a consistent grid (8px base) and spacing scale (4, 8, 16, 24, 32, 48).
- Establish visual hierarchy: size, weight, color, and whitespace before adding decoration.
- Mobile-first: design narrow, then add breakpoints (`sm`, `md`, `lg`) instead of shrinking desktop layouts.

## Typography

- Limit families (1–2). Pair a readable sans for UI with an optional display face for marketing heroes.
- Body 16–18px, line-height 1.5–1.65, max line length ~65–75 characters.
- Use a type scale (e.g. 12 / 14 / 16 / 20 / 24 / 32 / 40) instead of arbitrary sizes.

## Color and contrast

- Define semantic tokens: `background`, `surface`, `text`, `text-muted`, `border`, `accent`, `danger`.
- Test contrast: WCAG AA is 4.5:1 for normal text, 3:1 for large text and UI components.
- Do not rely on color alone for state (add icons, labels, or patterns).

## Components

- Reuse buttons, inputs, cards, and nav patterns; document variants (primary, ghost, destructive).
- Empty, loading, and error states are part of the design, not polish at the end.
- Prefer real content in mocks; lorem hides layout breaks.

## Handoff to code

- Name tokens in CSS variables or Tailwind theme extension.
- Specify breakpoints, focus rings, and motion (duration, easing) for accessibility.
- Export assets at 1x and 2x; prefer SVG for icons and simple illustrations.

## See also

- [[Seo Basics]]
- [[Web Accessibility]]
- [[Web Performance]]
