import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { JsMotionScript } from "@/motion/js-motion-script";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Accent only (pull quotes, single words), so it should not compete for early bandwidth.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Worlds.fm — Every sound has a world",
  description:
    "Worlds.fm is an AI-powered music and cultural discovery platform. Explore the places, people, festivals, and movements behind the music you love.",
  applicationName: "Worlds.fm",
  keywords: [
    "music discovery",
    "cultural intelligence",
    "music map",
    "artists",
    "festivals",
    "Worlds.fm",
  ],
  openGraph: {
    title: "Worlds.fm — Every sound has a world",
    description:
      "Discover the places, people, and cultures behind the music you love.",
    siteName: "Worlds.fm",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.night,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: JsMotionScript adds a class to <html> before hydration.
    <html
      lang="en"
      className={`${manrope.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <JsMotionScript />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
