"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/useAuth";

export function NavBar() {
  const pathname = usePathname();

  // Login sayfasında navbar gösterme
  if (pathname === "/login") return null;

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/devices", label: "Cihazlar" },
    { href: "/messages", label: "Mesajlar" },
    { href: "/groups", label: "Gruplar" },
    { href: "/api-keys", label: "API Keys" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-6">
      <span className="font-bold text-green-600 text-lg">Wapi</span>
      <div className="flex gap-4 flex-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm transition-colors ${
              pathname === link.href
                ? "text-gray-900 font-medium"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <button
        onClick={logout}
        className="text-sm text-gray-400 hover:text-red-500 transition-colors"
      >
        Çıkış
      </button>
    </nav>
  );
}
