export type DiagnosticCategory =
  | "Company guideline"
  | "Quality gate"
  | "Provider"
  | "Request"
  | "Infrastructure";

export type DiagnosticLocation = {
  label: string;
  path: string;
  purpose: string;
};

export type DiagnosticEntry = {
  key: string;
  title: string;
  category: DiagnosticCategory;
  summary: string;
  decision: string;
  validator: string;
  stage: string;
  likelyCauses: string[];
  fixes: string[];
  locations: DiagnosticLocation[];
};

const GUIDELINE_PIPELINE = "Draft verification, before a compliment is accepted or shown";

export const DIAGNOSTIC_CATALOG: readonly DiagnosticEntry[] = [
  {
    key: "no-appearance",
    title: "Possible physical-appearance reference",
    category: "Company guideline",
    summary: "The draft may describe the person's body, face, clothing, voice, or another physical trait. Company compliments may only praise work and impact.",
    decision: "Reject the draft and request a fresh version without appearance language.",
    validator: "TypeScript phrase scan plus an independent Gemini semantic audit",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["An innocent word such as smile or voice was interpreted as appearance.", "The model praised the person rather than their work.", "The semantic judge was conservative or produced a false positive."],
    fixes: ["Read the failure evidence and identify the exact phrase or semantic note.", "Add a regression example when a safe workplace phrase is rejected.", "Tighten the generation prompt to praise actions, decisions, and impact only."],
    locations: [
      { label: "Rule and deterministic scan", path: "lib/compliment-guidelines.ts", purpose: "Appearance vocabulary and final rule merge" },
      { label: "AI semantic judge", path: "lib/ai.ts", purpose: "Independent appearance audit prompt" },
      { label: "Regression tests", path: "tests/lib/compliment-guidelines.test.ts", purpose: "Safe and unsafe appearance examples" },
    ],
  },
  {
    key: "job-function",
    title: "Job or workplace function was not grounded",
    category: "Company guideline",
    summary: "The compliment did not clearly repeat the person's supplied job title or describe the workplace function they perform.",
    decision: "Reject the draft because every compliment must be tied to specific work.",
    validator: "Deterministic TypeScript evidence and subject-token matching",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["The model used a vague label such as leader instead of the supplied role.", "The evidence quote was not copied exactly from the draft.", "The input did not contain a recognizable workplace function."],
    fixes: ["Compare evidence.functionReference with the draft and original subject.", "Repeat the supplied title verbatim in the repair prompt.", "Expand function recognition only when a valid role is repeatedly missed."],
    locations: [
      { label: "Function validator", path: "lib/compliment-guidelines.ts", purpose: "Function cues, evidence, and grounding logic" },
      { label: "Repair prompt", path: "lib/compliant-generation.ts", purpose: "Targeted instruction for missing function evidence" },
      { label: "Input validation", path: "lib/validate.ts", purpose: "Rejects requests without usable work context" },
    ],
  },
  {
    key: "absurd-metaphor",
    title: "Metaphor was missing or not absurd enough",
    category: "Company guideline",
    summary: "The draft needs a clearly exaggerated, wildly absurd comparison connected to the person's work. Ordinary praise or a mild comparison does not pass.",
    decision: "Reject the draft and ask Gemini for a stronger, work-grounded metaphor.",
    validator: "Exact evidence verification plus an independent Gemini semantic audit",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["The evidence quote is not present verbatim in the draft.", "The comparison is poetic but not wildly absurd.", "The metaphor is absurd but unrelated to the person's job."],
    fixes: ["Inspect evidence.absurdMetaphor and the AI audit note.", "Make the repair prompt demand one concrete impossible comparison.", "Add accepted and rejected metaphor examples to tests or the prompt."],
    locations: [
      { label: "Evidence validator", path: "lib/compliment-guidelines.ts", purpose: "Metaphor evidence and semantic result merge" },
      { label: "AI semantic judge", path: "lib/ai.ts", purpose: "Absurdity and work-connection decision" },
      { label: "Generation prompts", path: "lib/prompts.ts", purpose: "Initial and escalation metaphor instructions" },
    ],
  },
  {
    key: "made-up-statistic",
    title: "Made-up statistic was missing or unreadable",
    category: "Company guideline",
    summary: "The compliment must include an obviously fictional statistic written with a numeral. The validator could not find a supported numeric phrase in the draft and evidence.",
    decision: "Reject the draft and request an explicit fictional number.",
    validator: "Deterministic TypeScript pattern matching, exact evidence verification, and an independent Gemini fictionality audit",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["The statistic was written only in words.", "The number did not match a supported statistic form.", "evidence.madeUpStatistic did not quote the draft exactly."],
    fixes: ["Use an explicit form such as 97 percent of lunar spreadsheets.", "Compare the evidence field with the complete model draft.", "Add a narrowly scoped pattern and regression test for a valid new format."],
    locations: [
      { label: "Statistic parser", path: "lib/compliment-guidelines.ts", purpose: "Supported numeric forms and exact evidence" },
      { label: "AI semantic judge", path: "lib/ai.ts", purpose: "Rejects plausible real metrics that are not clearly invented" },
      { label: "Targeted repair", path: "lib/compliant-generation.ts", purpose: "Explicit statistic repair instruction" },
      { label: "Regression tests", path: "tests/lib/compliment-guidelines.test.ts", purpose: "Accepted and rejected statistic formats" },
    ],
  },
  {
    key: "max-40-words",
    title: "Compliment exceeded 40 words",
    category: "Company guideline",
    summary: "The complete compliment contains more than the Brand Team maximum of 40 whitespace-separated words.",
    decision: "Reject the draft; over-length copy is never shown as valid.",
    validator: "Deterministic TypeScript word counter",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["The model added another sentence during repair.", "Escalation increased length instead of intensity.", "Punctuation or hyphenation created a count the model did not anticipate."],
    fixes: ["Inspect the recorded word count and shorten to the 34-38 word target.", "Preserve the hard 40-word instruction in every prompt and repair.", "Add a boundary test when tokenization is disputed."],
    locations: [
      { label: "Word counter", path: "lib/compliment-guidelines.ts", purpose: "Canonical count and maximum rule" },
      { label: "Prompt limits", path: "lib/prompts.ts", purpose: "34-38 target and 40-word ceiling" },
      { label: "Boundary tests", path: "tests/lib/compliment-guidelines.test.ts", purpose: "Word-count behavior" },
    ],
  },
  {
    key: "no-literally",
    title: "Banned word was present",
    category: "Company guideline",
    summary: "The draft contains the banned word literally. Capitalization does not matter.",
    decision: "Reject the draft and remove the word.",
    validator: "Deterministic case-insensitive TypeScript scan",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["The model repeated the banned word despite the prompt.", "A tweak note encouraged the word and the model followed it."],
    fixes: ["Use the highlighted fragment to confirm the match.", "Keep the Brand Team rules higher priority than tweak notes.", "Add a regression test for the prompt path that produced it."],
    locations: [
      { label: "Banned-word check", path: "lib/compliment-guidelines.ts", purpose: "Exact literally scan" },
      { label: "Company prompt block", path: "lib/compliment-guidelines.ts", purpose: "Rules sent to Gemini" },
    ],
  },
  {
    key: "no-public-figure",
    title: "Possible real public-figure comparison",
    category: "Company guideline",
    summary: "The draft may compare the recipient to a celebrity, politician, athlete, artist, or another real public figure.",
    decision: "Reject the draft so a real person is never used as the comparison.",
    validator: "TypeScript phrase scan plus an independent Gemini semantic audit",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["A real name or indirect celebrity comparison appeared in the draft.", "A capitalized job title was mistaken for a name.", "The semantic judge returned a conservative false positive."],
    fixes: ["Inspect the exact fragment and semantic note.", "Replace the comparison with a fictional object, force, institution, or event.", "Add a regression example before relaxing the validator."],
    locations: [
      { label: "Public-figure scan", path: "lib/compliment-guidelines.ts", purpose: "Explicit comparison phrases" },
      { label: "AI semantic judge", path: "lib/ai.ts", purpose: "Direct and indirect real-person comparison audit" },
    ],
  },
  {
    key: "workplace-appropriate",
    title: "Wording may not be workplace appropriate",
    category: "Company guideline",
    summary: "The draft may be sexual, profane, discriminatory, humiliating, threatening, graphic, or otherwise unsuitable for a workplace message.",
    decision: "Reject the draft and preserve the last valid version.",
    validator: "TypeScript safety scan plus an independent Gemini semantic audit",
    stage: GUIDELINE_PIPELINE,
    likelyCauses: ["A blocked phrase appeared directly.", "The AI judge found unsafe meaning that a keyword scan cannot detect.", "Playful exaggeration crossed into humiliation or threat."],
    fixes: ["Read the highlighted phrase or semantic audit note.", "Rewrite toward warm, generous, non-personal workplace praise.", "Add a regression test for any safe phrase that was incorrectly rejected."],
    locations: [
      { label: "Safety scan", path: "lib/compliment-guidelines.ts", purpose: "Explicit unsafe-language patterns" },
      { label: "AI safety judge", path: "lib/ai.ts", purpose: "Semantic workplace-safety audit" },
    ],
  },
  {
    key: "dramatic-escalation",
    title: "Rewrite was not clearly more dramatic",
    category: "Quality gate",
    summary: "The rewrite may follow all eight company rules, but the comparison judge decided it only changed wording or imagery instead of clearly raising the scale, stakes, ceremony, impossible consequences, or emotional intensity.",
    decision: "Keep the accepted compliment unchanged and reject the weaker rewrite. Up to three automatic repair attempts may run first.",
    validator: "Independent Gemini semantic comparison at temperature 0",
    stage: "Escalation-only quality gate, after the eight Brand Team rules",
    likelyCauses: ["The existing compliment was already extremely dramatic.", "The rewrite reused the same metaphor domain or changed only the statistic.", "The rewrite added adjectives without raising stakes or consequences.", "The comparison judge may be too conservative or may have made a false negative."],
    fixes: ["Compare the accepted baseline, rejected rewrite, and exact semantic note in the request report.", "Improve the escalation prompt to force changes in at least two drama dimensions.", "Improve the repair instruction to switch metaphor domains and surpass the baseline.", "Tune the semantic comparison prompt only after adding the rejected pair as a regression test."],
    locations: [
      { label: "Escalation prompt", path: "lib/prompts.ts", purpose: "Defines how the next drama level must differ" },
      { label: "Automatic repair prompt", path: "lib/compliant-generation.ts", purpose: "Responds to a failed escalation comparison" },
      { label: "AI comparison judge", path: "lib/ai.ts", purpose: "Sets meaningfullyMoreDramatic" },
      { label: "Pipeline decision", path: "lib/compliant-generation.ts", purpose: "Rejects the rewrite and preserves the baseline" },
      { label: "Regression tests", path: "tests/lib/compliant-generation.test.ts", purpose: "Escalation comparison and repair behavior" },
    ],
  },
  {
    key: "delivery-mode",
    title: "Wording does not match how it will be shared",
    category: "Quality gate",
    summary: "A direct message must address the recipient as you or your, while a public post must describe them without speaking to them directly.",
    decision: "Reject the mismatched draft and request the correct point of view.",
    validator: "Deterministic TypeScript pronoun check",
    stage: "Delivery-context gate, after guideline verification",
    likelyCauses: ["Gemini switched between second and third person.", "A tweak note changed the point of view.", "The chosen share mode was not preserved in a repair."],
    fixes: ["Confirm the selected Direct or Public mode in the request record.", "Inspect pronouns in the rejected draft.", "Keep delivery context explicit in generation, escalation, and tweak prompts."],
    locations: [
      { label: "Delivery validator", path: "lib/compliant-generation.ts", purpose: "Direct/public pronoun gate" },
      { label: "Delivery prompts", path: "lib/prompts.ts", purpose: "Point-of-view instructions" },
    ],
  },
  {
    key: "complete-deck",
    title: "All three required cards were not completed",
    category: "Quality gate",
    summary: "The request requires exactly three valid compliments. At least one persona slot still failed after its normal rule-repair loop and one bounded same-bucket recovery.",
    decision: "Reject the deck as one atomic result. Never label a one-card or two-card response as successful and never save it to user history.",
    validator: "Deterministic TypeScript response contract",
    stage: "Deck orchestration, after parallel persona generation",
    likelyCauses: ["A persona exhausted its company-rule repair attempts.", "Gemini failed for both the selected persona and its fallback.", "A provider or structured-output error persisted through recovery."],
    fixes: ["Inspect failedPersonaIds and the provider timeline for the request.", "Use the rejected candidate and failed-rule evidence to add a prompt regression.", "Change retry limits only after measuring failure frequency and cost."],
    locations: [
      { label: "Atomic deck orchestrator", path: "lib/deck-generation.ts", purpose: "Persona-slot recovery and exact three-card contract" },
      { label: "HTTP boundary", path: "app/api/generate/route.ts", purpose: "Returns app-level failure without partial cards" },
      { label: "Production smoke test", path: "scripts/verify-api-no-http-errors.mjs", purpose: "Requires three valid cards" },
    ],
  },
  {
    key: "deck-semantic-diversity",
    title: "Compliment deck was not semantically varied",
    category: "Quality gate",
    summary: "The three cards may use different words while repeating the same central imagery, persona voice, opening style, or joke mechanism.",
    decision: "Rewrite the smallest offending subset, re-audit the full deck, and reject the deck if bounded repairs still do not produce three genuinely distinct voices.",
    validator: "Lexical TypeScript checks plus one consolidated temperature-0 Gemini deck audit",
    stage: "Cross-card quality gate, after all three cards pass Company Guidelines v2.1",
    likelyCauses: ["Several personas drifted into the same cosmic or ceremonial imagery.", "The outputs changed nouns but kept the same joke structure.", "A persona ignored its assigned rhetorical lane.", "The semantic judge may be conservative."],
    fixes: ["Compare the issue category, named persona IDs, and reason in the deck-audit event.", "Improve only the offending persona lane or repair instruction.", "Add the rejected three-card set to the quality-evaluation corpus before tuning the judge."],
    locations: [
      { label: "Persona lanes", path: "lib/personas.ts", purpose: "Exclusive imagery and rhetorical domains" },
      { label: "Deck audit prompt", path: "lib/ai.ts", purpose: "Cross-card semantic evaluation" },
      { label: "Deck repair loop", path: "lib/deck-generation.ts", purpose: "Minimal targeted regeneration and bounded re-audit" },
      { label: "Lexical checks", path: "lib/deck-distinctness.ts", purpose: "Duplicate wording, opening, metaphor, and statistic checks" },
    ],
  },
  {
    key: "structured-output",
    title: "Gemini response did not match the required structure",
    category: "Provider",
    summary: "Gemini answered, but the response could not be parsed as the required compliment, evidence fields, rule IDs, and self-checks.",
    decision: "Do not validate or show partial output; retry with a schema-repair instruction.",
    validator: "Zod schema validation of Gemini structured output",
    stage: "Provider response parsing, before guideline checks",
    likelyCauses: ["The model returned no object, truncated JSON, or missing fields.", "The provider SDK returned no structured output.", "The schema and prompt drifted out of sync."],
    fixes: ["Inspect the complete provider error and raw response in the technical record.", "Check schema names and output-token limits.", "Add the failing response shape as a regression test."],
    locations: [
      { label: "Output schema", path: "lib/compliment-guidelines.ts", purpose: "Required structured response fields" },
      { label: "Provider call", path: "lib/ai.ts", purpose: "Gemini structured output configuration" },
      { label: "Schema repair", path: "lib/compliant-generation.ts", purpose: "Automatic malformed-output retry" },
    ],
  },
  {
    key: "provider-error",
    title: "Gemini provider call failed",
    category: "Provider",
    summary: "The model call failed before HypeForge received a usable draft. The nested provider message identifies whether this was quota, credentials, timeout, malformed output, or another Gemini failure.",
    decision: "Rotate keys or models when allowed, retry automatically, and fail without changing valid content if all attempts fail.",
    validator: "Gemini SDK and HypeForge provider error classifier",
    stage: "Model generation or semantic audit",
    likelyCauses: ["Quota or rate limit.", "Invalid or disabled API key.", "Provider timeout or transient outage.", "Malformed structured response."],
    fixes: ["Expand the nested provider error and identify its status code and message.", "Review key-rotation events in the same request timeline.", "Check model IDs, credentials, quota, and timeout configuration."],
    locations: [
      { label: "Gemini calls", path: "lib/ai.ts", purpose: "Generation and semantic audit requests" },
      { label: "Key rotation", path: "lib/gemini-key-pool.ts", purpose: "Failure classification and rotation policy" },
      { label: "Pipeline recovery", path: "lib/compliant-generation.ts", purpose: "Automatic attempts and logging" },
    ],
  },
  {
    key: "quota",
    title: "Gemini quota was exhausted",
    category: "Provider",
    summary: "The active Gemini key or project reached a provider quota or rate limit, commonly reported as HTTP 429 or RESOURCE_EXHAUSTED.",
    decision: "Rotate immediately to the next configured key; fail only when no usable key remains.",
    validator: "Provider status/message classifier",
    stage: "Gemini key pool",
    likelyCauses: ["Per-minute or daily quota reached.", "Several keys belong to the same exhausted project.", "Billing or model-specific limits changed."],
    fixes: ["Inspect key-slot rotation events; secret key values are intentionally redacted.", "Check Gemini project quota and billing.", "Wait for reset or add a key from a project with available quota."],
    locations: [{ label: "Quota classifier", path: "lib/gemini-key-pool.ts", purpose: "429 detection and immediate rotation" }],
  },
  {
    key: "credentials",
    title: "Gemini rejected the API credentials",
    category: "Infrastructure",
    summary: "A configured Gemini key was missing, invalid, disabled, restricted, or unauthorized for the selected model.",
    decision: "Disable that key slot for the current process, rotate to another key, and never expose the secret in logs.",
    validator: "Provider status/message classifier",
    stage: "Gemini key pool",
    likelyCauses: ["Key was revoked or copied incorrectly.", "API restrictions block the model or deployment.", "The environment variable is missing in the running deployment."],
    fixes: ["Verify the named environment variables exist in the deployment.", "Test the key in its Google project without printing it.", "Review API restrictions and model access."],
    locations: [{ label: "Credential classifier", path: "lib/gemini-key-pool.ts", purpose: "Authentication failure rotation" }],
  },
  {
    key: "timeout",
    title: "Model request exceeded its time limit",
    category: "Provider",
    summary: "Gemini or the network did not finish before HypeForge's configured timeout expired.",
    decision: "Abort the slow call and preserve existing valid content.",
    validator: "AbortSignal timeout and provider error classifier",
    stage: "Gemini request",
    likelyCauses: ["Transient provider latency.", "Slow network path.", "The model spent too long producing structured output."],
    fixes: ["Retry and compare timing across attempts and model IDs.", "Check provider status and deployment region.", "Adjust the timeout only with latency evidence."],
    locations: [
      { label: "Model timeout", path: "lib/ai.ts", purpose: "Provider request deadline" },
      { label: "Browser timeout", path: "lib/client-fetch.ts", purpose: "Client-side request deadline" },
    ],
  },
  {
    key: "rate-limit",
    title: "HypeForge request limit was reached",
    category: "Request",
    summary: "The app blocked a burst of requests before calling Gemini. This protects quota and prevents accidental repeated clicks.",
    decision: "Return a temporary retry response with a reset time.",
    validator: "Server-side request rate limiter",
    stage: "API route, before model generation",
    likelyCauses: ["Several actions were triggered in a short window.", "The browser retried or the user double-clicked.", "Rate-limit storage/configuration is incorrect."],
    fixes: ["Wait until the recorded reset time.", "Check duplicate UI requests in Network tools.", "Inspect rate-limit configuration and route logs if normal use is blocked."],
    locations: [{ label: "Rate limiter", path: "lib/api-rate-limit.ts", purpose: "Limits, reset time, and storage" }],
  },
  {
    key: "configuration",
    title: "Required server configuration is missing",
    category: "Infrastructure",
    summary: "The running server does not have a required environment value or backing service configuration.",
    decision: "Stop before making an unsafe or untraceable request and return a configuration error.",
    validator: "Server startup and route configuration checks",
    stage: "API initialization",
    likelyCauses: ["Environment variables were not copied to the deployment.", "A value exists locally but not on Vercel.", "A storage or rate-limit integration is unavailable."],
    fixes: ["Compare local and deployment environment-variable names without exposing values.", "Restart or redeploy after changing environment configuration.", "Read the original nested error in the request timeline."],
    locations: [
      { label: "Gemini configuration", path: "lib/gemini-key-pool.ts", purpose: "Key environment variables" },
      { label: "API routes", path: "app/api", purpose: "Configuration failure boundaries" },
    ],
  },
  {
    key: "network",
    title: "Browser could not reach HypeForge",
    category: "Request",
    summary: "The browser request ended before an API response arrived, so there may be no server request ID or persistent report.",
    decision: "Leave current content unchanged and show a retryable client error.",
    validator: "Browser fetch and client timeout handling",
    stage: "Browser-to-server connection",
    likelyCauses: ["Local server is stopped.", "Connection was interrupted.", "Browser or proxy aborted the request."],
    fixes: ["Confirm the server URL responds.", "Check the browser Network panel for a cancelled or failed request.", "Review local server output when no request ID exists."],
    locations: [{ label: "Client fetch", path: "lib/client-fetch.ts", purpose: "Browser timeout and abort handling" }],
  },
] as const;

