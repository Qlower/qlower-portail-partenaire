"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase-browser";
import type {
  Partner,
  Lead,
  StatMonthly,
  PartnerAction,
  Referral,
  Invoice,
} from "@/types";

export function usePartner(partnerId: string | undefined) {
  return useQuery<Partner>({
    queryKey: ["partner", partnerId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("id", partnerId!)
        .single();
      if (error) throw error;
      return data as Partner;
    },
    enabled: !!partnerId,
  });
}

// Fallback: find partner by auth user_id (when partner_id not in metadata)
export function usePartnerByUserId(userId: string | undefined) {
  return useQuery<Partner>({
    queryKey: ["partner_by_user", userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", userId!)
        .single();
      if (error) throw error;
      return data as Partner;
    },
    enabled: !!userId,
  });
}

export function useLeads(partnerId: string | undefined) {
  return useQuery<Lead[]>({
    queryKey: ["leads", partnerId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!partnerId,
  });
}

export function useMonthlyStats(partnerId: string | undefined) {
  return useQuery<StatMonthly[]>({
    queryKey: ["stats_monthly", partnerId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("stats_monthly")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("mois");
      if (error) throw error;
      return data as StatMonthly[];
    },
    enabled: !!partnerId,
  });
}

export function useActions(partnerId: string | undefined) {
  return useQuery<PartnerAction[]>({
    queryKey: ["actions", partnerId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("partner_actions")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PartnerAction[];
    },
    enabled: !!partnerId,
  });
}

export function useReferrals(partnerId: string | undefined) {
  return useQuery<Referral[]>({
    queryKey: ["referrals", partnerId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Referral[];
    },
    enabled: !!partnerId,
  });
}

export interface CommissionData {
  year: number;
  partnerId: string;
  montantParAbonne: number;
  totalSubscribers: number;
  totalCommission: number;
  previousYear: {
    year: number;
    totalSubscribers: number;
    totalCommission: number;
  };
  ruleDetails?: Array<{ label: string; montant: number; type: "one_shot" | "recurring" }>;
  months: Array<{
    month: number;
    label: string;
    subscribers: number;
    commission: number;
    subscriberNames: string[];
    subscriberDetails?: Array<{
      name: string;
      commission: number;
      entryDate: string;
      exitDate: string | null;
      isCurrentlySubscriber: boolean;
      isResubscription: boolean;
      unsubscribedDuringYear: boolean;
    }>;
    previousYear: number;
    previousYearCommission: number;
  }>;
  totalContacts: number;
}

export function useCommissions(partnerId: string | undefined, year?: number) {
  const currentYear = year || new Date().getFullYear();
  return useQuery<CommissionData>({
    queryKey: ["commissions", partnerId, currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/partner/commissions?partner_id=${partnerId}&year=${currentYear}`);
      if (!res.ok) throw new Error("Failed to fetch commissions");
      return res.json();
    },
    enabled: !!partnerId,
    staleTime: 5 * 60 * 1000, // Cache 5 min (HubSpot data doesn't change frequently)
  });
}

export function useInvoices(partnerId: string | undefined) {
  return useQuery<Invoice[]>({
    queryKey: ["invoices", partnerId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!partnerId,
  });
}
