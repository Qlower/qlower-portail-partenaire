"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  History,
  Settings,
  LogOut,
  ChevronDown,
  FileBarChart,
  Copy,
} from "lucide-react";

type InternalRole = "sales" | "sales_admin";
type ViewMode = "manager" | "collaborator";

interface InternalShellProps {
  children: React.ReactNode;
}

const NAV_BASE = [
  { href: "/sales", label: "Mon mois", icon: LayoutDashboard, exact: true },
  { href: "/sales/ventes", label: "Mes ventes", icon: TrendingUp, exact: false },
  { href: "/sales/equipe", label: "Équipe", icon: Users, exact: false },
  { href: "/sales/rapport", label: "Rapport", icon: FileBarChart, exact: false },
  { href: "/sales/historique", label: "Historique", icon: History, exact: false },
];

const NAV_ADMIN_EXTRA = [
  { href: "/sales/admin/attribution", label: "Attribution (admin)", icon: Settings, exact: false },
  { href: "/sales/admin/equipe", label: "Gestion équipe", icon: Users, exact: false },
  { href: "/admin/doublons", label: "Doublons HubSpot", icon: Copy, exact: false },
];

export function InternalShell({ children }: InternalShellProps) {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const internalRole = user?.user_metadata?.internal_role as InternalRole | undefined;
  const userName = (user?.user_metadata?.name as string | undefined) || user?.email || "—";

  // Toggle Manager / Collaborateur (sales_admin only).
  const [viewMode, setViewMode] = useState<ViewMode>("manager");
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Restore view mode from localStorage.
  useEffect(() => {
    if (internalRole === "sales_admin") {
      const saved = localStorage.getItem("qlower:internal:viewMode");
      if (saved === "collaborator" || saved === "manager") setViewMode(saved);
    }
  }, [internalRole]);

  function changeViewMode(m: ViewMode) {
    setViewMode(m);
    localStorage.setItem("qlower:internal:viewMode", m);
    setShowViewMenu(false);
    // Refresh page to apply new view (layout reads localStorage on mount).
    router.refresh();
  }

  // Loading guard.
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f7fafc] flex items-center justify-center">
        <div className="text-sm text-gray-500">Chargement…</div>
      </div>
    );
  }

  // Auth guard fallback (middleware should already redirect, but defense in depth).
  if (internalRole !== "sales" && internalRole !== "sales_admin") {
    return (
      <div className="min-h-screen bg-[#f7fafc] flex items-center justify-center px-6">
        <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#0A3855] mb-2">Accès refusé</h2>
          <p className="text-sm text-gray-600 mb-4">
            Cette page est réservée à l&apos;équipe sales interne de Qlower.
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm text-[#0A3855] hover:underline"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const navItems = internalRole === "sales_admin" && viewMode === "manager"
    ? [...NAV_BASE, ...NAV_ADMIN_EXTRA]
    : NAV_BASE;

  return (
    <div className="min-h-screen flex flex-col bg-[#f7fafc]">
      {/* Top bar */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0A3855] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            Q
          </div>
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            Qlower <span className="font-normal text-gray-400">Sales</span>
          </span>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm text-gray-700">{userName}</span>
          {internalRole === "sales_admin" && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
              Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle (sales_admin only) */}
          {internalRole === "sales_admin" && (
            <div className="relative">
              <button
                onClick={() => setShowViewMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 hover:border-gray-300 bg-white text-gray-700"
              >
                <span>👁</span>
                <span className="font-medium">
                  {viewMode === "manager" ? "Manager" : "Collaborateur"}
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showViewMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                  <button
                    onClick={() => changeViewMode("manager")}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${viewMode === "manager" ? "font-semibold text-[#0A3855]" : "text-gray-700"}`}
                  >
                    ✎ Manager <span className="text-gray-400 ml-1">(édition + équipe)</span>
                  </button>
                  <button
                    onClick={() => changeViewMode("collaborator")}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${viewMode === "collaborator" ? "font-semibold text-[#0A3855]" : "text-gray-700"}`}
                  >
                    👤 Collaborateur <span className="text-gray-400 ml-1">(comme un négo)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-100 py-4 px-3 flex-shrink-0">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors " +
                    (active
                      ? "bg-[#0A3855] text-white"
                      : "text-gray-700 hover:bg-gray-50")
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}

export function getViewMode(role: InternalRole | undefined): ViewMode {
  if (role !== "sales_admin") return "collaborator";
  if (typeof window === "undefined") return "manager";
  const saved = localStorage.getItem("qlower:internal:viewMode");
  return saved === "collaborator" ? "collaborator" : "manager";
}
