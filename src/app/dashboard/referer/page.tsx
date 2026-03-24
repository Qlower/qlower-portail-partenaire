"use client";

import { usePartnerContext } from "../layout";
import PageReferer from "@/components/partner/PageReferer";

export default function RefererPage() {
  const { partner } = usePartnerContext();
  return <PageReferer partner={partner} />;
}
