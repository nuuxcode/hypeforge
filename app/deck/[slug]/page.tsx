import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { GuidelineProof } from "@/components/guideline-proof";
import { getSharedDeck } from "@/lib/shared-decks";

const accents = ["#7050c8", "#168a87", "#cc5046"];

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const deck = await getSharedDeck(slug);
  if (!deck) return { title: "Shared deck not found", robots: { index: false, follow: false } };

  const title = `A compliment deck for ${deck.input}`;
  const description = deck.deliveryMode === "direct"
    ? `Three distinct HypeForge compliments written directly for ${deck.input}.`
    : `Three distinct HypeForge compliments celebrating ${deck.input} in public.`;
  return {
    title,
    description,
    alternates: { canonical: `/deck/${deck.slug}` },
    robots: { index: false, follow: false },
    openGraph: { type: "article", title, description, url: `/deck/${deck.slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedDeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await getSharedDeck(slug);
  if (!deck) notFound();

  return (
    <main className="v2-shell min-h-dvh px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
          <Link className="inline-flex items-center gap-2 v2-display text-xl font-semibold v2-gradient-text" href="/">
            <Sparkles aria-hidden="true" className="size-5 text-[var(--coral)]" />
            HypeForge
          </Link>
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-[var(--ink)] px-4 text-sm font-bold text-[var(--paper)] transition hover:-translate-y-0.5" href={`/?share=${deck.slug}`}>
            Save this deck to my workspace
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </header>

        <article className="py-12 sm:py-16">
          <p className="v2-mono text-xs uppercase text-[var(--purple-soft)]">
            {deck.deliveryMode === "direct" ? "A message for you" : "A public shout-out"}
          </p>
          <h1 className="v2-display mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[var(--text)] sm:text-5xl">
            {deck.deliveryMode === "direct"
              ? `Three compliments written for ${deck.input}.`
              : `A little evidence that ${deck.input} is a living legend.`}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-[var(--text-muted)]">
            {deck.deliveryMode === "direct"
              ? "Three distinct voices speaking directly to the person being celebrated."
              : "Three distinct voices inviting everyone to celebrate the impact they make."}
          </p>

          <div className="mt-10 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {deck.cards.map((card, index) => (
              <article className="v2-card h-full p-6" key={`${card.personaId}-${card.personaName}`} style={{ "--bucket-accent": accents[index % accents.length], "--heat": 0 } as CSSProperties}>
                <p className="v2-mono text-xs uppercase text-[var(--ink-muted)]">{card.personaName}</p>
                <p className="v2-mono mt-2 text-xs uppercase" style={{ color: accents[index % accents.length] }}>Drama {String(card.dramaLevel).padStart(2, "0")}</p>
                <p className="v2-display mt-7 text-lg font-semibold leading-7 text-[var(--ink)]">{card.text}</p>
                <GuidelineProof className="mt-5" guidelines={card.guidelines} />
              </article>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
