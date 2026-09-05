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
  title: "Bursar — runway-aware storage agent",
  description:
    "An autonomous agent that reads its own runway on Filecoin Pay, checks whether each storage provider is actually proving possession, and decides what is worth paying to keep.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="terminal-grid flex min-h-full flex-col bg-background text-zinc-200 selection:bg-emerald-500/30">
        {children}
      </body>
    </html>
  );
}
