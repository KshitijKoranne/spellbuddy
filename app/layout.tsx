import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpellBuddy 🐝 — Learn to Spell!",
  description: "A fun spelling game for kids using speech recognition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
