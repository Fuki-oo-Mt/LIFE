import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Luna 🌙 — Cradle社 自律型コンパニオン",
  description:
    "Vtuber型コンパニオン × 自律業務代行エージェント。Lunaが社長の実務を代行します。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
