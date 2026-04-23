"use client";

import { useEffect, useState } from "react";
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

const ADMIN_EMAILS = ["alexandre@qlower.com", "admin@qlower.com"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Impersonation: admin can view any partner via ?as=partner_id
  // useState reads the URL once on mount — persists across navigations
  const [impersonateId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("as");
  });
  const isAdmin = ADMIN_EMAILS.includes(user?.email || "");
  const overrideId = isAdmin && impersonateId ? impersonateId : undefined;

  const partnerIdFromMeta = overrideId || (user?.user_metadata?.partner_id as string | undefined);
  const { data: partnerById, isLoading: loadingById } = usePartner(partnerIdFromMeta);
  // Fallback: also try user_id lookup if metadata partner not found (e.g. after duplicate cleanup)
  const shouldFallback = !overrideId && (!partnerIdFromMeta || (!loadingById && !partnerById));
  const { data: partnerByUser, isLoading: loadingByUser } = usePartnerByUserId(
    shouldFallback && user?.id ? user.id : undefined
  );

  const partner = partnerById || partnerByUser;
  const partnerLoading = (partnerIdFromMeta ? loadingById : false) || (shouldFallback && user?.id ? loadingByUser : false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guideDone, setGuideDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Auto-fix: if partner found via user_id fallback but metadata has wrong partner_id, update it
  useEffect(() => {
    if (partnerByUser && partnerIdFromMeta && partnerIdFromMeta !== partnerByUser.id) {
      // Metadata points to deleted partner, update it silently
      const supabase = (async () => {
        const { createClient: createBrowser } = await import("@/lib/supabase-browser");
        const sb = createBrowser();
        await sb.auth.updateUser({ data: { partner_id: partnerByUser.id } });
      })();
    }
  }, [partnerByUser, partnerIdFromMeta]);

  // Close sidebar on route change (mobile) + sync guide state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuideDone(localStorage.getItem("guide_completed") === "true");
  }, [pathname]);

  // One-time redirect to guide on initial load if guide not completed
  useEffect(() => {
    const done = localStorage.getItem("guide_completed") === "true";
    if (!done && pathname === "/dashboard") {
      router.replace("/dashboard/guide");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Block dashboard if account is suspended
  if (partner.statut === "suspendu" && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-[#FFE5E5]/40 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accès suspendu</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Votre espace partenaire <strong>{partner.nom}</strong> est actuellement suspendu.
            <br />
            Pour toute question, merci de contacter notre équipe à{" "}
            <a href="mailto:partenaires@qlower.com" className="text-[#0A3855] underline font-semibold">
              partenaires@qlower.com
            </a>
            .
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // Block dashboard if contract not signed yet
  if (partner.statut === "en_attente" && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-[#E5EDF1]/30 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#E5EDF1] flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#0A3855]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Inscription en cours de traitement</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Merci pour votre inscription, <strong>{partner.contact_prenom || partner.nom}</strong> !
            Coline, notre responsable partenariats, vous contacte sous <strong>48h</strong> pour finaliser votre contrat d&apos;affiliation.
          </p>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Prochaines étapes</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Inscription envoyée</p>
                  <p className="text-xs text-gray-400">Vos informations ont bien été transmises</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Prise de contact par Coline</p>
                  <p className="text-xs text-gray-400">Sous 48h pour discuter de votre contrat</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Signature du contrat</p>
                  <p className="text-xs text-gray-300">Votre code promo et tableau de bord seront activés</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <a href="mailto:coline@qlower.com" className="text-sm text-[#0A3855] font-medium hover:underline">
              Contacter Coline
            </a>
            <span className="text-gray-300">|</span>
            <button onClick={() => signOut()} className="text-sm text-gray-400 hover:text-gray-600">
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleNavigate = (key: string) => {
    router.push(key === "dashboard" ? "/dashboard" : `/dashboard/${key}`);
    setSidebarOpen(false);
  };

  return (
    <PartnerContext.Provider value={{ partner, partnerId: partner.id }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {overrideId && (
          <div className="bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
            Vue partenaire : {partner.nom} — <button onClick={() => router.push("/admin")} className="underline">Retour admin</button>
          </div>
        )}
        <TopBar
          partnerName={partner.nom}
          brandColor={partner.brand_color}
          contrat={partner.contrat}
          onLogout={() => signOut()}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />

        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            fixed inset-y-0 left-0 z-40 w-[220px] transform transition-transform duration-200 ease-out
            lg:relative lg:translate-x-0 lg:z-auto
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}>
            <Sidebar
              activeModule={activeModule}
              onNavigate={handleNavigate}
              showGuide={true}
              guideDone={guideDone}
              contrat={partner.contrat}
            />
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </PartnerContext.Provider>
  );
}
