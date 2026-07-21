"use client";

import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "◫" },
  { href: "/retrieve", label: "Retrieve", icon: "◎" },
  { href: "/lifecycle", label: "Lifecycle", icon: "◷" },
  { href: "/reports", label: "Reports", icon: "▤" },
  { href: "/chat", label: "Chat", icon: "◈" },
  { href: "/tasks", label: "Tasks", icon: "☰" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-sans text-sm">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-cyan-500/20">IM</span>
              <span className="text-cyan-400 font-bold text-sm tracking-tight">Incident Management PoC</span>
            </div>
            <span className="text-gray-600 text-xs">v1.0</span>
          </div>
        </header>

        {/* Layout */}
        <div className="flex">
          {/* Sidebar Nav */}
          <nav className="w-48 min-h-[calc(100vh-3.5rem)] border-r border-gray-800 bg-gray-900/50 sticky top-14">
            <div className="p-3 space-y-0.5">
              {NAV.map((n) => {
                const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
                return (
                  <Link key={n.href} href={n.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                      active
                        ? "bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 shadow-sm shadow-cyan-900/20"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
                    }`}>
                    <span className="text-sm">{n.icon}</span>
                    {n.label}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-glow" />}
                  </Link>
                );
              })}
            </div>
            <div className="absolute bottom-4 left-3 right-3">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800">
                <div className="text-[10px] text-gray-500 mb-1">Quick Start</div>
                <Link href="/lifecycle" className="text-[10px] text-cyan-500 hover:text-cyan-400 block">
                  Run Lifecycle Demo →
                </Link>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
