# Web accessibility

Build interfaces that work for keyboard, screen reader, zoom, and motion-sensitive users.

## Non-negotiables

- All interactive elements reachable and operable by keyboard (Tab, Enter, Space, Escape).
- Visible focus indicators (never `outline: none` without a replacement).
- Labels on every form control (`<label for>` or `aria-labelledby`).
- Images: meaningful `alt`; decorative images `alt=""`.
- Color contrast meets WCAG AA (see [[Web Design Fundamentals]]).

## Semantics

- Prefer native elements: `<button>`, `<a href>`, `<input>`, `<nav>`, `<main>`, `<header>`.
- Use ARIA only when HTML cannot express the pattern (tabs, combobox, live regions).
- Headings reflect outline, not visual size only.

## Dynamic UI

- Announce important updates with `aria-live="polite"` or `assertive` sparingly.
- Trap focus in modals; restore focus on close.
- Do not auto-play video/audio; provide pause controls.

## Motion and readability

- Respect `prefers-reduced-motion`: shorten or disable large animations.
- Support 200% zoom without horizontal scroll on primary content.
- Line length and spacing aid dyslexia-friendly reading.

## Testing

- Keyboard-only pass through primary flows.
- Screen reader smoke test (NVDA, VoiceOver, or Narrator).
- Automated: axe, Lighthouse accessibility audit; fix critical issues first.

## See also

- [[Web Design Fundamentals]]
- [[Seo Basics]]
