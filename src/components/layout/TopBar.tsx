"use client";

import { Badge, Button } from "@/components/ui";

interface TopBarProps {
  partnerName: string;
  brandColor?: string;
  contrat: string;
  onLogout: () => void;
}

export function TopBar({ partnerName, brandColor, contrat, onLogout }: TopBarProps) {
  const logoColor = brandColor || "#0A3855";

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 flex-shrink-0">
      {/* Left: Logo + Name */}
      <div className="flex items-center gap-3">
        {/* Q Logo */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ backgroundColor: logoColor }}
        >
          Q
        </div>
        <span className="text-sm font-bold text-gray-900 tracking-tight">
          Qlower <span className="font-normal text-gray-400">Pro</span>
        </span>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Partner name badge */}
        <Badge variant="blue">{partnerName}</Badge>

        {/* Marque Blanche badge */}
        {contrat === "marque_blanche" && (
          <Badge variant="purple">Marque Blanche</Badge>
        )}
      </div>

      {/* Right: Logout */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="text-xs" onClick={onLogout}>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Deconnexion
          </span>
        </Button>
      </div>
    </header>
  );
}
