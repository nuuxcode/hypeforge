import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Code2,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { AdminActions } from "../admin-actions";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import {
  DIAGNOSTIC_CATALOG,
  getDiagnosticEntry,
  type DiagnosticEntry,
} from "@/lib/diagnostic-catalog";

export const metadata: Metadata = { title: "Diagnostic reference", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function searchText(entry: DiagnosticEntry): string {
  return [
    entry.key,
    entry.title,
    entry.category,
    entry.summary,
    entry.decision,
    entry.validator,
    entry.stage,
    ...entry.likelyCauses,
    ...entry.fixes,
    ...entry.locations.flatMap((location) => [location.label, location.path, location.purpose]),
  ].join(" ").toLocaleLowerCase();
}

export default async function DiagnosticReferencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; issue?: string }>;
}) {
  const cookieStore = await cookies();
  if (!verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin/login");

  const { q = "", issue } = await searchParams;
  const query = q.trim().toLocaleLowerCase();
  const selected = issue ? getDiagnosticEntry(issue) : undefined;
  const knownSelected = selected && DIAGNOSTIC_CATALOG.some((entry) => entry.key === selected.key);
  const filtered = DIAGNOSTIC_CATALOG.filter((entry) => !query || searchText(entry).includes(query));
  const entries = selected
    ? [selected, ...filtered.filter((entry) => entry.key !== selected.key)]
    : filtered;

  return (
    <main className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1220px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#6e5ae6]/10 text-[#6e5ae6]"><Sparkles aria-hidden="true" className="size-4" /></span>
            <div className="min-w-0">
              <p className="truncate font-semibold">HypeForge diagnostics</p>
              <p className="hidden truncate text-xs text-[#6e6e73] min-[430px]:block">Error and validator reference</p>
            </div>
          </div>
          <AdminActions />
        </div>
      </header>

      <div className="mx-auto max-w-[1220px] px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6e6e73] hover:text-[#1d1d1f]" href="/admin?view=issues">
              <ArrowLeft aria-hidden="true" className="size-4" /> Request logs
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-white text-[#6e5ae6] shadow-sm"><BookOpen aria-hidden="true" className="size-5" /></span>
              <div>
                <h1 className="text-3xl font-semibold sm:text-4xl">Diagnostic reference</h1>
                <p className="mt-1 text-sm text-[#6e6e73]">Human meaning first. Internal keys remain searchable for code and logs.</p>
              </div>
            </div>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-[#fafafa]" href="/">
            Generator <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5" aria-label="Search diagnostics">
          <form action="/admin/reference" className="flex flex-col gap-3 sm:flex-row" method="get">
            <label className="relative flex-1">
              <span className="sr-only">Search keys, meanings, validators, or files</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#6e6e73]" />
              <input
                className="h-12 w-full rounded-xl border border-black/15 bg-[#f5f5f7] pl-11 pr-4 text-sm outline-none transition placeholder:text-[#86868b] focus:border-[#6e5ae6] focus:bg-white focus:ring-4 focus:ring-[#6e5ae6]/10"
                defaultValue={q}
                name="q"
                placeholder="Search dramatic, quota, validator, prompt, file..."
                type="search"
              />
            </label>
            <button className="h-12 rounded-xl bg-[#1d1d1f] px-5 text-sm font-semibold text-white transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e5ae6]" type="submit">Search reference</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#6e6e73]">
            <span>{DIAGNOSTIC_CATALOG.length} documented keys</span>
            <span aria-hidden="true">·</span>
            <span>Company rules, quality gates, Gemini failures, requests, and infrastructure</span>
            {query || issue ? <Link className="ml-auto font-semibold text-[#5f4bd4] hover:underline" href="/admin/reference">Clear search</Link> : null}
          </div>
        </section>

        {selected && !knownSelected ? (
          <div className="mt-5 rounded-xl border border-[#a35a00]/20 bg-[#fff7e5] p-4 text-sm leading-6 text-[#6b4200]">
            This key is not documented yet. The fallback below tells you how to locate its emitter; add a permanent catalog entry before treating the diagnosis as complete.
          </div>
        ) : null}

        <section className="mt-6 space-y-4" aria-label="Diagnostic definitions">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-16 text-center">
              <Search aria-hidden="true" className="mx-auto size-6 text-[#6e5ae6]" />
              <h2 className="mt-4 text-lg font-semibold">No matching diagnostic</h2>
              <p className="mt-2 text-sm text-[#6e6e73]">Try a key, plain-language symptom, validator, or file name.</p>
            </div>
          ) : entries.map((entry) => (
            <details
              className="group scroll-mt-20 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm open:border-[#6e5ae6]/30 open:ring-4 open:ring-[#6e5ae6]/[0.06]"
              id={entry.key}
              key={entry.key}
              open={entry.key === selected?.key || entries.length === 1}
            >
              <summary className="flex cursor-pointer list-none items-start gap-4 p-5 transition hover:bg-[#fafafa] sm:p-6">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#6e5ae6]/10 text-[#6e5ae6]">
                  {entry.category === "Company guideline" ? <ShieldCheck aria-hidden="true" className="size-4" /> : entry.category === "Quality gate" ? <Wrench aria-hidden="true" className="size-4" /> : <Code2 aria-hidden="true" className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold sm:text-lg">{entry.title}</span>
                    <span className="rounded-md bg-[#f5f5f7] px-2 py-1 font-mono text-[0.68rem] text-[#6e6e73]">{entry.key}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[#6e6e73]">{entry.summary}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-[#f5f5f7] px-2.5 py-1 text-xs font-semibold text-[#6e6e73]">{entry.category}</span>
              </summary>

              <div className="border-t border-black/10 bg-[#fafafa] p-5 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-[#6e6e73]">What HypeForge does</p>
                    <p className="mt-2 text-sm leading-6">{entry.decision}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-[#6e6e73]">Validator</p>
                    <p className="mt-2 text-sm font-medium leading-6">{entry.validator}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-[#6e6e73]">Pipeline stage</p>
                    <p className="mt-2 text-sm leading-6">{entry.stage}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-5">
                    <h3 className="font-semibold">Why this can happen</h3>
                    <ul className="mt-3 space-y-3 text-sm leading-6 text-[#3a3a3f]">{entry.likelyCauses.map((cause) => <li className="flex gap-2" key={cause}><span className="text-[#a35a00]">•</span><span>{cause}</span></li>)}</ul>
                  </section>
                  <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-5">
                    <h3 className="font-semibold">Investigation and repair checklist</h3>
                    <ol className="mt-3 space-y-3 text-sm leading-6 text-[#3a3a3f]">{entry.fixes.map((fix, index) => <li className="flex gap-3" key={fix}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#6e5ae6]/10 text-xs font-semibold text-[#5f4bd4]">{index + 1}</span><span>{fix}</span></li>)}</ol>
                  </section>
                </div>

                <section className="mt-5 rounded-xl border border-black/10 bg-[#17171a] p-4 text-white sm:p-5">
                  <div className="flex items-center gap-2">
                    <Code2 aria-hidden="true" className="size-4 text-[#9d8cff]" />
                    <h3 className="font-semibold">Code and prompt ownership</h3>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">{entry.locations.map((location) => (
                    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3" key={`${entry.key}-${location.path}-${location.label}`}>
                      <p className="text-xs font-semibold text-white/60">{location.label}</p>
                      <code className="mt-1 block break-all text-sm font-semibold text-[#b7aaff]">{location.path}</code>
                      <p className="mt-2 text-xs leading-5 text-white/65">{location.purpose}</p>
                    </div>
                  ))}</div>
                </section>
              </div>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
