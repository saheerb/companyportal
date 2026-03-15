"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "📋" },
  { href: "/inventory", label: "Inventory", icon: "🚗" },
  { href: "/finance", label: "Finance", icon: "💰" },
  { href: "/records", label: "Records", icon: "📁" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <h1 className="font-bold text-lg leading-tight">HappyCarDeals</h1>
        <p className="text-xs text-gray-400 mt-0.5">Company Portal</p>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 truncate mb-2">
          {session?.user?.name ?? "User"}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
