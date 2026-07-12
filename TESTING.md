# HypeForge Verification

## Automated checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:a11y
pnpm test:browsers
pnpm build
pnpm verify:api
```

- Unit/API tests cover guideline boundaries, semantic reconciliation, bounded repair, fail-closed behavior, prompt injection, role/function resolution, non-English roles, card history, multi-level escalation, deck distinctness, clipboard fallback, request timeout, sharing, and taste votes.
- `test:a11y` runs axe WCAG A/AA checks against desktop/mobile generator states, the guide dialog, and the public guide.
- `test:browsers` checks 375px and 1440px layouts in Chrome/Chromium, Firefox, and Safari/WebKit, including required input, dialog keyboard closing, console errors, and horizontal overflow.
- `verify:api` makes a real local Gemini generation request and fails if HTTP or application-level success is false.

## Browser acceptance completed locally

- Required function and optional details are distinct inputs.
- One action returns three distinct 8/8 cards.
- Rule proof expands with exact evidence and independent semantic-audit labels.
- One card escalates independently from Drama 01 to 02 to 03.
- Copy after multiple escalations returns the current Drama 03 text.
- Dialogs trap focus, close with Escape, restore focus, and lock background scrolling.
- No horizontal overflow or clipped interactive controls at 320, 375, 768, 1024, or 1440 pixels.
- A 720px CSS viewport, equivalent to a 1440px page viewed at 200% zoom, remains usable without clipping.
- Real generation succeeded for the non-English role `Ingénieur logiciel`, with three 8/8 cards.

## Production checks before submission

Run the same flows on the live HTTPS URL in an incognito window and on a physical phone. Confirm Blob-backed share links survive a new deployment and review host logs for unhandled errors.
