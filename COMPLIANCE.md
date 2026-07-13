# Assignment Compliance Map

Every requirement from the Step 3 brief, mapped to where it lives in this repo and how to see it working on the live site. Live URL: https://hypeforge-liard.vercel.app

## Core requirements

| Requirement | Where it lives | See it live |
|---|---|---|
| Three compliments at once | Three persona pipelines start concurrently. A failed slot gets one same-bucket fallback, and the server returns success only when all three cards are present and compliant (`lib/deck-generation.ts`, `app/api/generate/route.ts`) | Enter a job title and press Generate: either a complete three-card deck appears or one clear deck-level retry is shown; partial decks are never presented as success |
| Genuinely different, not rewordings | One persona is forced from each voice bucket, each persona owns an explicit imagery lane, deterministic checks reject duplicate wording/openings/metaphors/statistics, and one consolidated temperature-zero deck audit judges persona fit, imagery, and humor across all three cards (`lib/personas.ts`, `lib/deck-distinctness.ts`, `lib/ai.ts`). If only that optional judge is unavailable, the deterministic gate and explicit lanes preserve the complete-deck contract. | The persona and bucket labels name each voice; the accepted cards use visibly different comic worlds, not cosmetic rewrites |
| Make It More Dramatic | Per-card escalate button; each card owns its own version history | Click "Make it more dramatic" on one card; the other two never change |
| Conversation history passed back to the API correctly | The card's versions are replayed to the model as a literal multi-turn conversation: original request as a user turn, each prior compliment as an assistant turn, newest instruction last (`lib/prompts.ts:buildEscalationMessages`); compounding is unit-tested (`tests/api/escalate.test.ts`) | Open devtools, escalate twice: the request payload carries the full version lineage |
| Escalation meaningfully more dramatic | The escalation prompt names the drama levers and forces a metaphor-category change at level 3+; an independent temperature-0 validator model rejects revisions that are not clearly more dramatic (`lib/ai.ts:evaluateGuidelineSemantics`) | Escalate a card: each level reads bigger, not reworded; the ladder caps at level 6 with a celebration |
| Copy to clipboard with clear confirmation | Clipboard API with a fallback path (`lib/clipboard.ts`); button flips to "Copied!" for 1.8s and announces to screen readers | Press Copy on any card |
| Intentional loading state | Bucket-tinted skeleton cards plus rotating status lines, layout-stable (`components/loading-deck-preview.tsx`) | Generate and watch the loading theater |
| Graceful errors, never freeze or blank | Per-card errors with their own Retry, human-worded and status-specific messages, dual timeouts (client 35s, server 25s per model call), HMAC-cookie rate limit (`lib/api-responses.ts`, `lib/rateLimit.ts`) | Generate repeatedly to trip the rate limit: a friendly message appears, the app keeps working |

## Technical requirements

| Requirement | Where |
|---|---|
| AI provider/model | Gemini via `@ai-sdk/google`; main + backup + validator model ids configured by env (`lib/ai.ts`, `.env.example`), reasoning for the choice in `README.md` |
| Live hosted URL | https://hypeforge-liard.vercel.app (README line 1) |
| Clean readable repo, no dead code | Route handlers stay thin; complete-deck orchestration lives in `lib/deck-generation.ts`, reusable AI/rule logic lives in `lib/`, and tests live in `tests/`; comments explain decisions rather than restating code |
| No hardcoded API key | Server-side env only (`lib/ai.ts`), blank `.env.example`, `.env*` gitignored, gitleaks config in repo |

## Optional addition: Compliment Style Guidelines v2.1

| Requirement | Where it lives |
|---|---|
| All 8 rules enforced, every time | Three layers: rules in the system prompt (`lib/compliment-guidelines.ts:guidelinePromptBlock`), deterministic server checks (word count, banned word, evidence quotes, statistic pattern, safety patterns), and an independent AI audit for the subjective rules; outputs that fail any check never reach the UI (`lib/compliant-generation.ts`) |
| Display which rules each compliment satisfied | Per-card proof panel with per-rule pass state, the exact evidence quote, and a source badge saying HOW each rule was checked (`components/guideline-proof.tsx`); the badge headline honestly splits code-verified from AI-audited checks, with a settings toggle for the wording |
| Escalation still follows every rule | Escalate and tweak run the full three-layer verification again before returning (`lib/compliant-generation.ts`); the 40-word cap is re-checked deterministically at every level |

## Rule-by-rule enforcement

| # | Rule | Enforcement |
|---|---|---|
| 1 | Never reference physical appearance | Prompt + conservative pattern guard + independent AI audit |
| 2 | Reference the job title or function | Model must quote its own job reference; server verifies the quote appears in the text and is grounded in the subject |
| 3 | At least one wildly absurd metaphor | Model quotes its metaphor; server verifies the quote; AI audit judges absurdity |
| 4 | One made-up statistic | Model quotes the statistic; code verifies the exact numeric evidence and an independent semantic audit rejects statistics that read like plausible workplace KPIs rather than playful inventions |
| 5 | Maximum 40 words | Deterministic word count on the server, re-run after every escalation and tweak |
| 6 | "literally" banned | Deterministic case-insensitive check |
| 7 | No celebrity or public-figure comparison | Prompt + capitalized-name guard + independent AI audit |
| 8 | Workplace appropriate | Prompt + profanity/unsafe pattern guard + independent AI audit |
