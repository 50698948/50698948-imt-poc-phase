"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "◫" },
  { href: "/retrieve", label: "Retrieve", icon: "◎" },
  { href: "/lifecycle", label: "Lifecycle", icon: "◷" },
  { href: "/reports", label: "Reports", icon: "▤" },
  { href: "/tasks", label: "Tasks", icon: "☰" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatIncident, setChatIncident] = useState("");

  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-sm">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">IM</span>
              <span className="text-gray-800 font-semibold text-sm tracking-tight">Incident Management PoC</span>
            </div>
            <span className="text-gray-400 text-xs">v1.0</span>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <nav className="w-48 min-h-[calc(100vh-3.5rem)] border-r border-gray-200 bg-white/60 sticky top-14">
            <div className="p-3 space-y-0.5">
              {NAV.map((n) => {
                const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
                return (
                  <Link key={n.href} href={n.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      active ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-transparent"
                    }`}>
                    <span className="text-sm">{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
            </div>
            <div className="absolute bottom-4 left-3 right-3">
              <button onClick={() => { setChatIncident(""); setChatOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-all">
                <span>💬</span> Open Chat
              </button>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>

        {/* Chat Drawer */}
        {chatOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20" onClick={() => setChatOpen(false)} />
            <div className="relative w-[420px] bg-white border-l border-gray-200 shadow-xl flex flex-col animate-slide-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">Chat</span>
                  <input
                    value={chatIncident}
                    onChange={(e) => setChatIncident(e.target.value)}
                    placeholder="Incident No"
                    className="bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700 w-36 font-mono focus:outline-none focus:border-indigo-300"
                  />
                </div>
                <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 text-xs text-gray-500">
                <p className="text-center py-8">Chat integration in progress...</p>
              </div>
              <div className="border-t border-gray-100 p-3">
                <input
                  placeholder="Type a command or drop files..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-indigo-300"
                />
              </div>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
