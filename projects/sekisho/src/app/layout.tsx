import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "関所 (Sekisho) — SRE運用レポート",
  description: "週次のシステム状態を採点・保存・比較する運用レポーティング基盤",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
