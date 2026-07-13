// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { type CommitState, useCommittedState } from "@/hooks/use-committed-state";

type TestCard = { id: string; status: "idle" | "loading" };

let container: HTMLDivElement | undefined;

afterEach(() => {
  container?.remove();
  container = undefined;
});

describe("useCommittedState", () => {
  it("merges async card completions against the latest deck state", async () => {
    let commitCards: CommitState<TestCard[]> | undefined;
    let renderedCards: TestCard[] = [];

    function Harness() {
      const [cards, commit] = useCommittedState<TestCard[]>([
        { id: "grand", status: "idle" },
        { id: "mythic", status: "idle" },
      ]);
      commitCards = commit;
      renderedCards = cards;
      return null;
    }

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));

    await act(async () => {
      commitCards?.((current) => current.map((card) => ({ ...card, status: "loading" })));
      commitCards?.((current) => current.map((card) => card.id === "grand" ? { ...card, status: "idle" } : card));
      commitCards?.((current) => current.map((card) => card.id === "mythic" ? { ...card, status: "idle" } : card));
    });

    expect(renderedCards).toEqual([
      { id: "grand", status: "idle" },
      { id: "mythic", status: "idle" },
    ]);
    await act(async () => root.unmount());
  });
});
