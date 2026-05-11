"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Phone,
  Calendar,
  MessageSquare,
  FileText,
  Mic,
  Trophy,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface EngagementEntry {
  id: string;
  kind:
    | "modjo_closing"
    | "modjo_qualif"
    | "meeting_completed"
    | "meeting_scheduled"
    | "aircall_call"
    | "sms"
    | "note_sales"
    | "email";
  timestamp: string;
  owner_id: string | null;
  owner_name: string;
  owner_role: string;
  label: string;
  excerpt: string;
  contact_id: string;
  duration_ms?: number;
}

interface ChargeInfo {
  charge_id: string;
  email: string;
  phone: string | null;
  client_name: string | null;
  amount_net_eur: number;
  created_at: string;
}

interface HistoryResponse {
  ok: true;
  charge: ChargeInfo;
  contacts: Array<{ id: string; email: string | null; owner_id: string | null; owner_name: string }>;
  engagements: EngagementEntry[];
  by_owner: Array<{ owner_id: string; name: string; role: string; count: number; last_at: string }>;
}

interface Props {
  chargeId: string | null;
  onClose: () => void;
}

const KIND_META: Record<
  EngagementEntry["kind"],
  { icon: typeof Phone; bg: string; text: string; label: string }
> = {
  modjo_closing: { icon: Trophy, bg: "bg-emerald-100", text: "text-emerald-700", label: "Modjo closing" },
  modjo_qualif: { icon: Mic, bg: "bg-blue-100", text: "text-blue-700", label: "Modjo qualif" },
  meeting_completed: { icon: Calendar, bg: "bg-violet-100", text: "text-violet-700", label: "RDV terminé" },
  meeting_scheduled: { icon: Calendar, bg: "bg-gray-100", text: "text-gray-600", label: "RDV planifié" },
  aircall_call: { icon: Phone, bg: "bg-amber-100", text: "text-amber-700", label: "Aircall" },
  sms: { icon: MessageSquare, bg: "bg-pink-100", text: "text-pink-700", label: "SMS" },
  note_sales: { icon: FileText, bg: "bg-gray-100", text: "text-gray-600", label: "Note" },
  email: { icon: MessageSquare, bg: "bg-sky-100", text: "text-sky-700", label: "Email" },
};

const fmtDt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

const fmtDays = (iso: string, refIso: string) => {
  const d = new Date(iso).getTime();
  const r = new Date(refIso).getTime();
  if (isNaN(d) || isNaN(r)) return "";
  const days = Math.round((r - d) / (24 * 3600 * 1000));
  if (days === 0) return "le jour J";
  if (days > 0) return `J-${days}`;
  return `J+${-days}`;
};

export default function EngagementPanel({ chargeId, onClose }: Props) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chargeId) return;
    setData(null);
    setError(null);
    setLoading(true);
    fetch(`/api/sales/engagements/${encodeURIComponent(chargeId)}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => setData(j))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue"))
      .finally(() => setLoading(false));
  }, [chargeId]);

  // ESC to close
  useEffect(() => {
    if (!chargeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chargeId, onClose]);

  if (!chargeId) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
              Chronologie HubSpot
            </div>
            <h2 className="text-base font-semibold text-[#0A3855] truncate">
              {data?.charge.client_name || data?.charge.email || "Chargement…"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Récupération HubSpot en cours…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              {/* Charge récap */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div><span className="text-gray-400">Email :</span> <span className="font-mono">{data.charge.email}</span></div>
                  <div><span className="text-gray-400">Téléphone :</span> {data.charge.phone || "—"}</div>
                  <div><span className="text-gray-400">Montant :</span> <strong>{Math.round(data.charge.amount_net_eur).toLocaleString("fr-FR")} €</strong></div>
                  <div><span className="text-gray-400">Payé le :</span> {fmtDt(data.charge.created_at)}</div>
                </div>
              </div>

              {/* Fiches HubSpot matchées */}
              {data.contacts.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                    {data.contacts.length} fiche{data.contacts.length > 1 ? "s" : ""} HubSpot matchée{data.contacts.length > 1 ? "s" : ""}
                    {data.contacts.length > 1 && (
                      <span className="ml-2 text-amber-600 normal-case font-normal">⚠️ doublons à fusionner ?</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {data.contacts.map((c) => (
                      <a
                        key={c.id}
                        href={`https://app-eu1.hubspot.com/contacts/qlower/contact/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-200 rounded text-xs hover:bg-gray-50"
                      >
                        <div className="font-mono">{c.email || "—"}</div>
                        <div className="flex items-center gap-2 text-gray-500">
                          <span>Owner : <strong className="text-[#0A3855]">{c.owner_name}</strong></span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Récap par négo */}
              {data.by_owner.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                    Qui a touché ce client
                  </div>
                  <div className="space-y-1">
                    {data.by_owner.map((o) => (
                      <div
                        key={o.owner_id}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-xs"
                      >
                        <div>
                          <strong>{o.name}</strong>
                          <span className="ml-1 text-gray-400">({o.role})</span>
                        </div>
                        <div className="text-gray-500">
                          {o.count} interaction{o.count > 1 ? "s" : ""} · dernier {fmtDt(o.last_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                  Chronologie ({data.engagements.length} interaction{data.engagements.length > 1 ? "s" : ""})
                </div>
                {data.engagements.length === 0 ? (
                  <div className="text-sm text-gray-400 italic py-4">
                    Aucune interaction trackée sur HubSpot pour ce client.
                  </div>
                ) : (
                  <ol className="relative border-l border-gray-200 ml-3 space-y-3">
                    {data.engagements.map((e) => {
                      const meta = KIND_META[e.kind];
                      const Icon = meta.icon;
                      return (
                        <li key={e.id} className="ml-5 relative">
                          <span
                            className={`absolute -left-[31px] top-0 flex items-center justify-center w-6 h-6 rounded-full ${meta.bg} ${meta.text} ring-4 ring-white`}
                          >
                            <Icon className="w-3 h-3" />
                          </span>
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${meta.bg} ${meta.text}`}>
                                  {e.label}
                                </span>
                                <span className="font-semibold text-gray-900">{e.owner_name}</span>
                                <span className="text-gray-400">({e.owner_role})</span>
                              </div>
                              <div className="text-[11px] text-gray-500 whitespace-nowrap">
                                {fmtDt(e.timestamp)}
                                <span className="ml-1 text-gray-400">· {fmtDays(e.timestamp, data.charge.created_at)}</span>
                              </div>
                            </div>
                            {e.excerpt && (
                              <p className="text-xs text-gray-600 leading-relaxed">{e.excerpt}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
