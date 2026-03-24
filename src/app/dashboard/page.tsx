"use client";

import { usePartnerContext } from "./layout";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  const { partner } = usePartnerContext();
  return (
    <Dashboard
      partnerId={partner.id}
      partnerType={partner.type}
      commRules={partner.comm_rules}
      biensMoyens={partner.biens_moyens}
      caParClient={partner.ca_par_client}
      code={partner.code}
      utm={partner.utm}
      onNavigate={(key) => window.location.href = key === "dashboard" ? "/dashboard" : `/dashboard/${key}`}
    />
  );
}
