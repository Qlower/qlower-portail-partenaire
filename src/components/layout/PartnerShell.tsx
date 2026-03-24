"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePartner } from "@/hooks/usePartnerData";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";
import type { Partner } from "@/types";

// ── Partner Context ──────────────────────────────────────────
interface PartnerContextType {
  partner: Partner;
  partnerId: string;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export function usePartnerContext(): PartnerContextType {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartnerContext must be used within PartnerShell");
  return ctx;
}

// ── Shell Component ──────────────────────────────────────────
type Module = "guide" | "dashboard" | "referer" | "revenus" | "outils" | "settings";

export function PartnerShell() {
  const { user, signOut, loading: authLoading } = useAuth();
  const partnerId = user?.user_metadata?.partner_id as string | undefined;
  const { data: partner, isLoading: partnerLoading, error: partnerError } = usePartner(partnerId);

  const [module, setModule] = useState<Module>("dashboard");
  const [guideDone, setGuideDone] = useState(false);

  const onNavigate = useCallback((key: string) => {
    setModule(key as Module);
  }, []);

  const handleGuideDone = useCallback(() => {
    setGuideDone(true);
    setModule("dashboard");
  }, []);

  // ── Loading state ──
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

  // ── Error state ──
  if (partnerError || !partner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">&#x26A0;&#xFE0F;</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Espace non accessible</h2>
          <p className="text-sm text-gray-500 mb-4">
            {partnerError
              ? "Erreur lors du chargement des donnees partenaire."
              : "Aucun compte partenaire associe a cet utilisateur."}
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm text-[#0A3855] underline hover:text-[#1a5a7a]"
          >
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  // ── Render active module ──
  const renderModule = () => {
    switch (module) {
      case "guide":
        return (
          <OnboardingGuide
            partnerName={partner.nom}
            code={partner.code}
            utm={partner.utm}
            onDone={handleGuideDone}
          />
        );
      case "dashboard":
        return (
          <Dashboard
            partnerId={partner.id}
            partnerType={partner.type}
            commRules={partner.comm_rules}
            biensMoyens={partner.biens_moyens}
            caParClient={partner.ca_par_client}
            code={partner.code}
            utm={partner.utm}
            onNavigate={onNavigate}
          />
        );
      case "referer":
        return (
          <div className="py-12 text-center text-sm text-gray-400">
            Module Referer - a implementer
          </div>
        );
      case "revenus":
        return (
          <div className="py-12 text-center text-sm text-gray-400">
            Module Revenus - a implementer
          </div>
        );
      case "outils":
        return (
          <div className="py-12 text-center text-sm text-gray-400">
            Module Outils - a implementer
          </div>
        );
      case "settings":
        return (
          <div className="py-12 text-center text-sm text-gray-400">
            Module Parametres - a implementer
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <PartnerContext.Provider value={{ partner, partnerId: partner.id }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Bar */}
        <TopBar
          partnerName={partner.nom}
          brandColor={partner.brand_color}
          contrat={partner.contrat}
          onLogout={() => signOut()}
        />

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            activeModule={module}
            onNavigate={onNavigate}
            showGuide={true}
            guideDone={guideDone}
            contrat={partner.contrat}
          />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-5">
            {renderModule()}
          </main>
        </div>
      </div>
    </PartnerContext.Provider>
  );
}
