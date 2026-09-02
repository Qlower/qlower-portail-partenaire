"use client";

import { usePartnerContext } from "../layout";
import Communications from "@/components/partner/Communications";

export default function CommunicationsPage() {
  const { partner } = usePartnerContext();
  return <Communications partner={partner} />;
}
