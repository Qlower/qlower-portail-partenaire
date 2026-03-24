"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  showWhen?: "always" | "guide-pending";
  orangeDot?: boolean;
}

interface SidebarProps {
  activeModule: string;
  onNavigate: (key: string) => void;
  showGuide: boolean;
  guideDone: boolean;
  contrat: string;
}

export function Sidebar({ activeModule, onNavigate, showGuide, guideDone, contrat }: SidebarProps) {
  const navItems: NavItem[] = [
    ...(showGuide && !guideDone
      ? [
          {
            key: "guide",
            label: "Guide",
            icon: (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            ),
            showWhen: "guide-pending" as const,
            orangeDot: !guideDone,
          },
        ]
      : []),
    {
      key: "dashboard",
      label: "Tableau de bord",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      key: "referer",
      label: "Referer",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      ),
    },
    {
      key: "revenus",
      label: "Revenus",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      key: "outils",
      label: "Outils",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 5.1a2.121 2.121 0 11-3-3l5.1-5.1m0 0L2.82 7.575a1.5 1.5 0 010-2.121l3.182-3.182a1.5 1.5 0 012.121 0L15.17 9.42m-3.75 5.75l5.1 5.1a2.121 2.121 0 003-3l-5.1-5.1m0 0l4.59-4.59a1.5 1.5 0 000-2.121l-3.182-3.182a1.5 1.5 0 00-2.121 0L9.42 8.17" />
        </svg>
      ),
    },
    {
      key: "settings",
      label: "Parametres",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const contratLabel = contrat === "marque_blanche" ? "Marque Blanche" : contrat === "affiliation" ? "Affiliation" : contrat.replace("_", " ");

  return (
    <nav className="w-[220px] bg-white border-r border-gray-200/60 min-h-screen flex flex-col flex-shrink-0">
      {/* Nav items */}
      <div className="px-3 pt-5 space-y-0.5 flex-1">
        {navItems.map((item) => {
          const isActive = activeModule === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                isActive
                  ? "bg-[#0A3855]/[0.08] text-[#0A3855] font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium"
              }`}
            >
              {/* Active left accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#0A3855]" />
              )}

              <span className={`flex-shrink-0 ${isActive ? "text-[#0A3855]" : "text-gray-400"}`}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>

              {/* Orange dot indicator for guide */}
              {item.orangeDot && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#F6CCA4] ring-2 ring-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom: contract type badge */}
      <div className="px-4 pb-4">
        <Separator className="mb-3" />
        <Badge variant="secondary" className="bg-gray-50 text-gray-500 text-[10px] font-medium capitalize">
          {contratLabel}
        </Badge>
      </div>
    </nav>
  );
}
