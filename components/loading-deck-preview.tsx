import type { CSSProperties } from "react";
import type { PersonaBucket } from "@/lib/types";

const BUCKET_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

export function LoadingDeckPreview() {
  const buckets: PersonaBucket[] = ["grand", "mythic", "chaotic"];
  return (
    <div className="v2-forge-preview" aria-label="Forging three compliment voices" role="status">
      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {buckets.map((bucket, index) => (
          <div
            className="v2-card v2-forge-card min-h-[260px] p-5"
            key={bucket}
            style={
              {
                "--bucket-accent": BUCKET_ACCENT[bucket],
                "--heat": 0,
                "--forge-delay": `${index * 140}ms`,
              } as CSSProperties
            }
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold capitalize" style={{ color: BUCKET_ACCENT[bucket] }}>{bucket}</p>
              <div className="h-8 w-24 rounded-full bg-[var(--muted-fill-strong)]" />
            </div>
            <div className="mt-12 space-y-4">
              <div className="h-5 rounded-full bg-[var(--muted-fill-strong)]" />
              <div className="h-5 w-11/12 rounded-full bg-[var(--muted-fill-strong)]" />
              <div className="h-5 w-8/12 rounded-full bg-[var(--muted-fill-strong)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
