"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TopBarProps {
  partnerName: string;
  brandColor?: string;
  contrat: string;
  onLogout: () => void;
  onMenuToggle?: () => void;
}

export function TopBar({ partnerName, brandColor, contrat, onLogout, onMenuToggle }: TopBarProps) {
  const logoColor = brandColor || "#0A3855";

  // Build initials from partner name (up to 2 chars)
  const initials = partnerName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 bg-white border-b border-gray-200/60 flex items-center justify-between px-4 sm:px-5 flex-shrink-0">
      {/* Left: Hamburger (mobile) + Logo + Name + Partner badge */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}
        {/* Q Logo */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: logoColor }}
        >
          Q
        </div>
        <span className="text-[13px] font-semibold text-gray-900 tracking-tight">
          Qlower <span className="font-normal text-gray-400">Pro</span>
        </span>

        <Separator orientation="vertical" className="h-5" />

        {/* Partner name badge */}
        <Badge variant="secondary" className="bg-[#E5EDF1] text-[#0A3855] text-[11px] font-medium">
          {partnerName}
        </Badge>

        {/* Marque Blanche badge */}
        {contrat === "marque_blanche" && (
          <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-[11px] font-medium">
            Marque Blanche
          </Badge>
        )}
      </div>

      {/* Right: Avatar + Logout */}
      <div className="flex items-center gap-2.5">
        {/* Avatar circle with initials */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ backgroundColor: logoColor }}
        >
          {initials || "P"}
        </div>

        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700" onClick={onLogout}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          <span className="text-xs">Deconnexion</span>
        </Button>
      </div>
    </header>
  );
}
