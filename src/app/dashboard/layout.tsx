"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePartner, usePartnerByUserId } from "@/hooks/usePartnerData";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { createContext, useContext } from "react";
import type { Partner } from "@/types";

// ── Partner Context ──────────────────────────────────────────
interface PartnerContextType {
  partner: Partner;
  partnerId: string;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export function usePartnerContext(): PartnerContextType {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartnerContext must be used within DashboardLayout");
  return ctx;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const partnerIdFromMeta = user?.user_metadata?.partner_id as string | undefined;
  const { data: partnerById, isLoading: loadingById } = usePartner(partnerIdFromMeta);
  const { data: partnerByUser, isLoading: loadingByUser } = usePartnerByUserId(
    !partnerIdFromMeta && user?.id ? user.id : undefined
  );

  const partner = partnerById || partnerByUser;
  const partnerLoading = (partnerIdFromMeta ? loadingById : false) || (!partnerIdFromMeta && user?.id ? loadingByUser : false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Derive active module from pathname
  const segments = pathname.split("/");
  const activeModule = segments[2] || "dashboard";

  if (authLoading || partnerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#0A3855] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Espace non accessible</h2>
          <p className="text-sm text-gray-500 mb-4">Aucun compte partenaire associé à cet utilisateur.</p>
          <button onClick={() => signOut()} className="text-sm text-[#0A3855] underline hover:text-[#0A3855]/70">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <PartnerContext.Provider value={{ partner, partnerId: partner.id }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar
          partnerName={partner.nom}
          brandColor={partner.brand_color}
          contrat={partner.contrat}
          onLogout={() => signOut()}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeModule={activeModule}
            onNavigate={(key) => router.push(key === "dashboard" ? "/dashboard" : `/dashboard/${key}`)}
            showGuide={true}
            guideDone={false}
            contrat={partner.contrat}
          />
          <main className="flex-1 overflow-y-auto p-5">
            {children}
          </main>
        </div>
      </div>
    </PartnerContext.Provider>
  );
}
