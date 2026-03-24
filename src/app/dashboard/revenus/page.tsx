"use client";

import { usePartnerContext } from "../layout";
import Revenus from "@/components/partner/Revenus";

export default function RevenusPage() {
  const { partner } = usePartnerContext();
  return <Revenus partner={partner} />;
}
