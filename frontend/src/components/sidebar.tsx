"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  PenTool,
  Aperture,
  LayoutDashboard,
  Settings,
  LogOut,
  CircleUser,
  BarChart3,
  Table,
  FileDown
} from "lucide-react";
import ServerConfigModal from "@/components/ServerConfigModal";

export default function Sidebar() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/detection", icon: LayoutDashboard },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Data Logs", href: "/logs", icon: Table },
    { name: "Export Reports", href: "/export", icon: FileDown },
    { name: "Server Setup", href: "#settings", icon: Settings },
  ];

  return (
    <aside className="h-screen w-64 bg-zinc-950 border-r border-zinc-800/50 flex flex-col text-zinc-100 font-sans sticky top-0">
      {/* Brand Logo */}
      <div className="h-20 flex items-center px-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            <Aperture size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-widest uppercase text-white">
            V<span className="text-blue-500">Count</span>
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">
          Workspace
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.name === "Dashboard" && pathname.startsWith("/detection"));

          if (item.href === "#settings") {
            return (
              <button
                key={item.name}
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 cursor-pointer"
              >
                <Icon size={20} className="text-zinc-500" />
                <span className="text-sm font-medium">{item.name}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                ? "bg-blue-600/10 text-blue-400 font-medium"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
            >
              <Icon size={20} className={isActive ? "text-blue-500" : "text-zinc-500"} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-zinc-950">
            <CircleUser size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">Account</p>
            <p className="text-xs text-zinc-500 truncate">name@studio.com</p>
          </div>
        </div>

        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <LogOut size={20} />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </div>
      <ServerConfigModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </aside>
  );
}