import type { Metadata, Viewport } from "next";
import { SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "HypeForge | AI compliment generator",
    template: `%s | ${SITE_NAME}`,
  },
  applicationName: SITE_NAME,
  description: "Turn any person into a living legend with three distinct, wildly enthusiastic AI compliments.",
  keywords: ["AI compliment generator", "compliment ideas", "write a compliment", "appreciation message", "team praise"],
  category: "productivity",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "HypeForge | AI compliment generator",
    description: "Turn any person into a living legend with three distinct, wildly enthusiastic AI compliments.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "HypeForge AI compliment generator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HypeForge | AI compliment generator",
    description: "Turn any person into a living legend with three distinct, wildly enthusiastic AI compliments.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    url: siteUrl(),
    description: "An AI compliment generator that writes three distinct, shareable compliments for a person or role.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#f5efe2] text-neutral-950 antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  );
}
