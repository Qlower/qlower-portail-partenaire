"use client";

import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0A3855] text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">Administration Qlower</span>
          <span className="text-xs bg-[#F6CCA4] text-[#1C1C1C] px-2 py-0.5 rounded-full font-semibold">
            Master Pro
          </span>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          Deconnexion
        </button>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
