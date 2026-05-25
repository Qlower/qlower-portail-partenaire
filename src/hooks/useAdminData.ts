"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { Partner, Lead } from "@/types";

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

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/partners?id=${id}`);
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
      return data as {
        created: Array<Record<string, unknown>>;
        updated: Array<Record<string, unknown>>;
        errors: { nom: string; error: string }[];
        syncResults: Record<string, { synced: number; updated: number; skipped: number }>;
      };
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

export function useAdminLeads(partnerId: string | undefined) {
  return useQuery<Lead[]>({
    queryKey: ["admin", "leads", partnerId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads?partner_id=${partnerId}`);
      return data as Lead[];
    },
    enabled: !!partnerId,
  });
}

// ── Email Templates ─────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  body: string;
  updated_at: string;
}

export function useEmailTemplates() {
  return useQuery<EmailTemplate[]>({
    queryKey: ["admin", "email-templates"],
    queryFn: async () => {
      const { data } = await api.get("/admin/email-templates");
      return data;
    },
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (update: {
      id: string;
      subject?: string;
      body?: string;
      versionLabel?: string | null;
    }) => {
      const { data } = await api.patch("/admin/email-templates", update);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
      // Refresh versions list après chaque save
      qc.invalidateQueries({ queryKey: ["admin", "email-template-versions", variables.id] });
    },
  });
}

// ─── Versions d'un template (historique pour revenir en arrière) ────────────
export interface EmailTemplateVersion {
  id: string;
  label: string | null;
  saved_at: string;
  saved_by_email: string | null;
  subject: string;
  body: string;
}

export function useEmailTemplateVersions(templateId: string | null) {
  return useQuery<EmailTemplateVersion[]>({
    queryKey: ["admin", "email-template-versions", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data } = await api.get(`/admin/email-templates/${templateId}/versions`);
      return data as EmailTemplateVersion[];
    },
    enabled: !!templateId,
  });
}

export function useRestoreEmailTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { templateId: string; versionId: string }) => {
      const { data } = await api.post(
        `/admin/email-templates/${input.templateId}/restore`,
        { version_id: input.versionId },
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
      qc.invalidateQueries({ queryKey: ["admin", "email-template-versions", variables.templateId] });
    },
  });
}

export function useStarEmailTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      templateId: string;
      versionId: string;
      label: string | null;
    }) => {
      const { data } = await api.post(
        `/admin/email-templates/${input.templateId}/versions`,
        { version_id: input.versionId, label: input.label },
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin", "email-template-versions", variables.templateId] });
    },
  });
}

export function useSyncHubspot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/admin/sync-hubspot");
      return data as {
        synced: number;
        updated: number;
        skipped: number;
        errors: number;
        total: number;
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}
