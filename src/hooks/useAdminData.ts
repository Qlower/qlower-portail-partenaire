"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { Partner } from "@/types";

// ── Queries ──────────────────────────────────────────────────

export function useAdminPartners() {
  return useQuery<Partner[]>({
    queryKey: ["admin", "partners"],
    queryFn: async () => {
      const { data } = await api.get("/admin/partners");
      return data;
    },
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner: Record<string, unknown>) => {
      const { data } = await api.post("/admin/partners", partner);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "partners"] }),
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (update: { id: string } & Record<string, unknown>) => {
      const { data } = await api.patch("/admin/partners", update);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "partners"] }),
  });
}

export function useBatchCreatePartners() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partners: Array<Record<string, unknown> | { nom: string; type?: string; contrat?: string }>) => {
      const { data } = await api.post("/admin/batch", { partners });
      return data as { created: Array<Record<string, unknown>>; errors: { nom: string; error: string }[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "partners"] }),
  });
}

export function useOnboardPartnerAdmin() {
  return useMutation({
    mutationFn: async (payload: { partnerName: string; utmValue: string }) => {
      const { data } = await api.post("/hubspot/onboard-partner", payload);
      return data;
    },
  });
}
