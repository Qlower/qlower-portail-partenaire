"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePartner } from "@/hooks/usePartnerData";
import { useAddReferral } from "@/hooks/useMutations";
import { isValidEmail, buildRdvLink } from "@/services/links";
import { calcCommission } from "@/services/commission";
import { Button, Input, Select, Alert, Card, CopyButton } from "@/components/ui";
import type { Partner } from "@/types";

interface ReferralFormProps {
  partner: Partner;
}

const BIENS_OPTIONS = [
  { value: "1", label: "1 bien" },
  { value: "2", label: "2 biens" },
  { value: "3", label: "3 biens" },
  { value: "4", label: "4 biens" },
  { value: "5+", label: "5 biens ou plus" },
];

export default function ReferralForm({ partner }: ReferralFormProps) {
  const addReferral = useAddReferral();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [biens, setBiens] = useState("1");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const biensCount = biens === "5+" ? 5 : parseInt(biens, 10);
  const estimation = calcCommission(partner.comm_rules, 1, biensCount);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!prenom || !nom) {
      setError("Prenom et nom requis.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Adresse email invalide.");
      return;
    }

    try {
      await addReferral.mutateAsync({
        prenom,
        nom,
        email,
        tel: tel || undefined,
        biens,
        comment: comment || undefined,
        partnerUtm: partner.utm,
        partnerId: partner.id,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'envoi.";
      setError(message);
    }
  };

  if (success) {
    const rdvLink = buildRdvLink(partner.utm);
    return (
      <Card>
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Contact enregistre !</h3>
          <p className="text-sm text-gray-500 mb-6">
            {prenom} {nom} a ete synchronise avec HubSpot.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
              Lien RDV personnalise
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm text-gray-700 bg-white rounded-lg border border-gray-200 px-3 py-2">
                {rdvLink}
              </span>
              <CopyButton text={rdvLink} label="Copier" />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setSuccess(false);
              setPrenom("");
              setNom("");
              setEmail("");
              setTel("");
              setBiens("1");
              setComment("");
            }}
          >
            Ajouter un autre contact
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Nouveau contact</h3>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prenom" />
          <Input label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        <Input label="Telephone (optionnel)" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="06 12 34 56 78" />
        <Select label="Nombre de biens" options={BIENS_OPTIONS} value={biens} onChange={(e) => setBiens(e.target.value)} />

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Commentaire (optionnel)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Informations complementaires..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/30 focus:border-[#0A3855] transition resize-none"
          />
        </div>

        {/* Commission estimate */}
        {estimation.total > 0 && (
          <div className="bg-[#0A3855]/5 border border-[#0A3855]/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium mb-1">Commission estimee</p>
            <p className="text-xl font-bold text-[#0A3855]">{estimation.total} &euro;</p>
            <div className="mt-2 space-y-1">
              {estimation.detail.map((d, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-500">
                  <span>{d.label}</span>
                  <span className="font-medium text-gray-700">{d.calc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button type="submit" disabled={addReferral.isPending} className="w-full mt-1">
          {addReferral.isPending ? "Envoi en cours..." : "Envoyer le contact"}
        </Button>
      </form>
    </Card>
  );
}
