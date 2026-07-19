import type { Metadata } from "next";
import { IBM_Plex_Sans, Work_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FairShot — the VC operating system for overlooked founders",
  description:
    "Finds overlooked founders, assesses them like a world-class talent team, and delivers an evidence-backed $100K decision within 24 hours. Built for Hack-Nation's 6th Global AI Hackathon, Maschmeyer Group challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${workSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
            <a
              href="/"
              className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight"
            >
              <span
                aria-hidden
                className="inline-block h-3.5 w-3.5 rounded-[2px] border-2 border-[var(--color-border)] bg-[var(--color-main)]"
              />
              FairShot
            </a>
            <div className="flex gap-4 text-sm font-medium">
              <a href="/" className="hover:text-[var(--color-main)]">
                Dashboard
              </a>
              <a href="/pipeline" className="hover:text-[var(--color-main)]">
                Pipeline
              </a>
              <a href="/apply" className="hover:text-[var(--color-main)]">
                Apply
              </a>
              <a href="/settings" className="hover:text-[var(--color-main)]">
                Thesis
              </a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
