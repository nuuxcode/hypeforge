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
};

console.log(JSON.stringify(result, null, 2));

if (!response.ok) {
  throw new Error(`Expected handled app failure/success to avoid HTTP errors, got ${response.status}.`);
}

if (!body || typeof body !== "object") {
  throw new Error("Expected JSON response body.");
}

if (body.ok === false && !body.debug?.events?.some((event) => event.level === "error")) {
  throw new Error("Expected app-level failure to include debug error events.");
}
