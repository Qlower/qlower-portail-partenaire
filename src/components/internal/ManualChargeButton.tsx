"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "virement", label: "Virement bancaire", icon: "🏦" },
  { value: "cheque", label: "Chèque", icon: "📝" },
  { value: "especes", label: "Espèces", icon: "💵" },
  { value: "autre", label: "Autre", icon: "📋" },
] as const;

const FAMILIES = [
  "Abonnement",
  "Déclaration fiscale",
  "Immat / SIRET / INPI",
  "Correction décla",
  "Autre",
];

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Bouton "Ajouter une vente manuelle" pour les paiements hors Stripe
 * (virement, chèque, espèces). Affiché sur la page admin attribution.
 *
 * Modal de saisie complet avec scoring HubSpot auto déclenché.
 */
export default function ManualChargeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<"virement" | "cheque" | "especes" | "autre">("virement");
  const [family, setFamily] = useState("Déclaration fiscale");
  const [productName, setProductName] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setEmail("");
    setClientName("");
    setPhone("");
    setAmount("");
    setPaymentDate(todayIso());
    setPaymentMethod("virement");
    setFamily("Déclaration fiscale");
    setProductName("");
    setNote("");
    setError(null);
    setSuccess(null);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/sales/manual-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          client_name: clientName || null,
          phone: phone || null,
          amount_ttc: parseFloat(amount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          family,
          product_name: productName || null,
          description: productName || null,
          note: note || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSuccess(
        j.scoring?.commercial_id
          ? `✅ Vente ajoutée et attribuée automatiquement (score ${j.scoring.auto_score}/10 — ${j.scoring.auto_source})`
          : "✅ Vente ajoutée — pas d'attribution automatique, à arbitrer manuellement.",
      );
      // Reset uniquement les champs sensibles, garder les "préférences" type method + family
      setEmail("");
      setClientName("");
      setPhone("");
      setAmount("");
      setProductName("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 font-medium"
        title="Ajouter manuellement une vente hors Stripe (virement, chèque, espèces)"
      >
        <Plus className="w-3.5 h-3.5" />
        Vente manuelle
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-[#0A3855]">Ajouter une vente manuelle</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pour les paiements hors Stripe (virement, chèque, espèces). Scoring HubSpot lancé automatiquement.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {success && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{success}</div>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {/* Méthode de paiement */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">
                  Méthode de paiement *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPaymentMethod(m.value)}
                      className={`text-xs px-3 py-2 rounded border ${paymentMethod === m.value ? "bg-[#0A3855] text-white border-[#0A3855]" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}
                    >
                      <span className="mr-1">{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Email client *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Nom du client
                  </label>
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Téléphone <span className="text-gray-400 font-normal">(améliore le matching HubSpot)</span>
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Date du paiement *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                  />
                </div>
              </div>

              {/* Montant + produit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Montant TTC * <span className="text-gray-400 font-normal">(en €)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="269"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Famille produit
                  </label>
                  <select
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded bg-white"
                  >
                    {FAMILIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Nom du produit / Description
                </label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Déclaration LMNP 2 biens, Abonnement annuel, etc."
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Note interne <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ex: virement reçu le 13/05, ref BNP-12345"
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20"
                />
              </div>

              <div className="text-[11px] text-gray-500 bg-blue-50/50 border border-blue-100 rounded p-2">
                💡 Le scoring HubSpot (Modjo / RDV / Aircall) est lancé automatiquement après ajout.
                Tu pourras toujours réattribuer manuellement la vente depuis le tableau si besoin.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700"
              >
                Fermer
              </button>
              <button
                onClick={submit}
                disabled={submitting || !email || !amount}
                className="inline-flex items-center gap-1.5 text-xs px-4 py-2 bg-[#0A3855] text-white rounded hover:bg-[#0d4f78] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Ajouter la vente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
