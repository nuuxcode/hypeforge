import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/v2`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/compliment-guide`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
