import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowLeft,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Code2,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AdminActions } from "./admin-actions";
import { TabLink } from "./tab-link";
import { AdminModelSettings } from "@/components/admin-model-settings";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import {
  diagnosticReferenceHref,
  getDiagnosticEntry,
  inferDiagnosticKey,
} from "@/lib/diagnostic-catalog";
import {
  listObservabilityRecords,
  type AiAttemptLogRecord,
  type ApiTraceLogRecord,
  type ObservabilityLogRecord,
} from "@/lib/ai-failure-log";

export const metadata: Metadata = { title: "System diagnostics", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type RequestGroup = {
  requestId: string;
  createdAt: string;
  trace?: ApiTraceLogRecord;
  attempts: AiAttemptLogRecord[];
  severity: "success" | "warning" | "error";
};

const OUTCOME_LABELS = {
  accepted: "Passed on first attempt",
  recovered: "Passed after automatic repair",
  "rejected-candidate": "Draft rejected by rules",
  "provider-error": "Gemini/provider error",
} as const;

const SUMMARY_ITEMS: Array<{ label: string; value: "issues" | "providers" | "rejected" | "recovered"; icon: LucideIcon }> = [
  { label: "Requests with issues", value: "issues", icon: AlertTriangle },
  { label: "Provider errors", value: "providers", icon: Bot },
  { label: "Rejected drafts", value: "rejected", icon: ShieldCheck },
  { label: "Automatic recoveries", value: "recovered", icon: Wrench },
];

function groupRecords(records: ObservabilityLogRecord[]): RequestGroup[] {
  const groups = new Map<string, RequestGroup>();
  for (const record of records) {
    const current = groups.get(record.requestId) ?? {
      requestId: record.requestId,
      createdAt: record.createdAt,
      attempts: [],
      severity: "success" as const,
    };
    if (record.createdAt > current.createdAt) current.createdAt = record.createdAt;
    if (record.kind === "api-trace") current.trace = record;
    else current.attempts.push(record);
    groups.set(record.requestId, current);
  }

  return [...groups.values()]
    .map((group) => {
      group.attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const hasHardFailure = group.attempts.some((attempt) => attempt.outcome === "provider-error") || group.trace?.severity === "error";
      const hasWarning = group.attempts.some((attempt) => attempt.outcome === "rejected-candidate") || group.trace?.severity === "warning";
      group.severity = hasHardFailure ? "error" : hasWarning ? "warning" : "success";
      return group;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Casablanca",
  }).format(new Date(value));
}

function requestTitle(group: RequestGroup): string {
  const route = group.trace?.route.replace("POST /api/", "") ?? group.attempts[0]?.operation ?? "AI request";
  return route.charAt(0).toUpperCase() + route.slice(1);
}

function requestSummary(group: RequestGroup): string {
  const providerErrors = group.attempts.filter((attempt) => attempt.outcome === "provider-error").length;
  const rejected = group.attempts.filter((attempt) => attempt.outcome === "rejected-candidate").length;
  const accepted = group.attempts.filter((attempt) => attempt.outcome === "accepted" || attempt.outcome === "recovered").length;
  if (providerErrors > 0) return `${providerErrors} provider error${providerErrors === 1 ? "" : "s"}; ${accepted} accepted output${accepted === 1 ? "" : "s"}.`;
  if (rejected > 0) return `${rejected} rejected draft${rejected === 1 ? "" : "s"}; automatic repair produced ${accepted} accepted output${accepted === 1 ? "" : "s"}.`;
  return `${accepted} model output${accepted === 1 ? "" : "s"} passed the full pipeline.`;
}

function plainAttemptExplanation(attempt: AiAttemptLogRecord): string {
  if (attempt.outcome === "provider-error") {
    const diagnostic = getDiagnosticEntry(inferDiagnosticKey(attempt.error?.message ?? "provider error"));
    return `${diagnostic.summary} ${attempt.error?.message ? `Provider message: ${attempt.error.message}` : "Validation could not run because no usable draft arrived."}`;
  }
  if (attempt.outcome === "rejected-candidate") {
    const diagnostics = attempt.failedRuleIds.map(getDiagnosticEntry);
    if (diagnostics.length === 1) {
      return `Gemini returned a complete draft, but HypeForge did not use it. ${diagnostics[0].summary} ${diagnostics[0].decision}`;
    }
    const titles = diagnostics.length > 0 ? diagnostics.map((entry) => entry.title).join("; ") : "one or more unclassified checks";
    return `Gemini returned a complete draft, but HypeForge did not use it because these checks rejected it: ${titles}. Existing valid content was preserved.`;
  }
  if (attempt.outcome === "recovered") return "A later automatic repair passed all deterministic checks and the independent AI audit.";
  return "The first draft passed all deterministic checks and the independent AI audit.";
}

function diagnosticKeysForAttempt(attempt: AiAttemptLogRecord): string[] {
  if (attempt.failedRuleIds.length > 0) return [...new Set(attempt.failedRuleIds)];
  if (attempt.outcome === "provider-error") return [inferDiagnosticKey(attempt.error?.message ?? "provider error")];
  return [];
}

function StatusIcon({ severity }: { severity: RequestGroup["severity"] }) {
  if (severity === "error") return <CircleAlert aria-hidden="true" className="size-5 text-[#c43d36]" />;
  if (severity === "warning") return <AlertTriangle aria-hidden="true" className="size-5 text-[#a35a00]" />;
  return <CheckCircle2 aria-hidden="true" className="size-5 text-[#2d7a3f]" />;
}

function highlightedOutput(text: string, fragments: string[]): ReactNode {
  const lower = text.toLocaleLowerCase();
  const ranges = fragments
    .map((fragment) => {
      const start = lower.indexOf(fragment.toLocaleLowerCase());
      return start >= 0 ? { start, end: start + fragment.length } : null;
    })
    .filter((range): range is { start: number; end: number } => Boolean(range))
    .sort((a, b) => a.start - b.start);
  if (ranges.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(<mark className="rounded bg-[#ffe09a] px-0.5 text-[#442900]" key={`${range.start}-${range.end}`}>{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string; request?: string }> }) {
  const cookieStore = await cookies();
  if (!verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin/login");

  const { view, request } = await searchParams;
  const activeView = view === "all" ? "all" : "issues";
  let loadError: string | null = null;
  let records: ObservabilityLogRecord[] = [];
  try {
    records = await listObservabilityRecords(400);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }
  const groups = groupRecords(records);
  const visibleGroups = request
    ? groups.filter((group) => group.requestId === request)
    : activeView === "issues"
      ? groups.filter((group) => group.severity !== "success")
      : groups;
  const issueCount = groups.filter((group) => group.severity !== "success").length;
  const tracedRequestIds = new Set(records.filter((record) => record.kind === "api-trace").map((record) => record.requestId));
  const providerErrorCount = records.reduce((count, record) => {
    if (record.kind === "api-trace") {
      return count + record.debug.events.filter((event) => event.scope === "provider" && event.level === "error").length;
    }
    return count + (record.outcome === "provider-error" && !tracedRequestIds.has(record.requestId) ? 1 : 0);
  }, 0);
  const rejectedCount = records.filter((record) => record.kind === "ai-attempt" && record.outcome === "rejected-candidate").length;
  const recoveredCount = records.filter((record) => record.kind === "ai-attempt" && record.outcome === "recovered").length;

  return (
    <main className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image alt="HypeForge" className="h-8 w-auto shrink-0" height={200} priority src="/brand/hypeforge-logo-light.png" width={620} />
            <div className="min-w-0 border-l border-black/10 pl-3">
              <p className="truncate font-semibold">Diagnostics</p>
              <p className="hidden truncate text-xs text-[#6e6e73] min-[430px]:block">Private, redacted operational logs</p>
            </div>
          </div>
          <AdminActions />
        </div>
      </header>

      <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6e6e73] hover:text-[#1d1d1f]" href="/">
              <ArrowLeft aria-hidden="true" className="size-4" /> Generator
            </Link>
            <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">AI pipeline activity</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e6e73]">
              Error-first history of model calls, rule checks, automatic repairs, key rotation, and server decisions. Person input is fingerprinted; API keys and hidden prompts are never stored.
            </p>
          </div>
          <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#6e6e73] shadow-sm">Times shown in Casablanca</p>
        </div>

        <AdminModelSettings />

        <section className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 sm:grid-cols-4" aria-label="Diagnostic summary">
          {SUMMARY_ITEMS.map(({ label, value, icon: Icon }) => {
            const counts = { issues: issueCount, providers: providerErrorCount, rejected: rejectedCount, recovered: recoveredCount };
            return (
            <div className="bg-white p-5" key={label}>
              <Icon aria-hidden="true" className="size-5 text-[#6e5ae6]" />
              <p className="mt-5 text-3xl font-semibold">{counts[value]}</p>
              <p className="mt-1 text-sm font-medium text-[#6e6e73]">{label}</p>
            </div>
            );
          })}
        </section>

        <nav className="mt-8 flex items-center gap-1 rounded-xl bg-[#e8e8ed] p-1" aria-label="Log filters">
          <TabLink active={activeView === "issues"} href="/admin?view=issues">
            Issues ({issueCount})
          </TabLink>
          <TabLink active={activeView === "all"} href="/admin?view=all">
            All requests ({groups.length})
          </TabLink>
          <Link className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#4b4b50] transition hover:bg-white hover:text-[#1d1d1f] hover:shadow-sm" href="/admin/reference">
            <BookOpen aria-hidden="true" className="size-4" /> Error reference
          </Link>
        </nav>

        {request ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6e5ae6]/20 bg-[#6e5ae6]/[0.07] px-4 py-3 text-sm">
            <p><span className="font-semibold">Exact request:</span> <span className="break-all font-mono text-xs">{request}</span></p>
            <Link className="font-semibold text-[#5f4bd4] hover:underline" href="/admin?view=issues">Show all issues</Link>
          </div>
        ) : null}

        {loadError ? (
          <div className="mt-5 rounded-xl border border-[#e45c54]/30 bg-[#e45c54]/10 p-4 text-sm text-[#8f2924]" role="alert">
            <strong>Logs could not be loaded.</strong> {loadError}
          </div>
        ) : null}

        <section className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white" aria-label="Request history">
          {visibleGroups.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Activity aria-hidden="true" className="mx-auto size-7 text-[#6e5ae6]" />
              <h2 className="mt-4 text-lg font-semibold">{request ? "Request not found" : activeView === "issues" ? "No captured issues" : "No captured requests yet"}</h2>
              <p className="mt-2 text-sm text-[#6e6e73]">{request ? "The request may predate persistent logs or fall outside the current retention window." : "Run the generator, then refresh this page."}</p>
            </div>
          ) : visibleGroups.map((group) => (
            <details className="group border-b border-black/10 last:border-b-0" key={group.requestId} open={Boolean(request)}>
              <summary className="flex cursor-pointer list-none items-start gap-4 px-4 py-5 transition hover:bg-[#f5f5f7] sm:px-6">
                <span className="mt-0.5"><StatusIcon severity={group.severity} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{requestTitle(group)}</span>
                    <span className="font-mono text-xs text-[#6e6e73]">{group.requestId}</span>
                  </span>
                  <span className="mt-1 block text-sm text-[#6e6e73]">{requestSummary(group)}</span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block text-sm font-medium">{formatDate(group.createdAt)}</span>
                  <span className="mt-1 block text-xs text-[#6e6e73]">{group.attempts.length} AI attempt{group.attempts.length === 1 ? "" : "s"}</span>
                </span>
                <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#6e6e73] transition group-open:rotate-90" />
              </summary>

              <div className="border-t border-black/10 bg-[#fafafa] px-4 py-5 sm:px-6 sm:py-7">
                <p className="mb-5 text-sm text-[#6e6e73] sm:hidden">{formatDate(group.createdAt)}</p>
                <div className="space-y-4">
                  {group.attempts.map((attempt) => (
                    <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-5" key={attempt.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            {attempt.outcome === "accepted" || attempt.outcome === "recovered" ? <CheckCircle2 aria-hidden="true" className="size-4 text-[#2d7a3f]" /> : <CircleAlert aria-hidden="true" className="size-4 text-[#c43d36]" />}
                            {OUTCOME_LABELS[attempt.outcome] ?? attempt.outcome}
                          </p>
                          <p className="mt-1 text-xs text-[#6e6e73]">{attempt.personaId} · attempt {attempt.attempt}/{attempt.maxAttempts} · {attempt.deliveryMode ?? "unknown mode"}</p>
                        </div>
                        <span className="rounded-lg bg-[#f5f5f7] px-2.5 py-1 font-mono text-xs">{attempt.operation}</span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#3a3a3f]">{plainAttemptExplanation(attempt)}</p>
                      {diagnosticKeysForAttempt(attempt).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">{diagnosticKeysForAttempt(attempt).map((key) => {
                          const diagnostic = getDiagnosticEntry(key);
                          return (
                            <Link
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e45c54]/20 bg-[#e45c54]/10 px-2.5 py-1.5 text-xs font-semibold text-[#8f2924] transition hover:border-[#e45c54]/40 hover:bg-[#e45c54]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e5ae6]"
                              href={diagnosticReferenceHref(key)}
                              key={key}
                              title={`Open the full explanation for ${key}`}
                            >
                              {diagnostic.title} <ArrowUpRight aria-hidden="true" className="size-3.5" />
                            </Link>
                          );
                        })}</div>
                      ) : null}
                      {attempt.failureDetails?.length ? (
                        <div className="mt-4 space-y-2">
                          {attempt.failureDetails.map((failure, failureIndex) => (
                            <div className="rounded-lg border border-[#e45c54]/20 bg-[#e45c54]/[0.06] px-3 py-2.5" key={`${failure.ruleId}-${failureIndex}`}>
                              <p className="text-sm font-semibold text-[#8f2924]">{failure.label}</p>
                              <p className="mt-1 text-sm leading-5 text-[#3a3a3f]">{failure.reason}</p>
                              <p className="mt-1 text-xs font-medium text-[#6e6e73]">
                                {failure.location === "exact-fragment"
                                  ? `Highlighted below: “${failure.fragment}”`
                                  : failure.location === "missing"
                                    ? "Missing from the model output"
                                    : "The complete rewrite failed the comparison against the previous version"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {attempt.candidate?.text && !attempt.failureDetails?.some((failure) => failure.location === "whole-output") ? (
                        <div className="mt-4 border-l-2 border-[#6e5ae6] pl-4">
                          <p className="text-xs font-semibold uppercase text-[#6e6e73]">Complete model draft</p>
                          <p className="mt-2 text-sm leading-6">
                            {highlightedOutput(
                              attempt.candidate.text,
                              (attempt.failureDetails ?? []).flatMap((failure) => failure.location === "exact-fragment" && failure.fragment ? [failure.fragment] : []),
                            )}
                          </p>
                        </div>
                      ) : null}
                      {attempt.baselineText && attempt.failureDetails?.some((failure) => failure.location === "whole-output") ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-black/10 bg-[#f5f5f7] p-3">
                            <p className="text-xs font-semibold uppercase text-[#6e6e73]">Accepted baseline</p>
                            <p className="mt-2 text-sm leading-6 text-[#3a3a3f]">{attempt.baselineText}</p>
                          </div>
                          <div className="rounded-lg border border-[#e45c54]/20 bg-[#e45c54]/[0.04] p-3">
                            <p className="text-xs font-semibold uppercase text-[#8f2924]">Rejected rewrite</p>
                            <p className="mt-2 text-sm leading-6 text-[#3a3a3f]">{attempt.candidate?.text ?? "No draft returned"}</p>
                          </div>
                        </div>
                      ) : null}
                      {diagnosticKeysForAttempt(attempt).map((key) => {
                        const diagnostic = getDiagnosticEntry(key);
                        return (
                          <section className="mt-4 overflow-hidden rounded-xl border border-[#6e5ae6]/20 bg-[#6e5ae6]/[0.045]" key={`diagnosis-${key}`}>
                            <div className="border-b border-[#6e5ae6]/15 px-4 py-3">
                              <p className="text-xs font-semibold uppercase text-[#6e5ae6]">How to understand and repair this</p>
                              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-semibold">{diagnostic.title}</h3>
                                <code className="rounded bg-white px-2 py-1 text-[0.7rem] text-[#6e6e73]">{diagnostic.key}</code>
                              </div>
                            </div>
                            <div className="grid gap-4 p-4 lg:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase text-[#6e6e73]">What it means</p>
                                <p className="mt-1 text-sm leading-6 text-[#3a3a3f]">{diagnostic.summary}</p>
                                <p className="mt-3 text-xs font-semibold uppercase text-[#6e6e73]">System decision</p>
                                <p className="mt-1 text-sm leading-6 text-[#3a3a3f]">{diagnostic.decision}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase text-[#6e6e73]">Validator</p>
                                <p className="mt-1 text-sm font-medium text-[#3a3a3f]">{diagnostic.validator}</p>
                                <p className="mt-3 text-xs font-semibold uppercase text-[#6e6e73]">Pipeline stage</p>
                                <p className="mt-1 text-sm text-[#3a3a3f]">{diagnostic.stage}</p>
                              </div>
                            </div>
                            <details className="border-t border-[#6e5ae6]/15 px-4 py-3">
                              <summary className="cursor-pointer font-semibold">Likely causes, repair steps, and code locations</summary>
                              <div className="mt-4 grid gap-5 lg:grid-cols-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#6e6e73]">Likely causes</p>
                                  <ul className="mt-2 space-y-2 text-sm leading-5 text-[#3a3a3f]">{diagnostic.likelyCauses.map((cause) => <li key={cause}>• {cause}</li>)}</ul>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#6e6e73]">Repair checklist</p>
                                  <ol className="mt-2 space-y-2 text-sm leading-5 text-[#3a3a3f]">{diagnostic.fixes.map((fix, index) => <li key={fix}>{index + 1}. {fix}</li>)}</ol>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#6e6e73]">Open these files</p>
                                  <ul className="mt-2 space-y-2">{diagnostic.locations.map((location) => (
                                    <li className="rounded-lg bg-white p-2.5" key={`${location.path}-${location.label}`}>
                                      <code className="break-all text-xs font-semibold text-[#5f4bd4]">{location.path}</code>
                                      <p className="mt-1 text-xs leading-5 text-[#6e6e73]">{location.purpose}</p>
                                    </li>
                                  ))}</ul>
                                </div>
                              </div>
                              <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#5f4bd4] hover:underline" href={diagnosticReferenceHref(key)}>
                                Open the full reference <ArrowUpRight aria-hidden="true" className="size-4" />
                              </Link>
                            </details>
                          </section>
                        );
                      })}
                      <details className="mt-4 rounded-lg bg-[#f5f5f7] p-3">
                        <summary className="cursor-pointer text-sm font-semibold">Raw technical record (JSON)</summary>
                        <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap break-words font-mono text-[0.72rem] leading-5 text-[#3a3a3f]">{JSON.stringify(attempt, null, 2)}</pre>
                      </details>
                    </section>
                  ))}

                  {group.trace ? (
                    <section className="rounded-xl border border-black/10 bg-[#17171a] p-4 text-white sm:p-5">
                      <div className="flex items-center gap-2">
                        <Code2 aria-hidden="true" className="size-4 text-[#9d8cff]" />
                        <h3 className="text-sm font-semibold">Full server pipeline</h3>
                        <span className="ml-auto text-xs text-white/55">{group.trace.debug.elapsedMs ?? 0}ms</span>
                      </div>
                      <ol className="mt-4 space-y-3">
                        {group.trace.debug.events.map((event, index) => (
                          <li className="grid gap-1 border-l border-white/15 pl-4 sm:grid-cols-[110px_1fr]" key={`${event.timestamp}-${index}`}>
                            <span className={`font-mono text-xs ${event.level === "error" ? "text-[#ff8e87]" : event.level === "warn" ? "text-[#ffd27a]" : "text-white/45"}`}>{event.level} · {event.scope}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{event.message}</p>
                              {event.details !== undefined ? <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-5 text-white/60">{JSON.stringify(event.details, null, 2)}</pre> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : (
                    <p className="rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-[#6e6e73]">This older request was captured before full API timelines were enabled.</p>
                  )}
                </div>
              </div>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
