import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, HeartHandshake } from "lucide-react";

export const metadata: Metadata = {
  title: "A practical guide to giving compliments",
  description: "Simple guidance for giving specific compliments, receiving praise comfortably, and making appreciation feel sincere.",
  alternates: { canonical: "/compliment-guide" },
};

export default function ComplimentGuidePage() {
  const guideSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to give a meaningful compliment",
    description: "A practical three-step method for giving specific, sincere, timely praise.",
    step: [
      { "@type": "HowToStep", name: "Notice a detail", text: "Name something the person actually did." },
      { "@type": "HowToStep", name: "Name the impact", text: "Explain what became easier, kinder, clearer, or better because of it." },
      { "@type": "HowToStep", name: "Deliver it", text: "Use plain, warm words while the moment is fresh." },
    ],
  };

  return (
    <main className="v2-shell min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema) }} />
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
          <Link className="v2-display text-xl font-semibold v2-gradient-text" href="/">HypeForge</Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-3 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--control-hover)]" href="/">
            Open generator
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </header>

        <article className="py-12 sm:py-16">
          <div className="grid size-12 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--coral)]">
            <HeartHandshake aria-hidden="true" className="size-6" />
          </div>
          <p className="v2-mono mt-6 text-xs uppercase text-[var(--purple-soft)]">A practical guide</p>
          <h1 className="v2-display mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--text)] sm:text-5xl">Give praise that lands.</h1>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-[var(--text-muted)]">
            A sincere compliment usually lands better than the giver expects. Notice a real choice, name its impact, and say it while the moment is fresh.
          </p>

          <section className="mt-12 border-y border-[var(--line)] py-8">
            <p className="v2-mono text-xs uppercase text-[var(--purple-soft)]">The 20-second formula</p>
            <ol className="mt-5 grid gap-6 md:grid-cols-3">
              <li className="text-base font-medium leading-7 text-[var(--text-muted)]"><strong className="block text-lg text-[var(--text)]">1. Notice</strong> Name the action, choice, or skill you actually saw.</li>
              <li className="text-base font-medium leading-7 text-[var(--text-muted)]"><strong className="block text-lg text-[var(--text)]">2. Name the impact</strong> Say what became easier, kinder, clearer, or better.</li>
              <li className="text-base font-medium leading-7 text-[var(--text-muted)]"><strong className="block text-lg text-[var(--text)]">3. Deliver it</strong> Keep the words plain and warm. Say them soon.</li>
            </ol>
          </section>

          <section className="py-10">
            <h2 className="v2-display text-2xl font-semibold text-[var(--text)]">Make “great job” mean something</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-[0.75fr_1.25fr]">
              <div className="rounded-[16px] bg-[var(--paper-secondary)] p-5 text-base font-medium leading-7 text-[var(--text-muted)]"><span className="v2-mono block text-xs uppercase">Instead of</span>“Great job on that call.”</div>
              <div className="rounded-[16px] bg-[var(--accent-soft)] p-5 text-base font-medium leading-7 text-[var(--text)]"><span className="v2-mono block text-xs font-bold uppercase text-[var(--text)]">Try</span>“You stayed calm during that client call and gave the team a clear next step. That steadiness mattered.”</div>
            </div>
          </section>

          <div className="grid gap-8 border-t border-[var(--line)] py-10 md:grid-cols-2">
            <section>
              <h2 className="v2-display text-xl font-semibold text-[var(--text)]">Match the setting</h2>
              <p className="mt-4 text-base font-medium leading-7 text-[var(--text-muted)]"><strong className="text-[var(--text)]">Direct:</strong> use “you” and speak to the person.</p>
              <p className="mt-2 text-base font-medium leading-7 text-[var(--text-muted)]"><strong className="text-[var(--text)]">Public:</strong> name their role and share only details they would be comfortable seeing repeated.</p>
            </section>
            <section>
              <h2 className="v2-display text-xl font-semibold text-[var(--text)]">When you receive one</h2>
              <p className="mt-4 text-base font-medium leading-7 text-[var(--text-muted)]">Say thank you without deflecting. Save the words for a hard day, then pass the generosity on when you notice good work.</p>
            </section>
          </div>

          <section className="border-t border-[var(--line)] pt-10">
            <h2 className="v2-display text-2xl font-semibold text-[var(--text)]">Why it is worth saying</h2>
            <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-[var(--text-muted)]">Across several experiments, people underestimated how positive recipients would feel and overestimated how awkward compliments would be. A separate lab study found praise acted as a social reward during motor-skill learning.</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
              <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href="https://pubmed.ncbi.nlm.nih.gov/34636586/" rel="noreferrer" target="_blank">Compliment expectations study <ExternalLink aria-hidden="true" className="size-3.5" /></a>
              <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href="https://pubmed.ncbi.nlm.nih.gov/32856538/" rel="noreferrer" target="_blank">Giving compliments study <ExternalLink aria-hidden="true" className="size-3.5" /></a>
              <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href="https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0048174" rel="noreferrer" target="_blank">Praise and learning study <ExternalLink aria-hidden="true" className="size-3.5" /></a>
            </div>
          </section>

          <Link className="v2-primary-button mt-10 inline-flex min-h-12 items-center gap-2 px-5 text-sm font-semibold" href="/">
            Write one now
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </article>
      </div>
    </main>
  );
}
