import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "IMT PoC — Incident Management",
  description: "Intelligent Incident Ticket Retrieval & Action Plan Generation",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/retrieve", label: "E2E Retrieve" },
  { href: "/lifecycle", label: "Lifecycle Demo" },
  { href: "/tasks", label: "Task Board" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-mono text-sm">
        <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-12">
            <span className="text-cyan-400 font-bold text-base">IMT PoC</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-gray-400 hover:text-white transition-colors text-xs uppercase tracking-wider">
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
