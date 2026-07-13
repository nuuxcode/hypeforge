import { readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.HYPEFORGE_EVAL_URL ?? "http://localhost:3001";
const requestedLimit = Number(process.env.HYPEFORGE_EVAL_LIMIT ?? 0);
const requestedStart = Math.max(Number(process.env.HYPEFORGE_EVAL_START ?? 0), 0);
const delayMs = Number(process.env.HYPEFORGE_EVAL_DELAY_MS ?? 250);
const outputPath = process.env.HYPEFORGE_EVAL_OUTPUT;
const corpus = JSON.parse(
  await readFile(new URL("../evals/quality-corpus.json", import.meta.url), "utf8"),
);
const cases = requestedLimit > 0
  ? corpus.slice(requestedStart, requestedStart + requestedLimit)
  : corpus.slice(requestedStart);

const PERSONA_BUCKET = {
  "awards-committee": "grand",
  "startup-hype": "grand",
  "theater-critic": "grand",
  "epic-bard": "mythic",
  "ancient-oracle": "mythic",
  "nature-doc": "mythic",
  "hype-friend": "chaotic",
  "sports-commentator": "chaotic",
};

function words(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function jaccard(left, right) {
  const a = words(left);
  const b = words(right);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
}

function opening(text) {
  // Match the product gate: five words are often only the required role
  // prefix ("As a Customer Success Manager..."). Eight reaches the creative
  // framing without making the evaluator punish grounded role wording.
  return String(text).toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 8).join(" ") ?? "";
}

function cardIssues(card, index) {
  const issues = [];
  if (card?.status !== "idle") issues.push(`card ${index + 1} status is ${card?.status ?? "missing"}`);
  if (typeof card?.text !== "string" || !card.text.trim()) issues.push(`card ${index + 1} has no text`);
  if (card?.guidelines?.version !== "2.1") issues.push(`card ${index + 1} has no v2.1 proof`);
  if (card?.guidelines?.wordCount > 40) issues.push(`card ${index + 1} exceeds 40 words`);
  if (!Array.isArray(card?.guidelines?.checks) || card.guidelines.checks.length !== 8) {
    issues.push(`card ${index + 1} does not expose 8 checks`);
  } else if (card.guidelines.checks.some((check) => check?.state !== "pass")) {
    issues.push(`card ${index + 1} contains a failed guideline`);
  }
  return issues;
}

function deckIssues(body) {
  const cards = Array.isArray(body?.cards) ? body.cards : [];
  const issues = [];
  if (body?.ok !== true) issues.push(body?.error ?? "app response was not successful");
  if (cards.length !== 3) issues.push(`expected 3 cards, received ${cards.length}`);
  cards.forEach((card, index) => issues.push(...cardIssues(card, index)));

  if (cards.length === 3) {
    const buckets = new Set(cards.map((card) => PERSONA_BUCKET[card.personaId]));
    if (buckets.size !== 3 || buckets.has(undefined)) issues.push("deck does not contain one Grand, Mythic, and Chaotic voice");
    const openings = cards.map((card) => opening(card.text));
    if (new Set(openings).size !== 3) issues.push("two cards repeat the same eight-word creative opening");
    for (let left = 0; left < cards.length; left += 1) {
      for (let right = left + 1; right < cards.length; right += 1) {
        const overlap = jaccard(cards[left].text, cards[right].text);
        if (overlap >= 0.72) issues.push(`cards ${left + 1} and ${right + 1} have ${overlap.toFixed(2)} lexical overlap`);
      }
    }
  }
  return issues;
}

const results = [];
for (const [index, testCase] of cases.entries()) {
  const started = performance.now();
  let result;
  try {
    const response = await fetch(new URL("/api/generate", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(testCase),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json().catch(() => null);
    const issues = response.ok ? deckIssues(body) : [`HTTP ${response.status}`, ...deckIssues(body)];
    result = {
      case: index + 1,
      ...testCase,
      passed: issues.length === 0,
      durationMs: Math.round(performance.now() - started),
      requestId: body?.debug?.requestId,
      personaIds: Array.isArray(body?.cards) ? body.cards.map((card) => card.personaId) : [],
      issues,
    };
  } catch (error) {
    result = {
      case: index + 1,
      ...testCase,
      passed: false,
      durationMs: Math.round(performance.now() - started),
      personaIds: [],
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
  results.push(result);
  console.log(`${result.passed ? "PASS" : "FAIL"} ${index + 1}/${cases.length} ${testCase.jobFunction} (${result.durationMs}ms)`);
  if (!result.passed) console.log(`  ${result.issues.join(" | ")}`);
  if (delayMs > 0 && index < cases.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

const passed = results.filter((result) => result.passed).length;
const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  corpusSize: cases.length,
  passed,
  failed: cases.length - passed,
  passRate: Number(((passed / Math.max(cases.length, 1)) * 100).toFixed(1)),
  averageDurationMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / Math.max(durations.length, 1)),
  p95DurationMs: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] ?? 0,
};

console.log("\nQUALITY EVALUATION");
console.table(summary);
if (outputPath) {
  await writeFile(outputPath, `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8");
  console.log(`Detailed report written to ${outputPath}`);
}
if (summary.failed > 0) process.exitCode = 1;
