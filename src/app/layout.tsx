import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
            <a href="/" className="font-semibold tracking-tight">
              FairShot
            </a>
            <div className="flex gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <a href="/" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Dashboard
              </a>
              <a href="/pipeline" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Pipeline
              </a>
              <a href="/apply" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Apply
              </a>
              <a href="/settings" className="hover:text-neutral-900 dark:hover:text-neutral-100">
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
