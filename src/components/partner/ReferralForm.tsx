"use client";

import { useState, FormEvent } from "react";
import { useAddReferral } from "@/hooks/useMutations";
import { isValidEmail, buildRdvLink } from "@/services/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-b from-green-50/80 to-white px-6 pt-8 pb-2">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Contact enregistré !</h3>
            <p className="text-sm text-gray-500">
              {prenom} {nom} a bien été ajouté à votre suivi.
            </p>
          </div>
        </div>
        <CardContent className="space-y-5 pt-5">
          <div className="bg-[#E5EDF1]/40 border border-[#0A3855]/10 rounded-xl p-4">
            <p className="text-[11px] text-[#0A3855]/60 font-semibold uppercase tracking-wider mb-2">
              Lien RDV personnalise
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-sm text-[#0A3855] bg-white rounded-lg border border-[#0A3855]/10 px-3 py-2.5 font-mono">
                {rdvLink}
              </code>
              <CopyButton text={rdvLink} label="Copier" />
            </div>
          </div>

          <Separator />

          <div className="flex justify-center">
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
              className="border-[#0A3855]/20 text-[#0A3855] hover:bg-[#E5EDF1]/50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Ajouter un autre contact
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold text-gray-900">Nouveau contact</CardTitle>
        <CardDescription className="text-xs text-gray-500">
          Renseignez les informations de votre contact pour l&apos;ajouter au suivi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-5 border-red-200 bg-red-50">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Prenom</Label>
              <Input
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Prenom"
                className="border-gray-200 focus:border-[#0A3855] focus:ring-[#0A3855]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Nom</Label>
              <Input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom"
                className="border-gray-200 focus:border-[#0A3855] focus:ring-[#0A3855]/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="border-gray-200 focus:border-[#0A3855] focus:ring-[#0A3855]/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Telephone (optionnel)</Label>
            <Input
              type="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="06 12 34 56 78"
              className="border-gray-200 focus:border-[#0A3855] focus:ring-[#0A3855]/20"
            />
          </div>

          <Select label="Nombre de biens" options={BIENS_OPTIONS} value={biens} onChange={(e) => setBiens(e.target.value)} />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Commentaire (optionnel)</Label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Informations complementaires..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855] transition-all resize-none"
            />
          </div>

          <div className="rounded-xl border border-[#0A3855]/10 bg-[#E5EDF1]/30 px-4 py-3 text-xs text-[#0A3855]/70 leading-relaxed">
            💡 Si ce contact souscrit à Qlower, vous percevrez <strong className="text-[#0A3855]">100&nbsp;€</strong> de commission, versée annuellement.
          </div>

          <Button
            type="submit"
            disabled={addReferral.isPending}
            className="w-full bg-[#0A3855] hover:bg-[#0A3855]/90 text-white shadow-sm mt-2"
          >
            {addReferral.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Envoi en cours...
              </span>
            ) : (
              "Envoyer le contact"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
