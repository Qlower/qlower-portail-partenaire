"use client";

import { useRouter } from "next/navigation";
import { usePartnerContext } from "../layout";
import Parametres from "@/components/partner/Parametres";

export default function SettingsPage() {
  const { partner } = usePartnerContext();
  const router = useRouter();
  return (
    <Parametres
      partner={partner}
      onRestartGuide={() => router.push("/dashboard/guide")}
    />
  );
}
