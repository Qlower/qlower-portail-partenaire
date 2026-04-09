"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase-browser";
import { api } from "@/lib/axios";
import type {
  Partner,
  PartnerAction,
  Referral,
  CreateContactPayload,
  OnboardPartnerPayload,
} from "@/types";

export function useRegisterPartner() {
  return useMutation({
    mutationFn: async (partner: Record<string, unknown>) => {
      const { data } = await api.post("/register", partner);
      return data;
    },
  });
}

export function useAddReferral() {
  const queryClient = useQueryClient();

  return useMutation<Referral, Error, CreateContactPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Referral>(
        "/hubspot/create-contact",
        payload,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["referrals", variables.partnerId],
      });
    },
  });
}

export function useOnboardPartner() {
  return useMutation<unknown, Error, OnboardPartnerPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/hubspot/onboard-partner", payload);
      return data;
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();

  return useMutation<
    Partner,
    Error,
    { partnerId: string; updates: Partial<Partner> }
  >({
    mutationFn: async ({ partnerId, updates }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("partners")
        .update(updates)
        .eq("id", partnerId)
        .select()
        .single();
      if (error) throw error;
      return data as Partner;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["partner", variables.partnerId],
      });
    },
  });
}

export function useAddAction(partnerId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    PartnerAction,
    Error,
    { type: PartnerAction["type"]; label: string }
  >({
    mutationFn: async ({ type, label }) => {
      const supabase = createClient();
      const date = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const { data, error } = await supabase
        .from("partner_actions")
        .insert({ partner_id: partnerId, type, label, date })
        .select()
        .single();
      if (error) throw error;
      return data as PartnerAction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["actions", partnerId],
      });
    },
  });
}
