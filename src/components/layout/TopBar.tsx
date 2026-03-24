"use client";

import { Button } from "@/components/ui/button";

interface TopBarProps {
  partnerName: string;
  brandColor?: string;
  contrat: string;
  onLogout: () => void;
  onMenuToggle?: () => void;
}

export function TopBar({ partnerName, onLogout, onMenuToggle }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-5 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}
        <div className="w-8 h-8 rounded-xl bg-[#0A3855] flex items-center justify-center text-white font-bold text-sm">
          Q
        </div>
        <span className="text-sm font-semibold text-gray-900">
          Qlower <span className="font-normal text-gray-400">Pro</span>
        </span>
        <span className="hidden sm:inline text-xs text-gray-400">
          {partnerName}
        </span>
      </div>

      {/* Right */}
      <Button variant="ghost" size="icon-sm" className="text-gray-400 hover:text-gray-600" onClick={onLogout}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
      </Button>
    </header>
  );
}
