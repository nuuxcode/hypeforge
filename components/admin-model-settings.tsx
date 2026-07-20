"use client";

import { Cpu } from "lucide-react";
import { saveModelSelection, useModelSelection } from "@/lib/model-choice";
import { GEMINI_MODEL_OPTIONS, type GeminiModelId, type ModelSelection } from "@/lib/models";

const MODEL_ROLES: Array<{ key: keyof ModelSelection; label: string; hint: string }> = [
  { key: "main", label: "Writer", hint: "Generates every compliment" },
  { key: "backup", label: "Backup", hint: "Retried when the writer fails" },
  { key: "validator", label: "Judge", hint: "Audits rules at temperature 0" },
];

export function AdminModelSettings() {
  const models = useModelSelection();
  const updateModel = (key: keyof ModelSelection, value: string) => {
    const next: ModelSelection = { ...models };
    if (value) next[key] = value as GeminiModelId;
    else delete next[key];
    saveModelSelection(next);
  };

  return (
    <section aria-labelledby="admin-models-title" className="mt-8 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#6e5ae6]/10 text-[#6e5ae6]">
          <Cpu aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="font-semibold" id="admin-models-title">AI models</h2>
          <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
            Override the Gemini model per role. Applies to generations made from this browser while your admin
            session is active; the server ignores overrides from anyone else. Stronger models can be slower and
            use more quota.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {MODEL_ROLES.map((role) => (
          <label className="rounded-xl border border-black/10 bg-[#f5f5f7] p-4" key={role.key}>
            <span className="block text-sm font-semibold">{role.label}</span>
            <span className="mt-0.5 block text-xs text-[#6e6e73]">{role.hint}</span>
            <select
              className="mt-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6e5ae6]/25"
              value={models[role.key] ?? ""}
              onChange={(event) => updateModel(role.key, event.target.value)}
            >
              <option value="">Server default</option>
              {GEMINI_MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