const CATALOG_BY_KEY = new Map(DIAGNOSTIC_CATALOG.map((entry) => [entry.key, entry]));

export function getDiagnosticEntry(key: string): DiagnosticEntry {
  return CATALOG_BY_KEY.get(key) ?? {
    key,
    title: "Uncatalogued diagnostic key",
    category: "Infrastructure",
    summary: `HypeForge recorded the internal key ${key}, but this build does not yet contain a human explanation for it.`,
    decision: "Inspect the request's raw technical record before changing behavior.",
    validator: "Unknown; use the request timeline to identify the emitting module",
    stage: "Unknown pipeline stage",
    likelyCauses: ["A new validator or provider error was added without a matching catalog entry."],
    fixes: ["Search the repository for this exact key.", "Add a catalog entry and a regression test before treating it as understood."],
    locations: [{ label: "Repository search", path: key, purpose: "Search for the exact emitted key" }],
  };
}

export function diagnosticReferenceHref(key: string): string {
  return `/admin/reference?issue=${encodeURIComponent(key)}#${encodeURIComponent(key)}`;
}

export function inferDiagnosticKey(message: string): string {
  if (/complete all three|incomplete deck|three required cards/i.test(message)) return "complete-deck";
  if (/deck.*(?:semantic|distinct|varied)|three voices/i.test(message)) return "deck-semantic-diversity";
  if (/429|quota|resource_exhausted|rate.?limit/i.test(message)) return "quota";
  if (/401|403|api.?key|credential|unauthori[sz]ed|permission denied/i.test(message)) return "credentials";
  if (/timeout|timed out|aborted|aborterror/i.test(message)) return "timeout";
  if (/structured|schema|no structured|parse|truncat/i.test(message)) return "structured-output";
  if (/configuration|missing env|environment variable/i.test(message)) return "configuration";
  if (/fetch|network|connection refused|failed to reach/i.test(message)) return "network";
  return "provider-error";
}
