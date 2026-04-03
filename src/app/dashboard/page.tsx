"use client";

import { usePartnerContext } from "./layout";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  const { partner } = usePartnerContext();
  return (
    <Dashboard
      partnerId={partner.id}
      partnerType={partner.type}
      code={partner.code}
      utm={partner.utm}
      onNavigate={(key) => window.location.href = key === "dashboard" ? "/dashboard" : `/dashboard/${key}`}
    />
  );
}
