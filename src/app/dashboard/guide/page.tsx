"use client";

import { useRouter } from "next/navigation";
import { usePartnerContext } from "../layout";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";

export default function GuidePage() {
  const { partner } = usePartnerContext();
  const router = useRouter();
  return (
    <OnboardingGuide
      partnerName={partner.nom}
      code={partner.code}
      utm={partner.utm}
      onDone={() => router.push("/dashboard")}
    />
  );
}
