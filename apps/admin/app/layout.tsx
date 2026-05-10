import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Wapi — WhatsApp API Yönetim Paneli",
  description: "WhatsApp cihaz ve mesaj yönetimi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-6">
          <span className="font-bold text-green-600 text-lg">Wapi</span>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Dashboard
          </Link>
          <Link
            href="/devices"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Cihazlar
          </Link>
          <Link
            href="/messages"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Mesajlar
          </Link>
          <Link
            href="/api-keys"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            API Keys
          </Link>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
