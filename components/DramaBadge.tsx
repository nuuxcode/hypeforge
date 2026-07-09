type DramaBadgeProps = {
  level: number;
};

function labelForLevel(level: number): string {
  if (level <= 1) return "Drama L1";
  if (level === 2) return "Drama L2";
  if (level === 3) return "Drama L3";
  return `Mythology L${level}`;
}

export function DramaBadge({ level }: DramaBadgeProps) {
  return (
    <span className="inline-flex h-8 items-center rounded-full border border-neutral-950 bg-[#f7c948] px-3 text-xs font-black uppercase text-neutral-950">
      {labelForLevel(level)}
    </span>
  );
}
