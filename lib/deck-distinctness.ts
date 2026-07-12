import type { GuidelineCompliance } from "./types";

export type DistinctCompliment = {
  text: string;
  guidelines?: GuidelineCompliance;
};

const COMMON_WORDS = new Set([
  "about", "after", "again", "because", "every", "from", "into", "person", "that", "their", "them",
  "they", "this", "those", "through", "with", "without", "work", "your", "youre",
]);

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function contentTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 4 && !COMMON_WORDS.has(token)),
  );
}

function jaccard(left: string, right: string): number {
  const a = contentTokens(left);
  const b = contentTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function evidence(card: DistinctCompliment, id: string): string {
  return card.guidelines?.checks.find((check) => check.id === id)?.evidence ?? "";
}

export function distinctnessIssues(candidate: DistinctCompliment, accepted: DistinctCompliment[]): string[] {
  const issues = new Set<string>();
  const candidateText = normalize(candidate.text);
  const candidateOpening = candidateText.split(" ").slice(0, 5).join(" ");
  const candidateMetaphor = evidence(candidate, "absurd-metaphor");
  const candidateStatistic = normalize(evidence(candidate, "made-up-statistic"));

  for (const prior of accepted) {
    const priorText = normalize(prior.text);
    if (candidateText === priorText) issues.add("exact duplicate text");
    if (jaccard(candidate.text, prior.text) >= 0.72) issues.add("near-duplicate wording");
    if (candidateOpening && candidateOpening === priorText.split(" ").slice(0, 5).join(" ")) {
      issues.add("repeated opening");
    }
    const priorMetaphor = evidence(prior, "absurd-metaphor");
    if (candidateMetaphor && priorMetaphor && jaccard(candidateMetaphor, priorMetaphor) >= 0.65) {
      issues.add("repeated metaphor");
    }
    if (candidateStatistic && candidateStatistic === normalize(evidence(prior, "made-up-statistic"))) {
      issues.add("repeated statistic");
    }
  }

  return [...issues];
}

export function isDistinctCompliment(candidate: DistinctCompliment, accepted: DistinctCompliment[]): boolean {
  return distinctnessIssues(candidate, accepted).length === 0;
}
