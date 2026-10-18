import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
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
  themeColor: "#080A09",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
