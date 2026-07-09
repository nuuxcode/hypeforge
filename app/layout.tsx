import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HypeForge",
  description: "Turn any person into a living legend with three wildly enthusiastic compliments.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#f5efe2] text-neutral-950 antialiased">
        {children}
      </body>
    </html>
  );
}
