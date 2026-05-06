"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserCheck, UserX } from "lucide-react";

interface Commercial {
  id: string;
  name: string;
  email: string | null;
  hubspot_owner_id: string;
  role: string;
  active: boolean;
  share_fraction: number | null;
}

interface Props {
  commercials: Commercial[];
}

export default function EquipeManager({ commercials: initial }: Props) {
  const [commercials, setCommercials] = useState(initial);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ name: string; email: string; password: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    hubspot_owner_id: "",
    role: "sales" as "sales" | "upsell" | "support" | "sales_admin",
    share_fraction: "0.16",
  });
  const [error, setError] = useState<string | null>(null);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/sales/commercials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          hubspot_owner_id: form.hubspot_owner_id.trim(),
          role: form.role,
          share_fraction: Number(form.share_fraction) || 0,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setCreatedInfo({
        name: form.name,
        email: form.email,
        password: data.initial_password,
      });
      setShowForm(false);
      setForm({ name: "", email: "", hubspot_owner_id: "", role: "sales", share_fraction: "0.16" });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    if (!confirm(active ? "Réactiver ce négo ?" : "Désactiver ce négo ? (l'historique est préservé)")) return;
    try {
      const r = await fetch("/api/sales/commercials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setCommercials((prev) => prev.map((c) => c.id === id ? { ...c, active } : c));
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="space-y-4">
      {/* Created credentials banner */}
      {createdInfo && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4">
          <h3 className="text-sm font-bold text-emerald-800 mb-2">✅ Compte créé pour {createdInfo.name}</h3>
          <p className="text-xs text-gray-700 mb-2">
            Communique ces identifiants en privé — ils ne seront plus affichés.
          </p>
          <div className="bg-white border border-emerald-200 rounded p-2 font-mono text-xs">
            <div>📧 {createdInfo.email}</div>
            <div>🔑 {createdInfo.password}</div>
          </div>
          <button
            onClick={() => setCreatedInfo(null)}
            className="mt-2 text-xs text-emerald-700 underline"
          >
            J&apos;ai noté, fermer
          </button>
        </div>
      )}

      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Équipe ({commercials.filter((c) => c.active).length} actifs)</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[#0A3855] text-white rounded hover:bg-[#0d4f78]"
          >
            <Plus className="w-3 h-3" /> Ajouter un négo
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={submitAdd} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">Nouveau négo</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="block text-gray-600">Nom</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" />
            </label>
            <label className="text-xs space-y-1">
              <span className="block text-gray-600">Email pro</span>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" />
            </label>
            <label className="text-xs space-y-1">
              <span className="block text-gray-600">HubSpot owner_id</span>
              <input required value={form.hubspot_owner_id} onChange={(e) => setForm({ ...form, hubspot_owner_id: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" />
            </label>
            <label className="text-xs space-y-1">
              <span className="block text-gray-600">Rôle</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "sales" | "upsell" | "support" | "sales_admin" })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm">
                <option value="sales">sales (vente abonnements)</option>
                <option value="sales_admin">sales_admin (manager + vendeur)</option>
                <option value="upsell">upsell (services SIRET, INPI)</option>
                <option value="support">support (pas de vente)</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="block text-gray-600">Part d&apos;objectif (0 - 1)</span>
              <input type="number" step="0.01" min="0" max="1" value={form.share_fraction} onChange={(e) => setForm({ ...form, share_fraction: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" />
              <span className="block text-[10px] text-gray-400">Ex: 0.33 = 1/3 du total équipe. 0 = pas d&apos;objectif chiffré.</span>
            </label>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="text-xs px-3 py-1.5 border border-gray-200 rounded">Annuler</button>
            <button type="submit" disabled={busy} className="text-xs px-3 py-1.5 bg-[#0A3855] text-white rounded disabled:opacity-50">
              {busy ? "Création..." : "Créer le compte"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">HubSpot owner_id</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2 text-right">Part objectif</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {commercials.map((c) => (
              <tr key={c.id} className={`border-t border-gray-100 ${!c.active ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 font-semibold">{c.name}</td>
                <td className="px-3 py-2 text-xs font-mono">{c.email || "—"}</td>
                <td className="px-3 py-2 text-xs font-mono">{c.hubspot_owner_id}</td>
                <td className="px-3 py-2 text-xs">{c.role}</td>
                <td className="px-3 py-2 text-xs text-right tabular-nums">
                  {c.share_fraction ? `${(c.share_fraction * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2">
                  {c.active ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Actif</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Désactivé</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => toggleActive(c.id, !c.active)}
                    className="text-xs text-gray-500 hover:text-[#0A3855] inline-flex items-center gap-1"
                    title={c.active ? "Désactiver" : "Réactiver"}
                  >
                    {c.active ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
