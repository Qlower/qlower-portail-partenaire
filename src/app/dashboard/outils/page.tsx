"use client";

import { usePartnerContext } from "../layout";
import Outils from "@/components/partner/Outils";

export default function OutilsPage() {
  const { partner } = usePartnerContext();
  return <Outils partner={partner} />;
}
