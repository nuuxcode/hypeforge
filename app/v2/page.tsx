import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The workspace moved from /v2 to the homepage. Links shared before the move
// (including ?share= deck links) land here and carry their params across.
export default async function LegacyV2Redirect({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(`/${suffix}`);
}
