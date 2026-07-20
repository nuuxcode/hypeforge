import Image from "next/image";

// Instant route-level feedback: the App Router shows this the moment an /admin
// navigation starts, while the server gathers the observability records.
export default function AdminLoading() {
  return (
    <main className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6">
          <Image alt="HypeForge" className="h-8 w-auto" height={200} priority src="/brand/hypeforge-logo-light.png" width={620} />
          <div className="size-10 animate-pulse rounded-xl bg-black/10" />
        </div>
      </header>
      <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-6 sm:py-10" role="status" aria-label="Loading diagnostics">
        <div className="h-4 w-24 animate-pulse rounded bg-black/10" />
        <div className="mt-5 h-9 w-72 animate-pulse rounded-lg bg-black/10" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-black/10" />
        <div className="mt-8 h-40 animate-pulse rounded-2xl border border-black/10 bg-white" />
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="bg-white p-5" key={item}>
              <div className="size-5 animate-pulse rounded bg-black/10" />
              <div className="mt-5 h-8 w-16 animate-pulse rounded bg-black/10" />
              <div className="mt-2 h-4 w-28 animate-pulse rounded bg-black/10" />
            </div>
          ))}
        </div>
        <div className="mt-8 h-96 animate-pulse rounded-2xl border border-black/10 bg-white" />
      </div>
    </main>
  );
}
