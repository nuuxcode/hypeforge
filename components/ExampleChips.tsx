type ExampleChipsProps = {
  examples: readonly string[];
  onSelect: (value: string) => void;
};

export function ExampleChips({ examples, onSelect }: ExampleChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((example) => (
        <button
          className="min-h-10 rounded-full border border-neutral-950 bg-white px-3 py-2 text-left text-sm font-bold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-[#f7c948] focus:outline-none focus:ring-2 focus:ring-[#2f5d50]"
          key={example}
          type="button"
          onClick={() => onSelect(example)}
        >
          {example}
        </button>
      ))}
    </div>
  );
}
