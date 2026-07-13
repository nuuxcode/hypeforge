const baseUrl = process.env.HYPEFORGE_VERIFY_URL ?? "http://localhost:3001";
const url = new URL("/api/generate", baseUrl);

const response = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ input: "Customer Success Manager" }),
});

const body = await response.json().catch(() => null);
const result = {
  status: response.status,
  httpOk: response.ok,
  appOk: body?.ok,
  error: body?.error,
  requestId: body?.debug?.requestId,
  eventCount: body?.debug?.events?.length,
  cardCount: Array.isArray(body?.cards) ? body.cards.length : 0,
  validCardCount: Array.isArray(body?.cards)
    ? body.cards.filter((card) =>
        card?.status === "idle" &&
        typeof card?.text === "string" &&
        card.text.trim() &&
        card?.guidelines?.checks?.length === 8 &&
        card.guidelines.checks.every((check) => check?.state === "pass"),
      ).length
    : 0,
};

console.log(JSON.stringify(result, null, 2));

if (!response.ok) {
  throw new Error(`Expected handled app failure/success to avoid HTTP errors, got ${response.status}.`);
}

if (!body || typeof body !== "object") {
  throw new Error("Expected JSON response body.");
}

if (body.ok !== true) {
  throw new Error(`Expected a successful app response, got: ${body.error ?? "unknown app failure"}.`);
}

if (!Array.isArray(body.cards) || body.cards.length !== 3) {
  throw new Error(`Expected exactly 3 cards, got ${Array.isArray(body.cards) ? body.cards.length : 0}.`);
}

for (const [index, card] of body.cards.entries()) {
  const passed = card?.status === "idle" &&
    typeof card?.text === "string" &&
    card.text.trim().length > 0 &&
    card?.guidelines?.checks?.length === 8 &&
    card.guidelines.checks.every((check) => check?.state === "pass");
  if (!passed) throw new Error(`Card ${index + 1} did not satisfy the complete-deck contract.`);
}
