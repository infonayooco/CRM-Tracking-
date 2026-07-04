import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Modernize's Latin typeface. Thai glyphs (absent here) fall back per-glyph to
// IBM Plex Sans Thai via the --font-sans stack in globals.css.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบติดตามงานสื่อสารลูกค้า",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${plusJakartaSans.variable} ${ibmPlexSansThai.variable} font-sans h-full bg-slate-100 text-slate-800 antialiased`}
    >
      <body className="min-h-full bg-slate-100">{children}</body>
    </html>
  );
}
