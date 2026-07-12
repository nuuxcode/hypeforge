import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/share/[slug]/route";
import { POST } from "@/app/api/share/route";
import { COMPLIANT_GUIDELINES, COMPLIANT_TEXT } from "@/tests/fixtures/guidelines";

let temporaryDirectory = "";

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "hypeforge-share-"));
  process.env.HYPEFORGE_SHARE_STORE_PATH = path.join(temporaryDirectory, "shares.json");
});

afterEach(async () => {
  delete process.env.HYPEFORGE_SHARE_STORE_PATH;
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("shared decks", () => {
  it("creates a short public route and returns the original deck from it", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/share", {
        method: "POST",
        body: JSON.stringify({
          input: "Customer Success Manager",
          deliveryMode: "direct",
          cards: [
            {
              personaId: "epic-bard",
              personaName: "Epic Bard",
              text: COMPLIANT_TEXT,
              dramaLevel: 2,
              originalInput: "Customer Success Manager",
              deliveryMode: "direct",
              guidelines: COMPLIANT_GUIDELINES,
            },
          ],
        }),
      }),
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.ok).toBe(true);
    expect(created.slug).toMatch(/^[A-Za-z0-9_-]{8,20}$/);

    const readResponse = await GET(new Request(`http://localhost/api/share/${created.slug}`), {
      params: Promise.resolve({ slug: created.slug }),
    });
    const read = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(read.deck.input).toBe("Customer Success Manager");
    expect(read.deck.deliveryMode).toBe("direct");
    expect(read.deck.cards[0].deliveryMode).toBe("direct");
    expect(read.deck.cards[0].text).toContain("cosmic air-traffic controller");
    expect(read.deck.cards[0].guidelines).toEqual(COMPLIANT_GUIDELINES);
  });

  it("rejects invalid shared-deck payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/share", {
        method: "POST",
        body: JSON.stringify({ input: "x", cards: [] }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
